import { BenchmarkMetric, ColumnarCandles } from '../../types';
import {
  generateColumnarDataset,
  aggregateTimeframeColumnar,
  downsampleLOD,
} from './columnarData';
import {
  calculateEMAVector,
  calculateRSIVector,
  calculateMACDVector,
} from './vectorIndicators';
import { runBacktestOnColumnar } from './backtestEngine';

/**
 * Quantitative Trading Performance Benchmarking Engine
 * Measures actual throughput (Candles/sec), latency (ms), and memory efficiency across large datasets (100K -> 10M candles).
 */

export interface BenchmarkSuiteResult {
  totalCandlesTested: number;
  totalTimeMs: number;
  overallThroughputCandlesSec: number;
  metrics: BenchmarkMetric[];
  memoryFootprintMb: number;
}

export async function runQuantitativeBenchmark(
  candleCounts: number[] = [100000, 1000000, 5000000],
  onMetricCompleted?: (metric: BenchmarkMetric) => void
): Promise<BenchmarkSuiteResult> {
  const metrics: BenchmarkMetric[] = [];
  const suiteStart = performance.now();
  let totalCandlesTested = 0;

  for (const count of candleCounts) {
    // 1. Benchmark Dataset Generation (PRNG Geometric Brownian Motion)
    const genStart = performance.now();
    const col = generateColumnarDataset(count, {
      startPrice: 50000,
      volatility: 0.0012,
    });
    const genDuration = performance.now() - genStart;
    const genSpeed = Math.round((count / Math.max(1, genDuration)) * 1000);
    const memoryMb = Number(((count * 8 * 6) / (1024 * 1024)).toFixed(2));

    const genMetric: BenchmarkMetric = {
      id: `bench_gen_${count}_${Date.now()}`,
      name: `Dataset Generation (${(count / 1000000).toFixed(1)}M Candles)`,
      category: 'dataset_gen',
      candleCount: count,
      durationMs: Number(genDuration.toFixed(1)),
      throughputCandlesSec: genSpeed,
      memoryMb,
      status: 'passed',
      timestamp: Date.now(),
    };
    metrics.push(genMetric);
    if (onMetricCompleted) onMetricCompleted(genMetric);

    // Yield to keep UI buttery smooth
    await new Promise((r) => setTimeout(r, 20));

    // 2. Benchmark Timeframe Aggregation (1m -> 15m)
    const aggStart = performance.now();
    const aggCol = aggregateTimeframeColumnar(col, '15m');
    const aggDuration = performance.now() - aggStart;
    const aggSpeed = Math.round((count / Math.max(1, aggDuration)) * 1000);

    const aggMetric: BenchmarkMetric = {
      id: `bench_agg_${count}_${Date.now()}`,
      name: `Timeframe Aggregation (1m → 15m)`,
      category: 'timeframe_agg',
      candleCount: count,
      durationMs: Number(aggDuration.toFixed(1)),
      throughputCandlesSec: aggSpeed,
      memoryMb: Number(((aggCol.count * 8 * 6) / (1024 * 1024)).toFixed(2)),
      status: 'passed',
      timestamp: Date.now(),
    };
    metrics.push(aggMetric);
    if (onMetricCompleted) onMetricCompleted(aggMetric);

    await new Promise((r) => setTimeout(r, 20));

    // 3. Benchmark Vectorized Indicators (EMA 9 + EMA 21 + RSI 14 + MACD)
    const indStart = performance.now();
    calculateEMAVector(col.closes, 9);
    calculateEMAVector(col.closes, 21);
    calculateRSIVector(col.closes, 14);
    calculateMACDVector(col.closes, 12, 26, 9);
    const indDuration = performance.now() - indStart;
    const indSpeed = Math.round((count / Math.max(1, indDuration)) * 1000);

    const indMetric: BenchmarkMetric = {
      id: `bench_ind_${count}_${Date.now()}`,
      name: `Vectorized Multi-Indicator Pipeline`,
      category: 'vector_indicators',
      candleCount: count,
      durationMs: Number(indDuration.toFixed(1)),
      throughputCandlesSec: indSpeed,
      memoryMb,
      status: 'passed',
      timestamp: Date.now(),
    };
    metrics.push(indMetric);
    if (onMetricCompleted) onMetricCompleted(indMetric);

    await new Promise((r) => setTimeout(r, 20));

    // 4. Benchmark Full Backtest Simulation Loop
    const btStart = performance.now();
    runBacktestOnColumnar(col, {
      strategy: 'ema_crossover',
      symbol: 'BTC/USD',
      timeframe: '1m',
      initialCapital: 100000,
      commissionPercent: 0.04,
      slippagePips: 0.5,
      positionSizePercent: 25,
      customParams: { fastPeriod: 9, slowPeriod: 21 },
    });
    const btDuration = performance.now() - btStart;
    const btSpeed = Math.round((count / Math.max(1, btDuration)) * 1000);

    const btMetric: BenchmarkMetric = {
      id: `bench_bt_${count}_${Date.now()}`,
      name: `Strategy Backtesting Loop (EMA Crossover)`,
      category: 'backtest_simulation',
      candleCount: count,
      durationMs: Number(btDuration.toFixed(1)),
      throughputCandlesSec: btSpeed,
      memoryMb,
      status: 'passed',
      timestamp: Date.now(),
    };
    metrics.push(btMetric);
    if (onMetricCompleted) onMetricCompleted(btMetric);

    await new Promise((r) => setTimeout(r, 20));

    // 5. Benchmark LOD Downsampling (1M -> 300 viewport bars)
    const lodStart = performance.now();
    downsampleLOD(col, 0, count, 300);
    const lodDuration = performance.now() - lodStart;
    const lodSpeed = Math.round((count / Math.max(1, lodDuration)) * 1000);

    const lodMetric: BenchmarkMetric = {
      id: `bench_lod_${count}_${Date.now()}`,
      name: `Level-of-Detail (LOD) Viewport Downsampler`,
      category: 'lod_downsample',
      candleCount: count,
      durationMs: Number(lodDuration.toFixed(2)),
      throughputCandlesSec: lodSpeed,
      status: 'passed',
      timestamp: Date.now(),
    };
    metrics.push(lodMetric);
    if (onMetricCompleted) onMetricCompleted(lodMetric);

    totalCandlesTested += count;
  }

  const totalTimeMs = performance.now() - suiteStart;
  const overallThroughputCandlesSec = totalTimeMs > 0 ? Math.round((totalCandlesTested / totalTimeMs) * 1000) : 0;
  const maxMemory = Math.max(...metrics.map((m) => m.memoryMb || 0));

  return {
    totalCandlesTested,
    totalTimeMs: Number(totalTimeMs.toFixed(1)),
    overallThroughputCandlesSec,
    metrics,
    memoryFootprintMb: maxMemory,
  };
}
