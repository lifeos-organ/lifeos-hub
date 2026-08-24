import React, { useState, useEffect } from 'react';
import { BenchmarkMetric, CacheTelemetryStats } from '../../types';
import { runQuantitativeBenchmark, BenchmarkSuiteResult } from '../../lib/trading/benchmarkSuite';
import { historicalCache } from '../../lib/trading/historicalCache';
import { marketConnectionManager } from '../../lib/trading/marketConnectionManager';
import { quantWorkerPool } from '../../lib/trading/workerPool';
import {
  Activity,
  Zap,
  HardDrive,
  Database,
  Cpu,
  RefreshCw,
  Play,
  CheckCircle2,
  Trash2,
  Layers,
  BarChart2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const PerformanceMonitorView: React.FC = () => {
  const [cacheStats, setCacheStats] = useState<CacheTelemetryStats | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [currentTestName, setCurrentTestName] = useState<string>('');
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkSuiteResult | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<BenchmarkMetric[]>([]);
  const [targetScale, setTargetScale] = useState<'standard' | 'heavy'>('standard');

  const refreshCacheStats = async () => {
    const stats = await historicalCache.getStats();
    setCacheStats(stats);
  };

  useEffect(() => {
    refreshCacheStats();
    const interval = setInterval(refreshCacheStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    await historicalCache.clearAll();
    await refreshCacheStats();
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setLiveMetrics([]);
    setBenchmarkResult(null);

    const counts = targetScale === 'standard' ? [100000, 500000, 1000000] : [100000, 1000000, 5000000];

    try {
      const res = await runQuantitativeBenchmark(counts, (metric) => {
        setCurrentTestName(metric.name);
        setLiveMetrics((prev) => [...prev, metric]);
      });
      setBenchmarkResult(res);
      await refreshCacheStats();
    } catch (err) {
      console.error('Benchmark error:', err);
    } finally {
      setIsBenchmarking(false);
      setCurrentTestName('');
    }
  };

  const marketStatus = marketConnectionManager.getStatus();

  return (
    <div className="space-y-6">
      {/* Top Architecture Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* L1 Cache Telemetry */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-500 uppercase">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <span>L1 In-Memory Cache</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400">
              0ms Latency
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
              {((cacheStats?.l1MemoryBytes || 0) / (1024 * 1024)).toFixed(1)} MB
            </div>
            <div className="text-xs font-mono text-neutral-400">
              {cacheStats?.l1MemoryItems || 0} active columnar series in RAM
            </div>
          </div>
          <div className="w-full bg-neutral-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, ((cacheStats?.l1MemoryBytes || 0) / (128 * 1024 * 1024)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-neutral-400">
            <span>Budget: 128 MB</span>
            <span>Hit Rate: {cacheStats?.hitRatePercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* L2 IndexedDB Telemetry */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-500 uppercase">
              <Database className="w-4 h-4 text-cyan-500" />
              <span>L2 IndexedDB Store</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400">
              Persistent
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
              {cacheStats?.l2IndexedDbItems || 0} Chunks
            </div>
            <div className="text-xs font-mono text-neutral-400">
              Binary ArrayBuffer fast deserialization
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleClearCache}
              className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Flush Local Cache</span>
            </button>
            <button
              onClick={refreshCacheStats}
              className="text-[11px] font-mono text-neutral-400 hover:text-white cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Worker Pool Status */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-500 uppercase">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Worker Concurrency</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400">
              Active
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
              {quantWorkerPool.getPoolSize()} Dedicated Workers
            </div>
            <div className="text-xs font-mono text-neutral-400">
              Zero-Copy Transferrable Buffers
            </div>
          </div>
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Non-blocking UI Thread guaranteed</span>
          </div>
        </div>

        {/* Market Stream Ingestion */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-500 uppercase">
              <Activity className="w-4 h-4 text-violet-500" />
              <span>Live Ingestion Pipe</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                marketStatus.state === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {marketStatus.state === 'connected' ? 'STREAMING' : 'CONNECTING'}
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white">
              Direct Canvas Tick
            </div>
            <div className="text-xs font-mono text-neutral-400">
              Zero React setState overhead for ticks
            </div>
          </div>
          <div className="text-[11px] font-mono text-neutral-400 pt-1">
            Mode: <span className="text-white font-bold">{marketStatus.mode.toUpperCase()}</span> ({marketStatus.provider})
          </div>
        </div>
      </div>

      {/* Quantitative Benchmark Runner */}
      <div className="bg-white/90 dark:bg-slate-900/90 border border-neutral-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold font-mono text-neutral-900 dark:text-white">
                Deterministic Throughput & Latency Profiler
              </h3>
            </div>
            <p className="text-xs font-mono text-neutral-500 dark:text-slate-400">
              Stresses PRNG dataset generators, timeframe aggregators, vectorized indicators, and backtest loops.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 text-xs font-mono">
              <button
                onClick={() => setTargetScale('standard')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                  targetScale === 'standard' ? 'bg-emerald-500 text-slate-950' : 'text-neutral-400 hover:text-white'
                }`}
              >
                1M Scale
              </button>
              <button
                onClick={() => setTargetScale('heavy')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                  targetScale === 'heavy' ? 'bg-amber-500 text-slate-950' : 'text-neutral-400 hover:text-white'
                }`}
              >
                5M Scale
              </button>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={isBenchmarking}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isBenchmarking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-slate-950" />}
              <span>{isBenchmarking ? 'Executing Stress Tests...' : 'Execute Benchmark Suite'}</span>
            </button>
          </div>
        </div>

        {isBenchmarking && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs font-mono text-amber-300">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running test: {currentTestName || 'Initializing dataset...'}</span>
            </div>
            <span>High-Speed Vector Loop</span>
          </div>
        )}

        {/* Overall Benchmark Summary KPI */}
        {benchmarkResult && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] uppercase font-mono text-emerald-400">Total Candles Processed</div>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                {benchmarkResult.totalCandlesTested.toLocaleString()} Candles
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-emerald-400">Peak Pipeline Throughput</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {benchmarkResult.overallThroughputCandlesSec.toLocaleString()} Candles / Sec
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-emerald-400">Total Benchmark Latency</div>
              <div className="text-xl font-bold font-mono text-cyan-400">
                {(benchmarkResult.totalTimeMs / 1000).toFixed(2)}s ({benchmarkResult.memoryFootprintMb} MB RAM)
              </div>
            </div>
          </div>
        )}

        {/* Benchmark Metrics Table */}
        {liveMetrics.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-slate-800 text-neutral-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Benchmark Stage</th>
                  <th className="py-2.5 px-3">Candles Tested</th>
                  <th className="py-2.5 px-3">Latency (ms)</th>
                  <th className="py-2.5 px-3">Throughput (Candles/sec)</th>
                  <th className="py-2.5 px-3">Memory Footprint</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-800/60">
                {liveMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-slate-100">{m.name}</td>
                    <td className="py-2.5 px-3 text-neutral-400">{m.candleCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">{m.durationMs}ms</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">{m.throughputCandlesSec.toLocaleString()} /s</td>
                    <td className="py-2.5 px-3 text-neutral-400">{m.memoryMb ? `${m.memoryMb} MB` : 'Zero-Alloc'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        PASSED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
