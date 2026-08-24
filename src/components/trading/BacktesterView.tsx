import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MarketSymbol,
  Timeframe,
  BacktestStrategyType,
  BacktestParams,
  BacktestResult,
  BacktestProgress,
  GridOptimizationItem,
} from '../../types';
import { quantWorkerPool } from '../../lib/trading/workerPool';
import { historicalCache } from '../../lib/trading/historicalCache';
import {
  Play,
  Square,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sliders,
  Cpu,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Filter,
  RefreshCw,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface BacktesterViewProps {
  currentSymbol: MarketSymbol;
  symbols: MarketSymbol[];
}

const STRATEGIES: { id: BacktestStrategyType; name: string; desc: string }[] = [
  {
    id: 'ema_crossover',
    name: 'EMA Dynamic Trend Crossover',
    desc: 'Captures sustained directional momentum via fast/slow exponential moving average intersections.',
  },
  {
    id: 'rsi_mean_reversion',
    name: 'RSI Statistical Mean Reversion',
    desc: 'Exploits oversold and overbought price dislocations with structural momentum confirmation.',
  },
  {
    id: 'macd_momentum',
    name: 'MACD Zero-Lag Histogram Momentum',
    desc: 'Trades signal line divergence and zero-line momentum expansions.',
  },
  {
    id: 'bollinger_breakout',
    name: 'Bollinger Band Squeeze & Volatility Expansion',
    desc: 'Identifies volatility compression breakouts and envelope expansions.',
  },
  {
    id: 'vwap_reversion',
    name: 'Intraday Institutional VWAP Deviation',
    desc: 'Trades standard deviation band reversals back to volume-weighted fair value.',
  },
  {
    id: 'dual_ma_atr',
    name: 'Dual MA Trend + ATR Trailing Chandelier Stop',
    desc: 'Trend following system with dynamic volatility-based trailing risk exits.',
  },
  {
    id: 'multi_confluence',
    name: 'Multi-Indicator Confluence Matrix (EMA + RSI + ATR)',
    desc: 'Combines trend filter, momentum threshold, and volatility targets for high win-rate execution.',
  },
];

export const BacktesterView: React.FC<BacktesterViewProps> = ({ currentSymbol }) => {
  // Strategy Configuration
  const [strategy, setStrategy] = useState<BacktestStrategyType>('ema_crossover');
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [datasetSize, setDatasetSize] = useState<number>(100000); // 100K candles
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [positionSizePercent, setPositionSizePercent] = useState<number>(25);
  const [commissionPercent, setCommissionPercent] = useState<number>(0.04);
  const [slippagePips, setSlippagePips] = useState<number>(0.5);

  // Strategy specific parameters
  const [fastPeriod, setFastPeriod] = useState<number>(9);
  const [slowPeriod, setSlowPeriod] = useState<number>(21);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [oversold, setOversold] = useState<number>(30);
  const [overbought, setOverbought] = useState<number>(70);
  const [stopLossAtr, setStopLossAtr] = useState<number>(2.0);
  const [takeProfitAtr, setTakeProfitAtr] = useState<number>(3.0);

  // Execution Mode: 'single' | 'grid_optimization'
  const [mode, setMode] = useState<'single' | 'grid_optimization'>('single');

  // Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BacktestProgress | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [gridResults, setGridResults] = useState<GridOptimizationItem[]>([]);
  const [gridProgress, setGridProgress] = useState<{ completed: number; total: number; best?: GridOptimizationItem } | null>(null);
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');

  const cancelRef = useRef<(() => void) | null>(null);

  // Run Single Backtest
  const handleStartBacktest = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      // 1. Fetch or generate high-speed columnar data
      const col = await historicalCache.getHistoricalColumnar(currentSymbol.symbol, timeframe, datasetSize);

      const customParams: Record<string, number> = {
        fastPeriod,
        slowPeriod,
        rsiPeriod,
        oversold,
        overbought,
      };

      const params: BacktestParams = {
        strategy,
        symbol: currentSymbol.symbol,
        timeframe,
        initialCapital,
        commissionPercent,
        slippagePips,
        positionSizePercent,
        stopLossAtrMult: stopLossAtr,
        takeProfitAtrMult: takeProfitAtr,
        customParams,
      };

      const { promise, cancel } = quantWorkerPool.executeBacktest(col, params, (p) => {
        setProgress(p);
      });

      cancelRef.current = cancel;
      const res = await promise;
      setResult(res);
    } catch (err: any) {
      if (err && err.message !== 'Job cancelled by user') {
        console.error('Backtest error:', err);
      }
    } finally {
      setIsRunning(false);
      cancelRef.current = null;
    }
  };

  // Run Multi-Worker Grid Parameter Optimization
  const handleStartGridOptimization = async () => {
    setIsRunning(true);
    setGridResults([]);
    setGridProgress(null);

    try {
      const col = await historicalCache.getHistoricalColumnar(currentSymbol.symbol, timeframe, Math.min(datasetSize, 250000));

      const baseParams: BacktestParams = {
        strategy,
        symbol: currentSymbol.symbol,
        timeframe,
        initialCapital,
        commissionPercent,
        slippagePips,
        positionSizePercent,
        stopLossAtrMult: stopLossAtr,
        takeProfitAtrMult: takeProfitAtr,
        customParams: {},
      };

      // Generate 20 parameter permutations for grid testing
      const combinations: Record<string, number>[] = [];
      if (strategy === 'ema_crossover' || strategy === 'dual_ma_atr') {
        const fastOptions = [5, 9, 13, 20];
        const slowOptions = [21, 34, 50, 89, 144];
        for (const f of fastOptions) {
          for (const s of slowOptions) {
            if (f < s) combinations.push({ fastPeriod: f, slowPeriod: s });
          }
        }
      } else if (strategy === 'rsi_mean_reversion') {
        const rsiPeriods = [7, 14, 21];
        const osOptions = [20, 25, 30, 35];
        const obOptions = [65, 70, 75, 80];
        for (const p of rsiPeriods) {
          for (const os of osOptions) {
            for (const ob of obOptions) {
              combinations.push({ rsiPeriod: p, oversold: os, overbought: ob });
            }
          }
        }
      } else {
        const fastOptions = [8, 12, 16];
        const slowOptions = [21, 26, 34];
        for (const f of fastOptions) {
          for (const s of slowOptions) {
            combinations.push({ fastPeriod: f, slowPeriod: s });
          }
        }
      }

      const topResults = await quantWorkerPool.executeGridOptimization(
        col,
        baseParams,
        combinations.slice(0, 32),
        (completed, total, best) => {
          setGridProgress({ completed, total, best });
        }
      );

      setGridResults(topResults);
    } catch (err) {
      console.error('Optimization error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCancel = () => {
    if (cancelRef.current) {
      cancelRef.current();
    }
    setIsRunning(false);
  };

  const filteredTrades = result?.trades.filter((t) => {
    if (tradeFilter === 'WINS') return t.pnl > 0;
    if (tradeFilter === 'LOSSES') return t.pnl <= 0;
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Strategy Configuration Deck */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white font-mono flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-500" />
                <span>Institutional Quant Backtesting Engine</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                WebWorker Pool ({quantWorkerPool.getPoolSize()} Threads)
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Vectorized Float64 execution running outside the main thread for high-speed multi-million candle backtests.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-slate-950 border border-neutral-200 dark:border-slate-800">
            <button
              onClick={() => setMode('single')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                mode === 'single'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Single Run
            </button>
            <button
              onClick={() => setMode('grid_optimization')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                mode === 'grid_optimization'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Parallel Grid Optimization
            </button>
          </div>
        </div>

        {/* Configuration Matrix Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Strategy Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-500 dark:text-slate-400 uppercase font-semibold">
              Algorithmic Strategy
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as BacktestStrategyType)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 text-xs font-mono text-neutral-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dataset Range & Timeframe */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-500 dark:text-slate-400 uppercase font-semibold">
              Dataset Size (Candles)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={datasetSize}
                onChange={(e) => setDatasetSize(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 text-xs font-mono text-neutral-900 dark:text-slate-100"
              >
                <option value={100000}>100K Bars</option>
                <option value={500000}>500K Bars</option>
                <option value={1000000}>1,000,000 Bars</option>
                <option value={3000000}>3,000,000 Bars</option>
                <option value={5000000}>5,000,000 Bars</option>
              </select>

              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                className="w-full px-2.5 py-2 rounded-xl bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 text-xs font-mono text-neutral-900 dark:text-slate-100"
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1H">1H</option>
                <option value="4H">4H</option>
                <option value="1D">1D</option>
              </select>
            </div>
          </div>

          {/* Capital & Sizing */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-500 dark:text-slate-400 uppercase font-semibold">
              Capital & Position Sizing
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Math.max(1000, Number(e.target.value)))}
                className="w-full px-2.5 py-2 rounded-xl bg-neutral-50 dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 text-xs font-mono text-neutral-900 dark:text-slate-100"
                placeholder="Initial $"
              />
              <div className="flex items-center gap-1 bg-neutral-50 dark:bg-slate-950 px-2 rounded-xl border border-neutral-200 dark:border-slate-800">
                <input
                  type="number"
                  value={positionSizePercent}
                  onChange={(e) => setPositionSizePercent(Math.min(100, Math.max(1, Number(e.target.value))))}
                  className="w-full py-2 bg-transparent text-xs font-mono text-neutral-900 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-[11px] font-mono text-neutral-400">%</span>
              </div>
            </div>
          </div>

          {/* Execution Friction (Fees & Slippage) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-500 dark:text-slate-400 uppercase font-semibold">
              Fee & Slippage Simulation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1 bg-neutral-50 dark:bg-slate-950 px-2 rounded-xl border border-neutral-200 dark:border-slate-800">
                <input
                  type="number"
                  step="0.01"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(Number(e.target.value))}
                  className="w-full py-2 bg-transparent text-xs font-mono text-neutral-900 dark:text-slate-100 focus:outline-none"
                  placeholder="Comm %"
                />
                <span className="text-[10px] font-mono text-neutral-400">fee%</span>
              </div>
              <div className="flex items-center gap-1 bg-neutral-50 dark:bg-slate-950 px-2 rounded-xl border border-neutral-200 dark:border-slate-800">
                <input
                  type="number"
                  step="0.1"
                  value={slippagePips}
                  onChange={(e) => setSlippagePips(Number(e.target.value))}
                  className="w-full py-2 bg-transparent text-xs font-mono text-neutral-900 dark:text-slate-100 focus:outline-none"
                  placeholder="Slip"
                />
                <span className="text-[10px] font-mono text-neutral-400">slip</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Parameter Sliders for Active Strategy */}
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-slate-950/60 border border-neutral-200/70 dark:border-slate-800/70 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-neutral-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <span>Strategy Hyperparameters</span>
            </div>
            <span className="text-[11px] text-neutral-500">
              {STRATEGIES.find((s) => s.id === strategy)?.desc}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {(strategy === 'ema_crossover' || strategy === 'dual_ma_atr' || strategy === 'multi_confluence') && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-neutral-500">Fast EMA Period</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{fastPeriod}</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={50}
                    value={fastPeriod}
                    onChange={(e) => setFastPeriod(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-neutral-500">Slow EMA Period</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{slowPeriod}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    value={slowPeriod}
                    onChange={(e) => setSlowPeriod(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </>
            )}

            {(strategy === 'rsi_mean_reversion' || strategy === 'multi_confluence') && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-neutral-500">RSI Oversold Level</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{oversold}</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={45}
                    value={oversold}
                    onChange={(e) => setOversold(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-neutral-500">RSI Overbought Level</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{overbought}</span>
                  </div>
                  <input
                    type="range"
                    min={55}
                    max={90}
                    value={overbought}
                    onChange={(e) => setOverbought(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-neutral-500">Stop Loss (ATR Multiplier)</span>
                <span className="font-bold text-rose-500">{stopLossAtr}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5.0}
                step={0.1}
                value={stopLossAtr}
                onChange={(e) => setStopLossAtr(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-neutral-500">Take Profit (ATR Multiplier)</span>
                <span className="font-bold text-emerald-500">{takeProfitAtr}x</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={10.0}
                step={0.2}
                value={takeProfitAtr}
                onChange={(e) => setTakeProfitAtr(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Action Controls & Progress Deck */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-neutral-200/70 dark:border-slate-800/70">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isRunning ? (
              <button
                onClick={mode === 'single' ? handleStartBacktest : handleStartGridOptimization}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-98"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{mode === 'single' ? 'Run High-Speed Backtest' : 'Launch Parallel Optimization'}</span>
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-mono font-bold text-sm shadow-lg shadow-rose-500/20 transition-all cursor-pointer active:scale-98"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Cancel Execution</span>
              </button>
            )}

            {isRunning && (
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Non-blocking WebWorker thread active...</span>
              </div>
            )}
          </div>

          {/* Real-Time Throttled Progress Telemetry */}
          {isRunning && progress && (
            <div className="w-full sm:max-w-md space-y-1.5 bg-neutral-50 dark:bg-slate-950 p-3 rounded-2xl border border-neutral-200 dark:border-slate-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-500">Progress: {progress.progressPercent}%</span>
                <span className="font-bold text-emerald-500">{progress.candlesPerSecond.toLocaleString()} candles/sec</span>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-100"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                <span>Processed: {progress.processedCandles.toLocaleString()} / {progress.totalCandles.toLocaleString()}</span>
                <span>Trades: {progress.processedTrades}</span>
                <span>Elapsed: {(progress.elapsedMs / 1000).toFixed(1)}s</span>
              </div>
            </div>
          )}

          {isRunning && gridProgress && (
            <div className="w-full sm:max-w-md space-y-1.5 bg-neutral-50 dark:bg-slate-950 p-3 rounded-2xl border border-neutral-200 dark:border-slate-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-500">
                  Optimization: {gridProgress.completed} / {gridProgress.total} Sets
                </span>
                <span className="font-bold text-violet-400">
                  Best Sharpe: {gridProgress.best?.sharpeRatio.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-100"
                  style={{ width: `${(gridProgress.completed / gridProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Deck (Single Run) */}
      {result && (
        <div className="space-y-6">
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-[10px] uppercase font-mono text-neutral-500">Total Net Return</div>
              <div className={`text-xl font-bold font-mono ${result.totalReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toLocaleString()}
              </div>
              <div className="text-[11px] font-mono text-neutral-400 font-semibold">
                {result.totalReturnPercent >= 0 ? '+' : ''}{result.totalReturnPercent.toFixed(2)}%
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-[10px] uppercase font-mono text-neutral-500">Sharpe Ratio</div>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                {result.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                Sortino: {result.sortinoRatio.toFixed(2)}
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-[10px] uppercase font-mono text-neutral-500">Win Rate</div>
              <div className="text-xl font-bold font-mono text-emerald-500">
                {result.winRate.toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                {result.winningTrades}W / {result.losingTrades}L ({result.totalTrades} total)
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-[10px] uppercase font-mono text-neutral-500">Max Drawdown</div>
              <div className="text-xl font-bold font-mono text-rose-500">
                -{result.maxDrawdownPercent.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                -${result.maxDrawdown.toLocaleString()}
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-[10px] uppercase font-mono text-neutral-500">Profit Factor</div>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                {result.profitFactor.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                Expectancy: ${result.expectancy.toFixed(0)}
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-1">
              <div className="text-[10px] uppercase font-mono text-neutral-500">Execution Speed</div>
              <div className="text-xl font-bold font-mono text-cyan-500">
                {(result.candlesPerSecond / 1000).toFixed(0)}k/s
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                {result.totalCandles.toLocaleString()} bars in {result.executionTimeMs}ms
              </div>
            </div>
          </div>

          {/* Interactive Equity & Drawdown Chart */}
          <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-neutral-900 dark:text-white">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Authoritative Equity Curve & Drawdown Profile</span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                Final Equity: ${result.finalCapital.toLocaleString()}
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(time) => new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 10, fill: '#888' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10, fill: '#888' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Equity']}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#equityGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade Execution Audit Log */}
          <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-neutral-900 dark:text-white">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>Trade Execution Ledger ({filteredTrades.length} Trades)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTradeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    tradeFilter === 'ALL' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  All ({result.trades.length})
                </button>
                <button
                  onClick={() => setTradeFilter('WINS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    tradeFilter === 'WINS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-500 hover:text-emerald-400'
                  }`}
                >
                  Wins ({result.winningTrades})
                </button>
                <button
                  onClick={() => setTradeFilter('LOSSES')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    tradeFilter === 'LOSSES' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-neutral-500 hover:text-rose-400'
                  }`}
                >
                  Losses ({result.losingTrades})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-slate-800 text-neutral-400 text-[10px] uppercase">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Side</th>
                    <th className="py-2.5 px-3">Entry Time</th>
                    <th className="py-2.5 px-3">Exit Time</th>
                    <th className="py-2.5 px-3">Entry Price</th>
                    <th className="py-2.5 px-3">Exit Price</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Exit Reason</th>
                    <th className="py-2.5 px-3 text-right">Net P&L ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-800/60">
                  {filteredTrades.slice(0, 100).map((t, idx) => (
                    <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-neutral-400">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.side === 'LONG'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-neutral-500">
                        {new Date(t.entryTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-neutral-500">
                        {new Date(t.exitTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-neutral-300">${t.entryPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-neutral-300">${t.exitPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-neutral-400">{t.durationBars} bars</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-slate-800 text-neutral-700 dark:text-slate-300">
                          {t.exitReason}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)} ({t.pnlPercent.toFixed(2)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTrades.length > 100 && (
                <div className="text-center py-2 text-xs font-mono text-neutral-500 border-t border-slate-800">
                  Showing first 100 of {filteredTrades.length} trades
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid Optimization Leaderboard */}
      {mode === 'grid_optimization' && gridResults.length > 0 && (
        <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-sm font-bold text-neutral-900 dark:text-white">
              <Award className="w-4 h-4 text-violet-400" />
              <span>Hyperparameter Optimization Leaderboard (Sorted by Sharpe Ratio)</span>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              Evaluated {gridResults.length} parameter permutations across {quantWorkerPool.getPoolSize()} workers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-slate-800 text-neutral-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Parameters</th>
                  <th className="py-2.5 px-3">Sharpe Ratio</th>
                  <th className="py-2.5 px-3">Total Return</th>
                  <th className="py-2.5 px-3">Win Rate</th>
                  <th className="py-2.5 px-3">Max Drawdown</th>
                  <th className="py-2.5 px-3">Profit Factor</th>
                  <th className="py-2.5 px-3">Trades</th>
                  <th className="py-2.5 px-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-800/60">
                {gridResults.map((item, idx) => (
                  <tr key={item.id} className={idx === 0 ? 'bg-violet-500/10 font-bold' : 'hover:bg-neutral-50 dark:hover:bg-slate-800/30'}>
                    <td className="py-2.5 px-3">
                      {idx === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-violet-500 text-white text-[10px]">#1 BEST</span>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-300">
                      {Object.entries(item.params)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(', ')}
                    </td>
                    <td className="py-2.5 px-3 text-violet-400 font-bold">{item.sharpeRatio.toFixed(2)}</td>
                    <td className={`py-2.5 px-3 font-bold ${item.totalReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.totalReturnPercent >= 0 ? '+' : ''}{item.totalReturnPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">{item.winRate.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-rose-400">-{item.maxDrawdownPercent.toFixed(2)}%</td>
                    <td className="py-2.5 px-3">{item.profitFactor.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{item.totalTrades}</td>
                    <td className="py-2.5 px-3 text-neutral-500">{item.executionTimeMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
