import {
  ColumnarCandles,
  BacktestParams,
  BacktestResult,
  BacktestProgress,
  GridOptimizationItem,
} from '../../types';
import { serializeColumnarToBuffer, deserializeColumnarFromBuffer } from './columnarData';
import { runBacktestOnColumnar } from './backtestEngine';

/**
 * High-Performance Bounded Web Worker Pool
 * Executes large-scale backtesting and grid parameter optimizations outside the main thread.
 * Features zero-copy ArrayBuffer transfer, hardware concurrency bounded workers, throttled progress, and instant cancellation.
 */

// Embedded worker source string for sandboxed / iframe compatibility
const WORKER_SCRIPT = `
self.onmessage = function(e) {
  const msg = e.data;
  if (!msg) return;

  if (msg.type === 'RUN_BACKTEST') {
    const { jobId, buffer, params } = msg;
    try {
      // Deserialize columnar data directly from buffer
      const headerView = new Uint32Array(buffer, 0, 1);
      const count = headerView[0];
      const floatBytes = count * 8;

      let offset = 4;
      const timestamps = new Float64Array(buffer.slice(offset, offset + floatBytes));
      offset += floatBytes;
      const opens = new Float64Array(buffer.slice(offset, offset + floatBytes));
      offset += floatBytes;
      const highs = new Float64Array(buffer.slice(offset, offset + floatBytes));
      offset += floatBytes;
      const lows = new Float64Array(buffer.slice(offset, offset + floatBytes));
      offset += floatBytes;
      const closes = new Float64Array(buffer.slice(offset, offset + floatBytes));
      offset += floatBytes;
      const volumes = new Float64Array(buffer.slice(offset, offset + floatBytes));

      const col = { timestamps, opens, highs, lows, closes, volumes, count };

      let lastReport = 0;
      const result = runBacktestInternal(col, params, (processed, total, tradesCount, currentEquity) => {
        const now = performance.now();
        if (now - lastReport >= 80) { // Throttle worker progress updates to max 12 Hz
          lastReport = now;
          self.postMessage({
            type: 'PROGRESS',
            jobId,
            processedCandles: processed,
            totalCandles: total,
            processedTrades: tradesCount,
            currentEquity,
          });
        }
        return true;
      });

      self.postMessage({
        type: 'SUCCESS',
        jobId,
        result,
      });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        jobId,
        error: err && err.message ? err.message : String(err),
      });
    }
  }
};

// Fast internal vector indicator & backtest execution inside worker
function calculateEMAInternal(closes, period) {
  const len = closes.length;
  const result = new Float64Array(len);
  result.fill(NaN);
  if (len < period || period <= 0) return result;
  const mult = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  let prev = sum / period;
  result[period - 1] = prev;
  for (let i = period; i < len; i++) {
    prev = (closes[i] - prev) * mult + prev;
    result[i] = prev;
  }
  return result;
}

function calculateRSIInternal(closes, period) {
  const len = closes.length;
  const result = new Float64Array(len);
  result.fill(NaN);
  if (len <= period || period <= 0) return result;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gain += diff; else loss -= diff;
  }
  let avgG = gain / period, avgL = loss / period;
  result[period] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
  for (let i = period + 1; i < len; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    result[i] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
  }
  return result;
}

function runBacktestInternal(data, params, onProgress) {
  const count = data.count;
  const initialCapital = params.initialCapital || 100000;
  let capital = initialCapital;
  let position = null;
  const trades = [];
  const rawEquityCurve = [{ time: data.timestamps[0] || Date.now(), equity: initialCapital }];

  const closes = data.closes;
  const highs = data.highs;
  const lows = data.lows;
  const timestamps = data.timestamps;
  const custom = params.customParams || {};

  let fastEMA = null, slowEMA = null, rsi = null;
  if (params.strategy === 'ema_crossover' || params.strategy === 'dual_ma_atr' || params.strategy === 'multi_confluence') {
    fastEMA = calculateEMAInternal(closes, custom.fastPeriod || 9);
    slowEMA = calculateEMAInternal(closes, custom.slowPeriod || 21);
  }
  if (params.strategy === 'rsi_mean_reversion' || params.strategy === 'multi_confluence') {
    rsi = calculateRSIInternal(closes, custom.rsiPeriod || 14);
  }

  const commissionRate = (params.commissionPercent || 0.05) / 100;
  const slippageMult = (params.slippagePips || 0.5) * 0.0001;
  const posSizePercent = (params.positionSizePercent || 20) / 100;
  let peakEquity = initialCapital, maxDrawdown = 0, maxDrawdownPercent = 0;

  for (let i = 1; i < count; i++) {
    const time = timestamps[i];
    const open = data.opens[i];
    const high = highs[i];
    const low = lows[i];
    const close = closes[i];

    if (position) {
      let isClosed = false, exitPrice = 0, exitReason = 'SIGNAL_EXIT';
      if (position.side === 'LONG') {
        if (position.stopLoss && low <= position.stopLoss) {
          exitPrice = Math.min(open, position.stopLoss); exitReason = 'STOP_LOSS'; isClosed = true;
        } else if (position.takeProfit && high >= position.takeProfit) {
          exitPrice = Math.max(open, position.takeProfit); exitReason = 'TAKE_PROFIT'; isClosed = true;
        }
      } else {
        if (position.stopLoss && high >= position.stopLoss) {
          exitPrice = Math.max(open, position.stopLoss); exitReason = 'STOP_LOSS'; isClosed = true;
        } else if (position.takeProfit && low <= position.takeProfit) {
          exitPrice = Math.min(open, position.takeProfit); exitReason = 'TAKE_PROFIT'; isClosed = true;
        }
      }

      if (isClosed) {
        const slippage = exitPrice * slippageMult;
        const actualExit = position.side === 'LONG' ? exitPrice - slippage : exitPrice + slippage;
        const grossPnl = position.side === 'LONG' ? (actualExit - position.entryPrice) * position.quantity : (position.entryPrice - actualExit) * position.quantity;
        const fees = (position.entryPrice * position.quantity + actualExit * position.quantity) * commissionRate;
        const netPnl = grossPnl - fees;
        capital += netPnl;
        trades.push({
          id: 'trade_' + (trades.length + 1),
          entryTime: position.entryTime,
          exitTime: time,
          symbol: params.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice: actualExit,
          quantity: position.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / (position.entryPrice * position.quantity)) * 100,
          fees,
          exitReason,
          durationBars: i - position.entryIndex,
        });
        position = null;
      }
    }

    let signal = null;
    const prevIdx = i - 1;
    if (params.strategy === 'ema_crossover' && fastEMA && slowEMA && prevIdx >= 1) {
      if (fastEMA[prevIdx - 1] <= slowEMA[prevIdx - 1] && fastEMA[prevIdx] > slowEMA[prevIdx]) signal = 'BUY';
      else if (fastEMA[prevIdx - 1] >= slowEMA[prevIdx - 1] && fastEMA[prevIdx] < slowEMA[prevIdx]) signal = 'SELL';
    } else if (params.strategy === 'rsi_mean_reversion' && rsi && prevIdx >= 1) {
      const os = custom.oversold || 30, ob = custom.overbought || 70;
      if (rsi[prevIdx - 1] < os && rsi[prevIdx] >= os) signal = 'BUY';
      else if (rsi[prevIdx - 1] > ob && rsi[prevIdx] <= ob) signal = 'SELL';
    } else if (params.strategy === 'multi_confluence' && fastEMA && slowEMA && rsi && prevIdx >= 1) {
      if (fastEMA[prevIdx] > slowEMA[prevIdx] && rsi[prevIdx] > 50 && rsi[prevIdx - 1] <= 50) signal = 'BUY';
      else if (fastEMA[prevIdx] < slowEMA[prevIdx] && rsi[prevIdx] < 50 && rsi[prevIdx - 1] >= 50) signal = 'SELL';
    } else if (fastEMA && slowEMA && prevIdx >= 1) {
      if (fastEMA[prevIdx] > slowEMA[prevIdx] && fastEMA[prevIdx - 1] <= slowEMA[prevIdx - 1]) signal = 'BUY';
      else if (fastEMA[prevIdx] < slowEMA[prevIdx] && fastEMA[prevIdx - 1] >= slowEMA[prevIdx - 1]) signal = 'SELL';
    }

    if (signal && capital > 100) {
      if (position && ((position.side === 'LONG' && signal === 'SELL') || (position.side === 'SHORT' && signal === 'BUY'))) {
        const slippage = open * slippageMult;
        const actualExit = position.side === 'LONG' ? open - slippage : open + slippage;
        const grossPnl = position.side === 'LONG' ? (actualExit - position.entryPrice) * position.quantity : (position.entryPrice - actualExit) * position.quantity;
        const fees = (position.entryPrice * position.quantity + actualExit * position.quantity) * commissionRate;
        const netPnl = grossPnl - fees;
        capital += netPnl;
        trades.push({
          id: 'trade_' + (trades.length + 1),
          entryTime: position.entryTime,
          exitTime: time,
          symbol: params.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice: actualExit,
          quantity: position.quantity,
          pnl: netPnl,
          pnlPercent: (netPnl / (position.entryPrice * position.quantity)) * 100,
          fees,
          exitReason: 'SIGNAL_EXIT',
          durationBars: i - position.entryIndex,
        });
        position = null;
      }

      if (!position && (signal === 'BUY' || signal === 'SELL')) {
        const side = signal;
        const slippage = open * slippageMult;
        const entryPrice = side === 'BUY' ? open + slippage : open - slippage;
        const allocated = capital * posSizePercent;
        const quantity = allocated / entryPrice;
        const stopDistance = entryPrice * 0.02;
        const stopLoss = side === 'BUY' ? entryPrice - stopDistance : entryPrice + stopDistance;
        const takeProfit = side === 'BUY' ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2;
        position = { side: side === 'BUY' ? 'LONG' : 'SHORT', entryPrice, entryTime: time, entryIndex: i, quantity, stopLoss, takeProfit };
      }
    }

    let currentVal = capital;
    if (position) {
      const openPnl = position.side === 'LONG' ? (close - position.entryPrice) * position.quantity : (position.entryPrice - close) * position.quantity;
      currentVal += openPnl;
    }
    if (currentVal > peakEquity) peakEquity = currentVal;
    const dd = peakEquity - currentVal;
    const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

    if (i % Math.max(1, Math.floor(count / 1000)) === 0 || i === count - 1) {
      rawEquityCurve.push({ time, equity: Number(currentVal.toFixed(2)) });
    }

    if (i % 5000 === 0 && onProgress) {
      onProgress(i, count, trades.length, currentVal);
    }
  }

  let runPeak = initialCapital;
  const equityCurve = rawEquityCurve.map(pt => {
    if (pt.equity > runPeak) runPeak = pt.equity;
    const d = runPeak - pt.equity;
    const dPct = runPeak > 0 ? (d / runPeak) * 100 : 0;
    return { time: pt.time, equity: pt.equity, drawdown: Number(d.toFixed(2)), drawdownPercent: Number(dPct.toFixed(2)) };
  });

  const totalReturn = capital - initialCapital;
  const totalReturnPercent = (totalReturn / initialCapital) * 100;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const totGains = wins.reduce((s, t) => s + t.pnl, 0);
  const totLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = totLoss > 0 ? totGains / totLoss : totGains > 0 ? 99.9 : 0;
  const avgWin = wins.length > 0 ? totGains / wins.length : 0;
  const avgLoss = losses.length > 0 ? totLoss / losses.length : 0;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  const rets = trades.map(t => t.pnlPercent / 100);
  let mean = 0;
  if (rets.length > 0) mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  let varSum = 0, downVar = 0;
  for (const r of rets) {
    const df = r - mean;
    varSum += df * df;
    if (r < 0) downVar += r * r;
  }
  const std = rets.length > 1 ? Math.sqrt(varSum / (rets.length - 1)) : 0.01;
  const dstd = rets.length > 1 ? Math.sqrt(downVar / (rets.length - 1)) : 0.01;
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
  const sortino = dstd > 0 ? (mean / dstd) * Math.sqrt(252) : 0;

  return {
    id: 'bt_' + Date.now(),
    params,
    totalCandles: count,
    executionTimeMs: 100,
    candlesPerSecond: 1000000,
    initialCapital,
    finalCapital: Number(capital.toFixed(2)),
    totalReturn: Number(totalReturn.toFixed(2)),
    totalReturnPercent: Number(totalReturnPercent.toFixed(2)),
    cagrPercent: Number(totalReturnPercent.toFixed(2)),
    sharpeRatio: Number(sharpe.toFixed(2)),
    sortinoRatio: Number(sortino.toFixed(2)),
    calmarRatio: maxDrawdownPercent > 0 ? Number((totalReturnPercent / maxDrawdownPercent).toFixed(2)) : 0,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: Number(winRate.toFixed(1)),
    profitFactor: Number(profitFactor.toFixed(2)),
    avgTradePnl: trades.length > 0 ? Number((totalReturn / trades.length).toFixed(2)) : 0,
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    winLossRatio: avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 1,
    expectancy: Number(expectancy.toFixed(2)),
    trades,
    equityCurve,
  };
}
`;

class QuantWorkerPoolManager {
  private workers: Worker[] = [];
  private poolSize: number;
  private workerBlobUrl: string | null = null;
  private activeJobs: Map<string, {
    workerIdx: number;
    onProgress?: (p: BacktestProgress) => void;
    resolve: (res: BacktestResult) => void;
    reject: (err: any) => void;
    startTime: number;
    totalCandles: number;
  }> = new Map();

  constructor() {
    const concurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;
    // Bound pool size between 2 and 8
    this.poolSize = Math.max(2, Math.min(8, concurrency));
    this.initPool();
  }

  private initPool() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;

    try {
      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
      this.workerBlobUrl = URL.createObjectURL(blob);

      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(this.workerBlobUrl);
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = (err) => console.error('QuantWorkerPool error:', err);
        this.workers.push(worker);
      }
    } catch {
      // Fallback mode if Blob worker is blocked by CSP
    }
  }

  private handleWorkerMessage(e: MessageEvent) {
    const msg = e.data;
    if (!msg || !msg.jobId) return;

    const job = this.activeJobs.get(msg.jobId);
    if (!job) return;

    if (msg.type === 'PROGRESS') {
      if (job.onProgress) {
        const elapsed = performance.now() - job.startTime;
        const progressPct = job.totalCandles > 0 ? Math.min(100, (msg.processedCandles / job.totalCandles) * 100) : 0;
        const speed = elapsed > 0 ? Math.round((msg.processedCandles / elapsed) * 1000) : 0;
        const remainingCandles = Math.max(0, job.totalCandles - msg.processedCandles);
        const estRemainingMs = speed > 0 ? (remainingCandles / speed) * 1000 : 0;

        job.onProgress({
          jobId: msg.jobId,
          status: 'running',
          progressPercent: Number(progressPct.toFixed(1)),
          currentTimestamp: Date.now(),
          processedCandles: msg.processedCandles,
          totalCandles: job.totalCandles,
          processedTrades: msg.processedTrades,
          elapsedMs: Math.round(elapsed),
          estimatedRemainingMs: Math.round(estRemainingMs),
          candlesPerSecond: speed,
        });
      }
    } else if (msg.type === 'SUCCESS') {
      const elapsed = performance.now() - job.startTime;
      const speed = elapsed > 0 ? Math.round((job.totalCandles / elapsed) * 1000) : 0;
      const res: BacktestResult = {
        ...msg.result,
        executionTimeMs: Math.round(elapsed),
        candlesPerSecond: speed,
      };

      if (job.onProgress) {
        job.onProgress({
          jobId: msg.jobId,
          status: 'completed',
          progressPercent: 100,
          currentTimestamp: Date.now(),
          processedCandles: job.totalCandles,
          totalCandles: job.totalCandles,
          processedTrades: res.totalTrades,
          elapsedMs: Math.round(elapsed),
          estimatedRemainingMs: 0,
          candlesPerSecond: speed,
        });
      }

      this.activeJobs.delete(msg.jobId);
      job.resolve(res);
    } else if (msg.type === 'ERROR') {
      this.activeJobs.delete(msg.jobId);
      job.reject(new Error(msg.error || 'Backtest execution failed'));
    }
  }

  public getPoolSize(): number {
    return this.poolSize;
  }

  /**
   * Dispatches a Backtest Job to an Available Web Worker using Zero-Copy ArrayBuffer Transfer
   */
  public executeBacktest(
    col: ColumnarCandles,
    params: BacktestParams,
    onProgress?: (p: BacktestProgress) => void
  ): { jobId: string; promise: Promise<BacktestResult>; cancel: () => void } {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = performance.now();

    let cancelFn: () => void = () => {};

    const promise = new Promise<BacktestResult>((resolve, reject) => {
      // If no workers available (fallback mode), run microtask asynchronously
      if (this.workers.length === 0) {
        setTimeout(() => {
          try {
            const res = runBacktestOnColumnar(col, params, (proc, tot, trds) => {
              if (onProgress) {
                const el = performance.now() - startTime;
                const spd = el > 0 ? Math.round((proc / el) * 1000) : 0;
                onProgress({
                  jobId,
                  status: 'running',
                  progressPercent: (proc / tot) * 100,
                  currentTimestamp: Date.now(),
                  processedCandles: proc,
                  totalCandles: tot,
                  processedTrades: trds,
                  elapsedMs: Math.round(el),
                  estimatedRemainingMs: Math.round(spd > 0 ? ((tot - proc) / spd) * 1000 : 0),
                  candlesPerSecond: spd,
                });
              }
              return true;
            });
            resolve(res);
          } catch (err) {
            reject(err);
          }
        }, 10);
        return;
      }

      // Pick round-robin / least loaded worker
      const workerIdx = Math.floor(Math.random() * this.workers.length);
      const worker = this.workers[workerIdx];

      this.activeJobs.set(jobId, {
        workerIdx,
        onProgress,
        resolve,
        reject,
        startTime,
        totalCandles: col.count,
      });

      // Serialize to transferrable ArrayBuffer for zero main-thread serialization lag
      const buffer = serializeColumnarToBuffer(col);

      // Send to worker with transferrable list
      worker.postMessage(
        {
          type: 'RUN_BACKTEST',
          jobId,
          buffer,
          params,
        },
        [buffer]
      );

      cancelFn = () => {
        this.cancelJob(jobId);
      };
    });

    return { jobId, promise, cancel: cancelFn };
  }

  /**
   * Instantly cancels an active backtest and resets worker state
   */
  public cancelJob(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Terminate and recreate that worker to guarantee immediate resource release
    try {
      const oldWorker = this.workers[job.workerIdx];
      if (oldWorker) {
        oldWorker.terminate();
        if (this.workerBlobUrl) {
          const newWorker = new Worker(this.workerBlobUrl);
          newWorker.onmessage = this.handleWorkerMessage.bind(this);
          newWorker.onerror = (err) => console.error('QuantWorkerPool error:', err);
          this.workers[job.workerIdx] = newWorker;
        }
      }
    } catch {
      // Handled
    }

    if (job.onProgress) {
      job.onProgress({
        jobId,
        status: 'cancelled',
        progressPercent: 0,
        currentTimestamp: Date.now(),
        processedCandles: 0,
        totalCandles: job.totalCandles,
        processedTrades: 0,
        elapsedMs: Math.round(performance.now() - job.startTime),
        estimatedRemainingMs: 0,
        candlesPerSecond: 0,
      });
    }

    this.activeJobs.delete(jobId);
    job.reject(new Error('Job cancelled by user'));
  }

  /**
   * Executes Parallel Parameter Grid Search Optimization across all workers
   */
  public async executeGridOptimization(
    col: ColumnarCandles,
    baseParams: BacktestParams,
    paramCombinations: Record<string, number>[],
    onProgress?: (completed: number, total: number, bestItem?: GridOptimizationItem) => void
  ): Promise<GridOptimizationItem[]> {
    const total = paramCombinations.length;
    const results: GridOptimizationItem[] = [];
    let completed = 0;
    let bestItem: GridOptimizationItem | undefined;

    // Distribute tasks across worker pool in concurrent batches
    const batchSize = this.poolSize;
    for (let i = 0; i < total; i += batchSize) {
      const batch = paramCombinations.slice(i, i + batchSize);
      const promises = batch.map(async (comboParams) => {
        const p: BacktestParams = {
          ...baseParams,
          customParams: { ...comboParams },
        };
        const { promise } = this.executeBacktest(col, p);
        const res = await promise;
        const item: GridOptimizationItem = {
          id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          params: comboParams,
          totalReturnPercent: res.totalReturnPercent,
          sharpeRatio: res.sharpeRatio,
          winRate: res.winRate,
          maxDrawdownPercent: res.maxDrawdownPercent,
          totalTrades: res.totalTrades,
          profitFactor: res.profitFactor,
          executionTimeMs: res.executionTimeMs,
        };

        results.push(item);
        completed++;

        if (!bestItem || item.sharpeRatio > bestItem.sharpeRatio) {
          bestItem = item;
        }

        if (onProgress) {
          onProgress(completed, total, bestItem);
        }

        return item;
      });

      await Promise.all(promises);
    }

    // Sort leaderboard by Sharpe ratio descending
    results.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
    return results;
  }
}

export const quantWorkerPool = new QuantWorkerPoolManager();
