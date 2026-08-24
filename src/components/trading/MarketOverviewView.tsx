import React, { useState } from 'react';
import { MarketSymbol, EconomicEvent, MarketNewsItem } from '../../types';
import {
  Globe,
  Calendar,
  Newspaper,
  TrendingUp,
  TrendingDown,
  Flame,
  Clock,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Tag,
} from 'lucide-react';

interface MarketOverviewViewProps {
  symbols: MarketSymbol[];
  onSelectSymbol: (symbol: MarketSymbol) => void;
}

const INITIAL_ECONOMIC_EVENTS: EconomicEvent[] = [
  {
    id: 'eco-1',
    title: 'FOMC Federal Funds Rate Decision & Statement',
    currency: 'USD',
    country: 'United States',
    impact: 'HIGH',
    time: '18:00 UTC',
    date: 'Today',
    actual: '5.25%',
    forecast: '5.25%',
    previous: '5.50%',
  },
  {
    id: 'eco-2',
    title: 'Core Consumer Price Index (YoY CPI)',
    currency: 'USD',
    country: 'United States',
    impact: 'HIGH',
    time: '12:30 UTC',
    date: 'Tomorrow',
    forecast: '2.8%',
    previous: '2.9%',
  },
  {
    id: 'eco-3',
    title: 'ECB Monetary Policy Meeting Accounts',
    currency: 'EUR',
    country: 'Eurozone',
    impact: 'HIGH',
    time: '11:30 UTC',
    date: 'Tomorrow',
    forecast: '3.75%',
    previous: '3.75%',
  },
  {
    id: 'eco-4',
    title: 'Bank of Japan (BOJ) Core CPI',
    currency: 'JPY',
    country: 'Japan',
    impact: 'MEDIUM',
    time: '05:00 UTC',
    date: 'In 2 Days',
    forecast: '2.2%',
    previous: '2.1%',
  },
  {
    id: 'eco-5',
    title: 'Crude Oil Inventories (EIA)',
    currency: 'USD',
    country: 'United States',
    impact: 'MEDIUM',
    time: '14:30 UTC',
    date: 'In 3 Days',
    forecast: '-1.2M',
    previous: '+2.1M',
  },
];

const INITIAL_MARKET_NEWS: MarketNewsItem[] = [
  {
    id: 'news-1',
    title: 'Global Liquidity Expansion Spurs Multi-Asset Breakout Across Equities and Digital Assets',
    summary: 'Institutional capital inflows accelerate as macro conditions align with central bank rate easing cycles and strong corporate balance sheets.',
    source: 'Financial Times Intelligence',
    timestamp: '14m ago',
    symbols: ['BTC/USD', 'SPX500', 'ETH/USD'],
    sentiment: 'BULLISH',
  },
  {
    id: 'news-2',
    title: 'Semiconductor Index Reclaims Key Macro Trendline on Next-Gen Tensor Processor Demand',
    summary: 'Strong earnings momentum across hardware foundries and enterprise hyperscalers drives broad tech sector outperformance.',
    source: 'Bloomberg Markets',
    timestamp: '42m ago',
    symbols: ['NVDA', 'AAPL', 'NDX100'],
    sentiment: 'BULLISH',
  },
  {
    id: 'news-3',
    title: 'Gold Tests All-Time Highs Amid Sovereign Reserve Accumulation and De-Dollarization Flows',
    summary: 'Central bank purchases remain steady through Q3 as physical bullion demand offsets treasury yield fluctuations.',
    source: 'Reuters Commodities',
    timestamp: '1h ago',
    symbols: ['XAU/USD', 'EUR/USD'],
    sentiment: 'BULLISH',
  },
  {
    id: 'news-4',
    title: 'Crude Oil Volatility Compresses Near Key Supply Zone Following OPEC+ Production Review',
    summary: 'Energy futures consolidate within a defined multi-week range as refining margins stabilize globally.',
    source: 'Wall Street Journal',
    timestamp: '2h ago',
    symbols: ['WTI_OIL', 'USDCAD'],
    sentiment: 'NEUTRAL',
  },
];

export const MarketOverviewView: React.FC<MarketOverviewViewProps> = ({
  symbols,
  onSelectSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'news'>('overview');
  const [calendarImpactFilter, setCalendarImpactFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');

  // Movers
  const gainers = [...symbols].sort((a, b) => b.change24hPercent - a.change24hPercent).slice(0, 4);
  const losers = [...symbols].sort((a, b) => a.change24hPercent - b.change24hPercent).slice(0, 4);
  const volumeLeaders = [...symbols].sort((a, b) => b.volume24h - a.volume24h).slice(0, 4);

  const filteredEvents = INITIAL_ECONOMIC_EVENTS.filter((ev) => {
    if (calendarImpactFilter === 'ALL') return true;
    return ev.impact === calendarImpactFilter;
  });

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-slate-100 flex items-center gap-2">
              Macro Intelligence & Market Overview
            </h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Cross-asset market performance, real-time economic calendar, and institutional news flow.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-slate-900 border border-neutral-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-950 text-neutral-900 dark:text-slate-100 shadow-xs'
                : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Market Movers</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-slate-950 text-neutral-900 dark:text-slate-100 shadow-xs'
                : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-500" />
            <span>Economic Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'news'
                ? 'bg-white dark:bg-slate-950 text-neutral-900 dark:text-slate-100 shadow-xs'
                : 'text-neutral-500 dark:text-slate-400 hover:text-neutral-900'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5 text-emerald-500" />
            <span>Market News</span>
          </button>
        </div>
      </div>

      {/* VIEW: Overview & Movers */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 3-Column Movers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top Gainers */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-neutral-900 dark:text-slate-100">
                    Top Gainers (24h)
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                {gainers.map((s) => (
                  <div
                    key={s.symbol}
                    onClick={() => onSelectSymbol(s)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer border border-transparent hover:border-neutral-200 dark:hover:border-slate-800"
                  >
                    <div>
                      <div className="font-bold text-xs text-neutral-900 dark:text-slate-100 font-mono">
                        {s.symbol}
                      </div>
                      <div className="text-[10px] text-neutral-400">{s.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-neutral-900 dark:text-slate-100">
                        ${s.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{s.change24hPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-neutral-900 dark:text-slate-100">
                    Top Losers (24h)
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                {losers.map((s) => (
                  <div
                    key={s.symbol}
                    onClick={() => onSelectSymbol(s)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer border border-transparent hover:border-neutral-200 dark:hover:border-slate-800"
                  >
                    <div>
                      <div className="font-bold text-xs text-neutral-900 dark:text-slate-100 font-mono">
                        {s.symbol}
                      </div>
                      <div className="text-[10px] text-neutral-400">{s.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-neutral-900 dark:text-slate-100">
                        ${s.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                        {s.change24hPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Volume Leaders */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-neutral-900 dark:text-slate-100">
                    Volume Leaders (24h)
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                {volumeLeaders.map((s) => (
                  <div
                    key={s.symbol}
                    onClick={() => onSelectSymbol(s)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-900/60 transition-colors cursor-pointer border border-transparent hover:border-neutral-200 dark:hover:border-slate-800"
                  >
                    <div>
                      <div className="font-bold text-xs text-neutral-900 dark:text-slate-100 font-mono">
                        {s.symbol}
                      </div>
                      <div className="text-[10px] text-neutral-400">{s.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-neutral-900 dark:text-slate-100">
                        ${(s.volume24h / 1000000).toFixed(2)}M
                      </div>
                      <div
                        className={`text-xs font-mono font-bold ${
                          s.change24hPercent >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {s.change24hPercent >= 0 ? '+' : ''}
                        {s.change24hPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Economic Calendar */}
      {activeTab === 'calendar' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-neutral-100 dark:border-slate-900">
            <div className="text-sm font-bold text-neutral-900 dark:text-slate-100">
              High-Impact Macroeconomic Events
            </div>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'HIGH', 'MEDIUM'] as const).map((impact) => (
                <button
                  key={impact}
                  onClick={() => setCalendarImpactFilter(impact)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    calendarImpactFilter === impact
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                      : 'bg-neutral-100 dark:bg-slate-900 text-neutral-500'
                  }`}
                >
                  {impact} IMPACT
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-slate-900">
            {filteredEvents.map((ev) => (
              <div key={ev.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      ev.impact === 'HIGH'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}
                  >
                    {ev.impact}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-slate-900 font-mono text-xs font-bold text-neutral-800 dark:text-slate-200">
                    {ev.currency}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-slate-100">
                      {ev.title}
                    </div>
                    <div className="text-[11px] text-neutral-400">{ev.country} • {ev.date} at {ev.time}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
                  {ev.actual && (
                    <div>
                      <span className="text-neutral-400 text-[10px] block">Actual</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{ev.actual}</span>
                    </div>
                  )}
                  {ev.forecast && (
                    <div>
                      <span className="text-neutral-400 text-[10px] block">Forecast</span>
                      <span className="font-semibold text-neutral-700 dark:text-slate-300">{ev.forecast}</span>
                    </div>
                  )}
                  {ev.previous && (
                    <div>
                      <span className="text-neutral-400 text-[10px] block">Previous</span>
                      <span className="text-neutral-500 dark:text-slate-400">{ev.previous}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: Market News */}
      {activeTab === 'news' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INITIAL_MARKET_NEWS.map((news) => (
            <div
              key={news.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                    {news.source}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                    <Clock className="w-3 h-3" />
                    <span>{news.timestamp}</span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-slate-100 leading-snug">
                  {news.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400 leading-relaxed">
                  {news.summary}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-slate-900">
                <div className="flex items-center gap-1.5">
                  {news.symbols.map((sym) => (
                    <span
                      key={sym}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-100 dark:bg-slate-900 text-neutral-700 dark:text-slate-300 font-semibold"
                    >
                      {sym}
                    </span>
                  ))}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    news.sentiment === 'BULLISH'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : news.sentiment === 'BEARISH'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-neutral-100 dark:bg-slate-900 text-neutral-400'
                  }`}
                >
                  {news.sentiment}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
