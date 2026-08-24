import { ColumnarCandles, Timeframe, CacheTelemetryStats } from '../../types';
import {
  createColumnarCandles,
  candlesToColumnar,
  generateColumnarDataset,
  serializeColumnarToBuffer,
  deserializeColumnarFromBuffer,
  aggregateTimeframeColumnar,
} from './columnarData';

/**
 * Multi-Level Historical Data Cache Architecture
 * Level 1: Fast In-Memory LRU Cache (Columnar Float64Arrays)
 * Level 2: IndexedDB Binary ArrayBuffer Chunk Store
 * Level 3: Server Range Query / Synthetic High-Throughput Fallback
 */

interface CacheEntry {
  symbol: string;
  timeframe: Timeframe;
  key: string;
  data: ColumnarCandles;
  byteSize: number;
  lastAccessed: number;
}

class IndexedDbStore {
  private dbName = 'LifeOS_TradingData_V1';
  private storeName = 'candle_chunks';
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDb();
    }
  }

  private initDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async get(key: string): Promise<ArrayBuffer | null> {
    const db = await this.initDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.buffer instanceof ArrayBuffer) {
            resolve(req.result.buffer);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async set(key: string, buffer: ArrayBuffer, metadata?: any): Promise<boolean> {
    const db = await this.initDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put({ key, buffer, metadata, timestamp: Date.now() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async count(): Promise<number> {
    const db = await this.initDb();
    if (!db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  public async clear(): Promise<void> {
    const db = await this.initDb();
    if (!db) return;
    try {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).clear();
    } catch {
      // Ignored
    }
  }
}

class MultiLevelHistoricalCacheManager {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private maxMemoryBytes = 128 * 1024 * 1024; // 128 MB budget
  private currentMemoryBytes = 0;
  private idbStore = new IndexedDbStore();

  private hits = 0;
  private misses = 0;

  private makeKey(symbol: string, timeframe: Timeframe, count: number): string {
    return `${symbol.toUpperCase()}:${timeframe}:${count}`;
  }

  public async getHistoricalColumnar(
    symbol: string,
    timeframe: Timeframe,
    count = 10000
  ): Promise<ColumnarCandles> {
    const key = this.makeKey(symbol, timeframe, count);

    // 1. Check Level 1: In-Memory LRU Cache
    const mem = this.memoryCache.get(key);
    if (mem) {
      this.hits++;
      mem.lastAccessed = Date.now();
      return mem.data;
    }

    // 2. Check if we have 1m base data in memory to aggregate instantly
    if (timeframe !== '1m') {
      const baseKey1m = this.makeKey(symbol, '1m', count * 15);
      const baseMem = this.memoryCache.get(baseKey1m);
      if (baseMem) {
        this.hits++;
        const aggregated = aggregateTimeframeColumnar(baseMem.data, timeframe);
        this.putMemory(key, symbol, timeframe, aggregated);
        return aggregated;
      }
    }

    // 3. Check Level 2: Persistent IndexedDB
    try {
      const idbBuffer = await this.idbStore.get(key);
      if (idbBuffer) {
        this.hits++;
        const col = deserializeColumnarFromBuffer(idbBuffer);
        this.putMemory(key, symbol, timeframe, col);
        return col;
      }
    } catch {
      // Pass-through on indexeddb error
    }

    // 4. Level 3: Fetch Real Market Data from MarketDataManager or High-Speed Seed Fallback
    this.misses++;
    let col: ColumnarCandles | null = null;

    try {
      // Dynamic import or direct call to avoid circular dependency
      const { MarketDataManager } = await import('../marketData/MarketDataManager');
      const realBars = await MarketDataManager.getHistoricalBars(symbol, timeframe, Math.min(count, 5000));
      if (realBars && realBars.length > 20) {
        col = candlesToColumnar(realBars);
      }
    } catch {
      // Fallback
    }

    if (!col) {
      const seedPrice = symbol.includes('BTC') ? 94800 : symbol.includes('ETH') ? 3420 : symbol.includes('EUR') ? 1.085 : 2740;
      col = generateColumnarDataset(count, {
        startPrice: seedPrice,
        startTime: Date.now() - count * 60000,
        volatility: symbol.includes('BTC') ? 0.002 : 0.0008,
        seed: hashString(`${symbol}:${timeframe}`),
      });
    }

    // Write-through to L1 and L2
    this.putMemory(key, symbol, timeframe, col);
    try {
      const buf = serializeColumnarToBuffer(col);
      this.idbStore.set(key, buf, { symbol, timeframe, count });
    } catch {
      // Ignored
    }

    // Trigger background prefetch for adjacent timeframes
    this.triggerPrefetch(symbol, timeframe, count);

    return col;
  }

  private putMemory(key: string, symbol: string, timeframe: Timeframe, data: ColumnarCandles) {
    const byteSize = data.count * 8 * 6; // 6 Float64Arrays
    this.evictIfNeeded(byteSize);

    this.memoryCache.set(key, {
      symbol,
      timeframe,
      key,
      data,
      byteSize,
      lastAccessed: Date.now(),
    });
    this.currentMemoryBytes += byteSize;
  }

  private evictIfNeeded(requiredBytes: number) {
    if (this.currentMemoryBytes + requiredBytes <= this.maxMemoryBytes) return;

    // Evict least recently accessed entries
    const entries = Array.from(this.memoryCache.values()).sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const entry of entries) {
      this.memoryCache.delete(entry.key);
      this.currentMemoryBytes -= entry.byteSize;
      if (this.currentMemoryBytes + requiredBytes <= this.maxMemoryBytes) break;
    }
  }

  /**
   * Intelligent Background Prefetcher
   * Pre-loads adjacent timeframes (e.g. 5m, 15m, 1H) into memory without blocking UI
   */
  public triggerPrefetch(symbol: string, currentTf: Timeframe, count: number) {
    setTimeout(async () => {
      const adjacentTfs: Timeframe[] = ['1m', '5m', '15m', '1H'].filter((tf) => tf !== currentTf) as Timeframe[];
      for (const tf of adjacentTfs) {
        const key = this.makeKey(symbol, tf, count);
        if (!this.memoryCache.has(key)) {
          // If we have 1m data, generate it smoothly
          const baseKey = this.makeKey(symbol, '1m', count);
          const base = this.memoryCache.get(baseKey);
          if (base) {
            const agg = aggregateTimeframeColumnar(base.data, tf);
            this.putMemory(key, symbol, tf, agg);
          }
        }
      }
    }, 100);
  }

  public async clearAll(): Promise<void> {
    this.memoryCache.clear();
    this.currentMemoryBytes = 0;
    this.hits = 0;
    this.misses = 0;
    await this.idbStore.clear();
  }

  public async getStats(): Promise<CacheTelemetryStats> {
    const idbCount = await this.idbStore.count();
    const totalRequests = this.hits + this.misses;
    const hitRatePercent = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 100;

    return {
      l1MemoryItems: this.memoryCache.size,
      l1MemoryBytes: this.currentMemoryBytes,
      l2IndexedDbItems: idbCount,
      l2IndexedDbBytes: idbCount * 256 * 1024, // approx estimation
      cacheHits: this.hits,
      cacheMisses: this.misses,
      hitRatePercent,
    };
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const historicalCache = new MultiLevelHistoricalCacheManager();
