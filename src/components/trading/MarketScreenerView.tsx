import React, { useState, useMemo } from 'react';
import { MarketSymbol, AssetCategory } from '../../types';
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpDown,
  Sparkles,
  Sliders,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/Button';

interface MarketScreenerViewProps {
  symbols: MarketSymbol[];
  onSelectSymbol: (symbol: MarketSymbol) => void;
}

type FilterPreset = 'all' | 'oversold_rsi' | 'overbought_rsi' | 'bullish_momentum' | 'high_volume_gainers' | 'high_volatility';

export const MarketScreenerView: React.FC<MarketScreenerViewProps> = ({
  symbols,
  onSelectSymbol,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activePreset, setActivePreset] = useState<FilterPreset>('all');
  const [sortField, setSortField] = useState<'change24hPercent' | 'volume24h' | 'currentPrice' | 'symbol'>('change24hPercent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Augmented metrics calculation for screener
  const screenedData = useMemo(() => {
    return symbols.map((sym) => {
      // Deterministic synthetic technical indicators based on price action for screener
      const seed = sym.symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const isPositive = sym.change24hPercent >= 0;
      const rsi = Math.min(88, Math.max(18, Math.round(50 + (sym.change24hPercent * 3.5) + (seed % 15 - 7))));
      const atrPercent = Number((Math.abs(sym.high24h - sym.low24h) / sym.currentPrice * 100).toFixed(2));
      const trend = sym.change24hPercent > 1.5 ? 'BULLISH' : sym.change24hPercent < -1.5 ? 'BEARISH' : 'NEUTRAL';
      const volumeScore = sym.volume24h > 1000000 ? 'HIGH' : 'NORMAL';

      return {
        ...sym,
        rsi,
        atrPercent,
        trend,
        volumeScore,
      };
    });
  }, [symbols]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    return screenedData
      .filter((item) => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch =
          item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesPreset = true;
        if (activePreset === 'oversold_rsi') matchesPreset = item.rsi <= 35;
        if (activePreset === 'overbought_rsi') matchesPreset = item.rsi >= 65;
        if (activePreset === 'bullish_momentum') matchesPreset = item.trend === 'BULLISH';
        if (activePreset === 'high_volume_gainers') matchesPreset = item.change24hPercent > 2;
        if (activePreset === 'high_volatility') matchesPreset = item.atrPercent > 3;

        return matchesCategory && matchesSearch && matchesPreset;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'change24hPercent') diff = a.change24hPercent - b.change24hPercent;
        if (sortField === 'volume24h') diff = a.volume24h - b.volume24h;
        if (sortField === 'currentPrice') diff = a.currentPrice - b.currentPrice;
        if (sortField === 'symbol') diff = a.symbol.localeCompare(b.symbol);

        return sortDirection === 'desc' ? -diff : diff;
      });
  }, [screenedData, selectedCategory, searchQuery, activePreset, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Top Banner & Screener Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-slate-100 flex items-center gap-2">
              Cross-Market Quantitative Screener
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                LIVE SCAN
              </span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Filter assets across Equities, Forex, Crypto, Indices, and Commodities using technical indicator rules.
            </p>
          </div>
        </div>

        {/* Search & Presets */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter by symbol or asset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-neutral-100 dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 text-neutral-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Strategy Presets */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {['All', 'Crypto', 'Forex', 'Stocks', 'Indices', 'Commodities'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-neutral-600 dark:text-slate-400 border border-neutral-200 dark:border-slate-800 hover:bg-neutral-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <span className="text-[11px] font-semibold text-neutral-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Presets:
          </span>
          {[
            { id: 'all', label: 'All Items' },
            { id: 'bullish_momentum', label: '🚀 Bullish Momentum' },
            { id: 'oversold_rsi', label: '📉 RSI < 35 (Oversold)' },
            { id: 'overbought_rsi', label: '📈 RSI > 65 (Overbought)' },
            { id: 'high_volume_gainers', label: '🔥 High Volume Gainers' },
            { id: 'high_volatility', label: '⚡ High ATR Volatility' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset.id as FilterPreset)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                activePreset === preset.id
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-100 dark:bg-slate-900 text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Screened Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100/75 dark:bg-slate-900/60 border-b border-neutral-200 dark:border-slate-800 text-neutral-500 dark:text-slate-400 font-semibold">
              <tr>
                <th
                  onClick={() => handleSort('symbol')}
                  className="py-3 px-4 cursor-pointer hover:text-neutral-900 dark:hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>Symbol / Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Category</th>
                <th
                  onClick={() => handleSort('currentPrice')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900 dark:hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Last Price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('change24hPercent')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900 dark:hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>24h Change</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">RSI (14)</th>
                <th className="py-3 px-3 text-center">Technical Trend</th>
                <th className="py-3 px-3 text-center">ATR (14) Volatility</th>
                <th
                  onClick={() => handleSort('volume24h')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900 dark:hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>24h Volume</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-900 font-medium">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    No symbols match the selected screener criteria. Try broadening your filter presets.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((item) => {
                  const isPositive = item.change24hPercent >= 0;
                  return (
                    <tr
                      key={item.symbol}
                      onClick={() => onSelectSymbol(item)}
                      className="hover:bg-neutral-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 flex items-center justify-center font-bold text-xs text-neutral-900 dark:text-slate-100">
                            {item.symbol.substring(0, 3)}
                          </div>
                          <div>
                            <div className="font-bold text-neutral-900 dark:text-slate-100 flex items-center gap-1.5">
                              {item.symbol}
                            </div>
                            <div className="text-[11px] text-neutral-400 dark:text-slate-500 truncate max-w-[140px]">
                              {item.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-100 dark:bg-slate-900 text-neutral-600 dark:text-slate-400 border border-neutral-200 dark:border-slate-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-slate-100">
                        ${item.currentPrice.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: item.decimals,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isPositive ? '+' : ''}
                            {item.change24hPercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.rsi >= 70
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : item.rsi <= 30
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-neutral-100 dark:bg-slate-900 text-neutral-600 dark:text-slate-400'
                          }`}
                        >
                          {item.rsi}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.trend === 'BULLISH'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : item.trend === 'BEARISH'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-neutral-100 dark:bg-slate-900 text-neutral-400'
                          }`}
                        >
                          {item.trend}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-neutral-600 dark:text-slate-400">
                        {item.atrPercent}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-500 dark:text-slate-400">
                        ${(item.volume24h / 1000000).toFixed(2)}M
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSymbol(item);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                          <span>Open Chart</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
