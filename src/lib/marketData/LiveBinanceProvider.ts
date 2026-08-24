import { Bar, MarketDataProvider, MarketStatus, Quote, Timeframe } from '../../types';

// Map Life OS timeframe to Binance interval
export function toBinanceInterval(tf: Timeframe): string {
  switch (tf) {
    case '1m':
      return '1m';
    case '5m':
      return '5m';
    case '15m':
      return '15m';
    case '30m':
      return '30m';
    case '1H':
      return '1h';
    case '4H':
      return '4h';
    case '1D':
      return '1d';
    case '1W':
      return '1w';
    default:
      return '15m';
  }
}

// Convert symbol to Binance pair e.g. BTCUSD -> BTCUSDT
export function toBinanceSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().replace('/', '');
  if (clean === 'BTCUSD') return 'BTCUSDT';
  if (clean === 'ETHUSD') return 'ETHUSDT';
  if (clean === 'SOLUSD') return 'SOLUSDT';
  if (clean.endsWith('USD') && !clean.endsWith('USDT')) return clean + 'T';
  return clean;
}

export function validateAndCleanBars(bars: Bar[]): Bar[] {
  if (!bars || bars.length === 0) return [];

  // Sort chronologically ascending
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const clean: Bar[] = [];
  const seenTimes = new Set<number>();

  for (const bar of sorted) {
    if (seenTimes.has(bar.time)) continue; // Deduplicate
    if (isNaN(bar.open) || isNaN(bar.high) || isNaN(bar.low) || isNaN(bar.close) || isNaN(bar.time)) continue;
    if (bar.open <= 0 || bar.close <= 0) continue;

    // Fix minor high/low precision anomalies
    const open = bar.open;
    const close = bar.close;
    const high = Math.max(bar.high, open, close);
    const low = Math.min(bar.low, open, close);
    const volume = Math.max(0, isNaN(bar.volume) ? 0 : bar.volume);

    seenTimes.add(bar.time);
    clean.push({
      time: bar.time,
      open,
      high,
      low,
      close,
      volume,
      confirmed: bar.confirmed ?? true,
    });
  }

  return clean;
}

export class LiveBinanceMarketDataProvider implements MarketDataProvider {
  name = 'Binance Public Stream';
  supportedSymbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD'];
  
  private ws: WebSocket | null = null;
  private quoteSubscribers: Map<string, Set<(quote: Quote) => void>> = new Map();
  private barSubscribers: Map<string, Set<(bar: Bar) => void>> = new Map();
  private status: MarketStatus = {
    mode: 'PAPER',
    state: 'disconnected',
    provider: 'Binance Public WebSocket API',
    lastUpdated: Date.now(),
  };
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lastQuoteCache: Map<string, Quote> = new Map();

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status.state = 'connecting';
    this.status.lastUpdated = Date.now();

    try {
      // Connect to public Binance 24hr miniTicker stream for major pairs
      const streams = ['btcusdt@ticker', 'ethusdt@ticker', 'solusdt@ticker'].join('/');
      const url = `wss://stream.binance.com:9443/ws/${streams}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.status.state = 'connected';
        this.status.lastUpdated = Date.now();
        this.status.errorMessage = undefined;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleSocketMessage(data);
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onerror = (err) => {
        this.status.state = 'error';
        this.status.errorMessage = 'WebSocket connection error';
        this.status.lastUpdated = Date.now();
      };

      this.ws.onclose = () => {
        this.status.state = 'disconnected';
        this.status.lastUpdated = Date.now();
        this.attemptReconnect();
      };
    } catch (e: any) {
      this.status.state = 'error';
      this.status.errorMessage = e?.message || 'Failed to establish WebSocket';
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleSocketMessage(data: any) {
    // 24hr Ticker message format from Binance:
    // s: Symbol, c: Last Price, p: Price Change, P: Price Change Percent, h: High, l: Low, v: Volume, b: Best Bid, a: Best Ask
    if (data && data.s) {
      const bSymbol = data.s;
      let internalSymbol = 'BTCUSD';
      if (bSymbol === 'BTCUSDT') internalSymbol = 'BTCUSD';
      else if (bSymbol === 'ETHUSDT') internalSymbol = 'ETHUSD';
      else if (bSymbol === 'SOLUSDT') internalSymbol = 'SOLUSD';
      else internalSymbol = bSymbol.replace('USDT', 'USD');

      const price = parseFloat(data.c || '0');
      const change24h = parseFloat(data.p || '0');
      const change24hPercent = parseFloat(data.P || '0');
      const high24h = parseFloat(data.h || '0');
      const low24h = parseFloat(data.l || '0');
      const volume24h = parseFloat(data.v || '0');
      const bid = parseFloat(data.b || data.c || '0');
      const ask = parseFloat(data.a || data.c || '0');

      const quote: Quote = {
        symbol: internalSymbol,
        price,
        bid,
        ask,
        change24h,
        change24hPercent,
        high24h,
        low24h,
        volume24h,
        timestamp: Date.now(),
        provider: 'Binance Live Stream',
      };

      this.lastQuoteCache.set(internalSymbol, quote);
      this.status.lastUpdated = Date.now();

      const listeners = this.quoteSubscribers.get(internalSymbol);
      if (listeners) {
        listeners.forEach((fn) => fn(quote));
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status.state = 'disconnected';
    this.status.lastUpdated = Date.now();
  }

  subscribeQuotes(symbols: string[], callback: (quote: Quote) => void): () => void {
    symbols.forEach((sym) => {
      if (!this.quoteSubscribers.has(sym)) {
        this.quoteSubscribers.set(sym, new Set());
      }
      this.quoteSubscribers.get(sym)!.add(callback);

      // Return cached quote immediately if available
      const cached = this.lastQuoteCache.get(sym);
      if (cached) {
        callback(cached);
      } else {
        // Fetch snapshot via REST
        this.getQuote(sym).then((q) => callback(q)).catch(() => {});
      }
    });

    return () => {
      symbols.forEach((sym) => {
        const set = this.quoteSubscribers.get(sym);
        if (set) {
          set.delete(callback);
        }
      });
    };
  }

  subscribeBars(symbol: string, timeframe: Timeframe, callback: (bar: Bar) => void): () => void {
    const key = `${symbol}_${timeframe}`;
    if (!this.barSubscribers.has(key)) {
      this.barSubscribers.set(key, new Set());
    }
    this.barSubscribers.get(key)!.add(callback);

    return () => {
      const set = this.barSubscribers.get(key);
      if (set) {
        set.delete(callback);
      }
    };
  }

  async getHistoricalBars(
    symbol: string,
    timeframe: Timeframe,
    limit = 150,
    startTime?: number,
    endTime?: number
  ): Promise<Bar[]> {
    const bSymbol = toBinanceSymbol(symbol);
    const interval = toBinanceInterval(timeframe);
    const maxChunk = 1000;

    // If requested limit <= 1000 and no specific startTime/endTime pagination needed
    if (limit <= maxChunk && !startTime && !endTime) {
      const url = `https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${interval}&limit=${Math.min(limit, maxChunk)}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`Binance API response error: ${resp.status}`);
        }
        const data = await resp.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid Binance Kline format');
        }
        const rawBars: Bar[] = data.map((item: any) => ({
          time: item[0],
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
          confirmed: true,
        }));
        return validateAndCleanBars(rawBars);
      } catch (err: any) {
        throw err;
      }
    }

    // Chunked multi-request pagination for large historical ranges without artificial application limit
    const allBars: Bar[] = [];
    let currentEndTime = endTime || Date.now();
    let remaining = limit;

    while (remaining > 0) {
      const fetchLimit = Math.min(remaining, maxChunk);
      let url = `https://api.binance.com/api/v3/klines?symbol=${bSymbol}&interval=${interval}&limit=${fetchLimit}&endTime=${currentEndTime}`;
      if (startTime) {
        url += `&startTime=${startTime}`;
      }

      try {
        const resp = await fetch(url);
        if (!resp.ok) break;
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) break;

        const chunkBars: Bar[] = data.map((item: any) => ({
          time: item[0],
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
          confirmed: true,
        }));

        // Prepend chunk
        allBars.unshift(...chunkBars);
        remaining -= chunkBars.length;

        // Next chunk ends before the earliest candle in this chunk
        const earliestTime = chunkBars[0].time;
        if (earliestTime <= (startTime || 0) || chunkBars.length < fetchLimit) {
          break; // Reached beginning of data or start range
        }
        currentEndTime = earliestTime - 1;
      } catch {
        break;
      }
    }

    return validateAndCleanBars(allBars);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const bSymbol = toBinanceSymbol(symbol);
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${bSymbol}`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Binance REST failed: ${resp.status}`);
      }
      const data = await resp.json();

      const quote: Quote = {
        symbol,
        price: parseFloat(data.lastPrice || '0'),
        bid: parseFloat(data.bidPrice || data.lastPrice || '0'),
        ask: parseFloat(data.askPrice || data.lastPrice || '0'),
        change24h: parseFloat(data.priceChange || '0'),
        change24hPercent: parseFloat(data.priceChangePercent || '0'),
        high24h: parseFloat(data.highPrice || '0'),
        low24h: parseFloat(data.lowPrice || '0'),
        volume24h: parseFloat(data.volume || '0'),
        timestamp: Date.now(),
        provider: 'Binance Live REST API',
      };

      this.lastQuoteCache.set(symbol, quote);
      return quote;
    } catch (err) {
      // Return cached quote if exists
      const cached = this.lastQuoteCache.get(symbol);
      if (cached) return cached;
      throw err;
    }
  }

  getStatus(): MarketStatus {
    return { ...this.status };
  }
}
