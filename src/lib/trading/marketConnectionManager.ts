import { Quote, Bar, Timeframe, MarketStatus, MarketMode } from '../../types';
import { MarketDataManager } from '../marketData/MarketDataManager';

/**
 * Centralized Market Data Connection Manager & High-Frequency Direct-to-Canvas Stream
 * Prevents redundant WebSocket instances per component and separates high-frequency ticks from React state.
 */

type QuoteListener = (quote: Quote) => void;
type BarListener = (bar: Bar) => void;
type DirectTickCanvasListener = (symbol: string, price: number, time: number) => void;

class CentralizedMarketConnectionManager {
  private quoteSubscribers: Map<string, Set<QuoteListener>> = new Map();
  private barSubscribers: Map<string, Set<BarListener>> = new Map();
  private directCanvasListeners: Set<DirectTickCanvasListener> = new Set();

  private activeQuoteCleanup?: () => void;
  private activeBarCleanups: Map<string, () => void> = new Map();

  private latestQuotes: Map<string, Quote> = new Map();
  private isRunning = false;
  private throttledUiTimer?: number;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;
    this.startConnection();
  }

  public startConnection() {
    if (this.isRunning) return;
    this.isRunning = true;

    MarketDataManager.connect();
    this.resubscribeQuotes();
  }

  public stopConnection() {
    this.isRunning = false;
    if (this.activeQuoteCleanup) {
      this.activeQuoteCleanup();
      this.activeQuoteCleanup = undefined;
    }
    this.activeBarCleanups.forEach((cleanup) => cleanup());
    this.activeBarCleanups.clear();
  }

  private resubscribeQuotes() {
    if (this.activeQuoteCleanup) {
      this.activeQuoteCleanup();
      this.activeQuoteCleanup = undefined;
    }

    const symbols = Array.from(this.quoteSubscribers.keys());
    if (symbols.length === 0) return;

    this.activeQuoteCleanup = MarketDataManager.subscribeQuotes(symbols, (quote) => {
      this.latestQuotes.set(quote.symbol, quote);

      // 1. Dispatch directly to fast canvas listeners immediately (0ms delay, no React render)
      this.directCanvasListeners.forEach((fn) => {
        try {
          fn(quote.symbol, quote.price, quote.timestamp);
        } catch {
          // Handled
        }
      });

      // 2. Dispatch to registered UI subscribers
      const subs = this.quoteSubscribers.get(quote.symbol);
      if (subs) {
        subs.forEach((fn) => {
          try {
            fn(quote);
          } catch {
            // Handled
          }
        });
      }
    });
  }

  public subscribeQuote(symbol: string, listener: QuoteListener): () => void {
    const cleanSym = symbol.toUpperCase();
    if (!this.quoteSubscribers.has(cleanSym)) {
      this.quoteSubscribers.set(cleanSym, new Set());
      this.resubscribeQuotes();
    }

    this.quoteSubscribers.get(cleanSym)!.add(listener);

    // Provide cached quote immediately if available
    const cached = this.latestQuotes.get(cleanSym);
    if (cached) {
      listener(cached);
    }

    return () => {
      const set = this.quoteSubscribers.get(cleanSym);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.quoteSubscribers.delete(cleanSym);
          this.resubscribeQuotes();
        }
      }
    };
  }

  public subscribeBars(symbol: string, timeframe: Timeframe, listener: BarListener): () => void {
    const key = `${symbol.toUpperCase()}:${timeframe}`;
    if (!this.barSubscribers.has(key)) {
      this.barSubscribers.set(key, new Set());
      const cleanup = MarketDataManager.subscribeBars(symbol, timeframe, (bar) => {
        const subs = this.barSubscribers.get(key);
        if (subs) {
          subs.forEach((fn) => {
            try {
              fn(bar);
            } catch {
              // Handled
            }
          });
        }
      });
      this.activeBarCleanups.set(key, cleanup);
    }

    this.barSubscribers.get(key)!.add(listener);

    return () => {
      const set = this.barSubscribers.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.barSubscribers.delete(key);
          const cleanup = this.activeBarCleanups.get(key);
          if (cleanup) {
            cleanup();
            this.activeBarCleanups.delete(key);
          }
        }
      }
    };
  }

  /**
   * Direct-to-Canvas High-Frequency Subscriber
   * Canvas components can listen directly to ticks for fluid 60 FPS real-time updates
   */
  public registerDirectCanvasListener(listener: DirectTickCanvasListener): () => void {
    this.directCanvasListeners.add(listener);
    return () => {
      this.directCanvasListeners.delete(listener);
    };
  }

  public getLatestQuote(symbol: string): Quote | undefined {
    return this.latestQuotes.get(symbol.toUpperCase());
  }

  public getStatus(): MarketStatus {
    return MarketDataManager.getStatus();
  }

  public setMode(mode: MarketMode) {
    MarketDataManager.setMode(mode);
  }
}

export const marketConnectionManager = new CentralizedMarketConnectionManager();
