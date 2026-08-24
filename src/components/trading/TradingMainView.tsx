import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MarketSymbol,
  CandleStick,
  Timeframe,
  ChartType,
  DrawingToolType,
  ChartDrawing,
  IndicatorConfig,
  ActiveOrder,
  TradeJournalEntry,
  BrokerAccount,
  BrokerPosition,
  BrokerOrder,
  NewBrokerOrder,
  MarketStatus,
  Quote,
  TradingAlert,
} from '../../types';
import { INITIAL_SYMBOLS } from '../../lib/tradingData';
import { Storage } from '../../lib/storage';
import { MarketDataManager } from '../../lib/marketData/MarketDataManager';
import { BrokerManager } from '../../lib/broker/BrokerManager';
import { TradingHeader, TradingTabType } from './TradingHeader';
import { TradingWatchlist } from './TradingWatchlist';
import { TradingChartCanvas } from './TradingChartCanvas';
import { DrawingToolbar } from './DrawingToolbar';
import { IndicatorsModal } from './IndicatorsModal';
import { ReplayControlDeck } from './ReplayControlDeck';
import { OpenPositionsTable } from './OpenPositionsTable';
import { PositionCalculatorModal } from './PositionCalculatorModal';
import { TradeJournalView } from './TradeJournalView';
import { AITradingCoachView } from './AITradingCoachView';
import { LiveOrderConfirmationModal } from './LiveOrderConfirmationModal';
import { BacktesterView } from './BacktesterView';
import { PerformanceMonitorView } from './PerformanceMonitorView';
import { AlertsManagerModal } from './AlertsManagerModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { MarketScreenerView } from './MarketScreenerView';
import { MarketOverviewView } from './MarketOverviewView';
import { MultiChartLayout } from './MultiChartLayout';
import { Sparkles, LayoutGrid, Square, BellRing } from 'lucide-react';

export const TradingMainView: React.FC = () => {
  // 1. Initial State
  const [symbols, setSymbols] = useState<MarketSymbol[]>(() => Storage.getTradingSymbols());
  const [currentSymbol, setCurrentSymbol] = useState<MarketSymbol>(() => symbols[0] || INITIAL_SYMBOLS[0]);
  const [activeTab, setActiveTab] = useState<TradingTabType>('terminal');

  // Chart configuration
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [indicators, setIndicators] = useState<IndicatorConfig>({
    ema9: true,
    ema21: true,
    ema50: false,
    ema200: false,
    bollingerBands: false,
    vwap: true,
    rsi: true,
    macd: false,
    volume: true,
  });
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isMultiChartEnabled, setIsMultiChartEnabled] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<TradingAlert[]>(() => Storage.getTradingAlerts());
  const alertsRef = useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const reloadAlerts = useCallback(() => {
    const updated = Storage.getTradingAlerts();
    setAlerts(updated);
  }, []);

  // Drawing tools
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>('cursor');
  const [drawings, setDrawings] = useState<ChartDrawing[]>(() => Storage.getChartDrawings(currentSymbol.symbol));
  const [isMagnetEnabled, setIsMagnetEnabled] = useState(true);

  // Candlestick dataset
  const [candles, setCandles] = useState<CandleStick[]>([]);
  const [isLoadingBars, setIsLoadingBars] = useState(false);

  // Replay Engine State
  const [replayIndex, setReplayIndex] = useState<number>(100);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);

  // Market & Broker State
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(() => MarketDataManager.getStatus());
  const [account, setAccount] = useState<BrokerAccount>({
    accountId: 'pap_act_8801',
    brokerName: 'Institutional Paper Engine',
    mode: 'PAPER',
    equity: 100000.0,
    cash: 100000.0,
    buyingPower: 200000.0,
    initialCapital: 100000.0,
    currency: 'USD',
    realizedPnl: 0,
    unrealizedPnl: 0,
    marginUsed: 0,
    dayTradesRemaining: 99,
    status: 'ACTIVE',
    lastSyncTime: Date.now(),
  });
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [journal, setJournal] = useState<TradeJournalEntry[]>(() => Storage.getTradeJournal());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Order Confirmation Modal State
  const [pendingOrder, setPendingOrder] = useState<NewBrokerOrder | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.code === 'Space' && activeTab === 'replay') {
        e.preventDefault();
        setIsReplayPlaying((prev) => !prev);
      } else if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        setActiveDrawingTool('trendline');
        showToast('Tool: Trendline');
      } else if (e.altKey && e.code === 'KeyH') {
        e.preventDefault();
        setActiveDrawingTool('horizontal');
        showToast('Tool: Horizontal Ray');
      } else if (e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        setActiveDrawingTool('fibonacci');
        showToast('Tool: Fibonacci Retracement');
      } else if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        setActiveDrawingTool('rectangle');
        showToast('Tool: Rectangle Zone');
      } else if (e.altKey && e.code === 'KeyI') {
        e.preventDefault();
        setIsIndicatorsModalOpen(true);
      } else if (e.altKey && e.code === 'KeyA') {
        e.preventDefault();
        setIsAlertsModalOpen(true);
      } else if (e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        setIsCalculatorModalOpen(true);
      } else if (e.altKey && e.code === 'KeyM') {
        e.preventDefault();
        setIsMultiChartEnabled((prev) => !prev);
      } else if (e.key === 'Escape') {
        setActiveDrawingTool('cursor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showToast]);

  // Connect Market Data & Broker on mount
  useEffect(() => {
    MarketDataManager.connect();
    const unsubStatus = MarketDataManager.subscribeStatus((st) => setMarketStatus(st));

    const syncBroker = async () => {
      const acc = await BrokerManager.getAccount();
      const pos = await BrokerManager.getPositions();
      const ord = await BrokerManager.getOrders();
      setAccount(acc);
      setPositions(pos);
      setOrders(ord);
    };
    syncBroker();
    const unsubBroker = BrokerManager.subscribe(() => syncBroker());

    return () => {
      unsubStatus();
      unsubBroker();
    };
  }, []);

  // Fetch historical bars for active symbol & timeframe
  const loadHistoricalBars = useCallback(async () => {
    setIsLoadingBars(true);
    try {
      const bars = await MarketDataManager.getHistoricalBars(currentSymbol.symbol, timeframe, 140);
      if (bars && bars.length > 0) {
        setCandles(bars);
        setReplayIndex(Math.floor(bars.length * 0.75));
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingBars(false);
    }
  }, [currentSymbol.symbol, timeframe]);

  useEffect(() => {
    loadHistoricalBars();
    setDrawings(Storage.getChartDrawings(currentSymbol.symbol));
    setIsReplayPlaying(false);
  }, [loadHistoricalBars, currentSymbol.symbol]);

  const currentSymbolRef = useRef(currentSymbol.symbol);
  useEffect(() => {
    currentSymbolRef.current = currentSymbol.symbol;
  }, [currentSymbol.symbol]);

  // Subscribe to real-time Quotes for all symbols
  useEffect(() => {
    const symbolList = INITIAL_SYMBOLS.map((s) => s.symbol);
    const unsubQuotes = MarketDataManager.subscribeQuotes(symbolList, (quote: Quote) => {
      // Update symbols array in state
      setSymbols((prev) =>
        prev.map((s) => {
          if (s.symbol === quote.symbol) {
            return {
              ...s,
              currentPrice: quote.price,
              change24h: quote.change24h,
              change24hPercent: quote.change24hPercent,
              high24h: quote.high24h,
              low24h: quote.low24h,
              volume24h: quote.volume24h,
            };
          }
          return s;
        })
      );

      // If active symbol quote, update active candle & active symbol
      if (quote.symbol === currentSymbolRef.current) {
        setCurrentSymbol((prev) => {
          if (prev.symbol !== quote.symbol) return prev;
          return {
            ...prev,
            currentPrice: quote.price,
            change24h: quote.change24h,
            change24hPercent: quote.change24hPercent,
            high24h: quote.high24h,
            low24h: quote.low24h,
            volume24h: quote.volume24h,
          };
        });

        setCandles((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          const updatedLast: CandleStick = {
            ...last,
            close: quote.price,
            high: Math.max(last.high, quote.price),
            low: Math.min(last.low, quote.price),
          };
          return [...prev.slice(0, -1), updatedLast];
        });

        // Check active alerts for this symbol
        const activeAlerts = alertsRef.current.filter(
          (a) => a.active && !a.triggered && a.symbol === quote.symbol
        );
        for (const al of activeAlerts) {
          let isTriggered = false;
          if (al.type === 'price_above' && quote.price >= al.targetValue) {
            isTriggered = true;
          } else if (al.type === 'price_below' && quote.price <= al.targetValue) {
            isTriggered = true;
          }
          if (isTriggered) {
            Storage.updateTradingAlert(al.id, {
              triggered: true,
              triggeredAt: Date.now(),
              active: al.recurring,
            });
            reloadAlerts();
            showToast(`🔔 ALERT: ${al.symbol} reached target price $${al.targetValue}`);
          }
        }
      }

      // Update positions unrealized PnL in broker
      const map = new Map<string, number>();
      map.set(quote.symbol, quote.price);
      BrokerManager.updateMarketQuotes(map);
    });

    return () => {
      unsubQuotes();
    };
  }, []);

  // Save chart drawings
  const handleUpdateDrawings = (newDrawings: ChartDrawing[]) => {
    setDrawings(newDrawings);
    Storage.saveChartDrawings(currentSymbol.symbol, newDrawings);
  };

  const handleClearDrawings = () => {
    setDrawings([]);
    Storage.saveChartDrawings(currentSymbol.symbol, []);
    showToast('Chart drawings cleared');
  };

  // Replay Engine Auto-play interval
  useEffect(() => {
    if (!isReplayPlaying || activeTab !== 'replay') return;

    const delay = Math.max(100, 1000 / replaySpeed);
    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= candles.length - 1) {
          setIsReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);

    return () => clearInterval(interval);
  }, [isReplayPlaying, replaySpeed, candles.length, activeTab]);

  // Initiate Quick Order
  const handleExecuteQuickOrder = (
    direction: 'long' | 'short',
    size: number,
    slPrice?: number,
    tpPrice?: number
  ) => {
    const orderPayload: NewBrokerOrder = {
      symbol: currentSymbol.symbol,
      direction,
      orderType: 'market',
      quantity: size,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      mode: marketStatus.mode === 'LIVE' ? 'LIVE' : 'PAPER',
    };

    setPendingOrder(orderPayload);
  };

  // Confirm and submit order through BrokerManager
  const handleConfirmOrder = async () => {
    if (!pendingOrder) return;

    const currentPrice = currentSymbol.currentPrice;
    const result = await BrokerManager.submitOrder(pendingOrder, currentPrice);

    if (result.success) {
      showToast(
        `Filled ${pendingOrder.direction.toUpperCase()} ${pendingOrder.quantity} ${pendingOrder.symbol} @ $${currentPrice}`
      );
    } else {
      showToast(`Order Rejected: ${result.error || 'Unknown error'}`);
    }

    setPendingOrder(null);
  };

  // Close position handler
  const handleClosePosition = async (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;

    const currentPrice = pos.currentPrice;
    const result = await BrokerManager.closePosition(positionId, currentPrice);
    if (result.success) {
      showToast(`Closed position on ${pos.symbol}: ${result.pnl && result.pnl >= 0 ? '+' : ''}$${(result.pnl || 0).toFixed(2)}`);
      setJournal(Storage.getTradeJournal());
    }
  };

  // Map BrokerPositions to ActiveOrder interface for existing OpenPositionsTable
  const mappedOrders: ActiveOrder[] = positions.map((p) => ({
    id: p.id,
    symbol: p.symbol,
    direction: p.direction,
    size: p.quantity,
    entryPrice: p.entryPrice,
    stopLoss: p.stopLoss,
    takeProfit: p.takeProfit,
    pnl: p.unrealizedPnl,
    pnlPercent: p.unrealizedPnlPercent,
    timestamp: new Date(p.openedAt).toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Trading Header */}
      <TradingHeader
        currentSymbol={currentSymbol}
        symbols={symbols}
        onSelectSymbol={setCurrentSymbol}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        account={account}
        marketStatus={marketStatus}
        onSelectMode={(mode) => {
          MarketDataManager.setMode(mode);
          BrokerManager.setMode(mode === 'LIVE' ? 'LIVE' : 'PAPER');
        }}
        onOpenCalculator={() => setIsCalculatorModalOpen(true)}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
        activeAlertsCount={alerts.filter((a) => a.active && !a.triggered).length}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Content Body */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left / Center 3 Cols: Drawing Bar + Chart Canvas / MultiChart + Open Positions */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
              {/* Left Floating Drawing Toolbar */}
              <DrawingToolbar
                activeTool={activeDrawingTool}
                onSelectTool={setActiveDrawingTool}
                isMagnetEnabled={isMagnetEnabled}
                onToggleMagnet={() => setIsMagnetEnabled(!isMagnetEnabled)}
                onClearDrawings={handleClearDrawings}
                drawingsCount={drawings.length}
                onTakeScreenshot={() => showToast('Chart snapshot copied to clipboard')}
              />

              {/* Responsive Chart Canvas or MultiChart Layout */}
              <div className="flex-1 min-h-[520px] flex flex-col">
                {/* Multi-Chart Mode Toggle Button */}
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[11px] font-mono font-bold text-neutral-400">
                    {isMultiChartEnabled ? 'MULTI-CHART SYNCHRONIZED WORKSPACE' : 'SINGLE CHART WORKSPACE'}
                  </span>
                  <button
                    onClick={() => setIsMultiChartEnabled(!isMultiChartEnabled)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      isMultiChartEnabled
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-neutral-100 dark:bg-slate-900 text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {isMultiChartEnabled ? <Square className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                    <span>{isMultiChartEnabled ? 'Standard View' : 'Multi-Chart Split'}</span>
                  </button>
                </div>

                {isMultiChartEnabled ? (
                  <MultiChartLayout
                    symbols={symbols}
                    primarySymbol={currentSymbol}
                    primaryCandles={candles}
                    primaryTimeframe={timeframe}
                    primaryChartType={chartType}
                    indicators={indicators}
                    activeDrawingTool={activeDrawingTool}
                    drawings={drawings}
                    onUpdateDrawings={handleUpdateDrawings}
                    isMagnetEnabled={isMagnetEnabled}
                    onOpenIndicatorsModal={() => setIsIndicatorsModalOpen(true)}
                  />
                ) : (
                  <TradingChartCanvas
                    symbol={currentSymbol}
                    rawCandles={candles}
                    timeframe={timeframe}
                    onChangeTimeframe={setTimeframe}
                    chartType={chartType}
                    onChangeChartType={setChartType}
                    indicators={indicators}
                    onOpenIndicatorsModal={() => setIsIndicatorsModalOpen(true)}
                    activeDrawingTool={activeDrawingTool}
                    drawings={drawings}
                    onUpdateDrawings={handleUpdateDrawings}
                    isMagnetEnabled={isMagnetEnabled}
                  />
                )}
              </div>
            </div>

            {/* Open Positions & Executions */}
            <OpenPositionsTable
              orders={mappedOrders}
              symbols={symbols}
              onCloseOrder={handleClosePosition}
            />
          </div>

          {/* Right 1 Col: Market Watchlist & Quick Execution */}
          <div className="lg:col-span-1 space-y-6">
            <TradingWatchlist
              symbols={symbols}
              currentSymbol={currentSymbol}
              onSelectSymbol={setCurrentSymbol}
            />
          </div>
        </div>
      )}

      {/* Quantitative Screener Mode */}
      {activeTab === 'screener' && (
        <MarketScreenerView
          symbols={symbols}
          onSelectSymbol={(sym) => {
            setCurrentSymbol(sym);
            setActiveTab('terminal');
          }}
        />
      )}

      {/* Macro & Market Overview Mode */}
      {activeTab === 'overview' && (
        <MarketOverviewView
          symbols={symbols}
          onSelectSymbol={(sym) => {
            setCurrentSymbol(sym);
            setActiveTab('terminal');
          }}
        />
      )}

      {/* Historical Replay Mode */}
      {activeTab === 'replay' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
            <DrawingToolbar
              activeTool={activeDrawingTool}
              onSelectTool={setActiveDrawingTool}
              isMagnetEnabled={isMagnetEnabled}
              onToggleMagnet={() => setIsMagnetEnabled(!isMagnetEnabled)}
              onClearDrawings={handleClearDrawings}
              drawingsCount={drawings.length}
              onTakeScreenshot={() => showToast('Replay snapshot saved')}
            />

            <div className="flex-1 min-h-[520px]">
              <TradingChartCanvas
                symbol={currentSymbol}
                rawCandles={candles}
                timeframe={timeframe}
                onChangeTimeframe={setTimeframe}
                chartType={chartType}
                onChangeChartType={setChartType}
                indicators={indicators}
                onOpenIndicatorsModal={() => setIsIndicatorsModalOpen(true)}
                activeDrawingTool={activeDrawingTool}
                drawings={drawings}
                onUpdateDrawings={handleUpdateDrawings}
                isMagnetEnabled={isMagnetEnabled}
                replayIndex={replayIndex}
              />
            </div>
          </div>

          {/* Replay Control Bar */}
          <ReplayControlDeck
            symbol={currentSymbol}
            totalCandles={candles.length}
            currentIndex={replayIndex}
            onChangeCurrentIndex={setReplayIndex}
            isPlaying={isReplayPlaying}
            onTogglePlay={() => setIsReplayPlaying(!isReplayPlaying)}
            replaySpeed={replaySpeed}
            onChangeSpeed={setReplaySpeed}
            onExecuteQuickOrder={handleExecuteQuickOrder}
            openOrders={mappedOrders}
            onCloseOrder={handleClosePosition}
            currentCandle={candles[replayIndex]}
          />
        </div>
      )}

      {/* Quant Backtester Mode */}
      {activeTab === 'backtester' && (
        <BacktesterView
          currentSymbol={currentSymbol}
          symbols={symbols}
        />
      )}

      {/* Performance & Engine Monitor Mode */}
      {activeTab === 'performance' && (
        <PerformanceMonitorView />
      )}

      {/* Trade Journal & Analytics Mode */}
      {activeTab === 'journal' && (
        <TradeJournalView
          journal={journal}
          onAddTrade={(tradeData) => {
            const newEntry: TradeJournalEntry = {
              ...tradeData,
              id: `trade-${Date.now()}`,
            };
            const updated = [newEntry, ...journal];
            setJournal(updated);
            Storage.saveTradeJournal(updated);
            showToast(`Trade logged to journal`);
          }}
          onDeleteTrade={(tradeId) => {
            const updated = journal.filter((j) => j.id !== tradeId);
            setJournal(updated);
            Storage.saveTradeJournal(updated);
            showToast('Journal entry deleted');
          }}
        />
      )}

      {/* AI Trading Coach Tab */}
      {activeTab === 'ai_coach' && (
        <AITradingCoachView
          journal={journal}
          currentSymbol={currentSymbol}
        />
      )}

      {/* Risk Calculator Tab Mode */}
      {activeTab === 'calculator' && (
        <div className="max-w-2xl mx-auto">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200/80 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-slate-100 font-mono">
              Institutional Risk & Position Sizing Calculator
            </h3>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Calculate risk per trade, stop loss invalidation points, and position notional value based on your current account equity (${account.equity.toLocaleString()}).
            </p>
            <button
              onClick={() => setIsCalculatorModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs cursor-pointer shadow-xs"
            >
              Open Interactive Calculator
            </button>
          </div>
        </div>
      )}

      {/* Indicators Modal */}
      <IndicatorsModal
        isOpen={isIndicatorsModalOpen}
        onClose={() => setIsIndicatorsModalOpen(false)}
        indicators={indicators}
        onChangeIndicators={setIndicators}
      />

      {/* Position Sizing Calculator Modal */}
      <PositionCalculatorModal
        isOpen={isCalculatorModalOpen}
        onClose={() => setIsCalculatorModalOpen(false)}
        currentSymbol={currentSymbol}
        accountBalance={account.equity}
      />

      {/* Live Order Confirmation & Risk Inspection Modal */}
      {pendingOrder && (
        <LiveOrderConfirmationModal
          isOpen={true}
          onClose={() => setPendingOrder(null)}
          onConfirm={handleConfirmOrder}
          order={pendingOrder}
          currentPrice={currentSymbol.currentPrice}
          account={account}
          positions={positions}
        />
      )}

      {/* Real-time Alerts Manager Modal */}
      <AlertsManagerModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        currentSymbol={currentSymbol}
        symbols={symbols}
        alerts={alerts}
        onAlertsChanged={reloadAlerts}
      />

      {/* Institutional Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
};
