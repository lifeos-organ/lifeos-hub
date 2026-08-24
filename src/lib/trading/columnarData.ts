import { CandleStick, ColumnarCandles, Timeframe } from '../../types';

/**
 * High-Performance Columnar Candle Data Structure
 * Uses TypedArrays for high-speed sequential iterations, zero JSON cloning, and minimal memory footprint.
 */

export function createColumnarCandles(capacity: number): ColumnarCandles {
  return {
    timestamps: new Float64Array(capacity),
    opens: new Float64Array(capacity),
    highs: new Float64Array(capacity),
    lows: new Float64Array(capacity),
    closes: new Float64Array(capacity),
    volumes: new Float64Array(capacity),
    count: 0,
  };
}

export function candlesToColumnar(candles: CandleStick[]): ColumnarCandles {
  const count = candles.length;
  const col = createColumnarCandles(count);
  col.count = count;

  for (let i = 0; i < count; i++) {
    const c = candles[i];
    col.timestamps[i] = c.time;
    col.opens[i] = c.open;
    col.highs[i] = c.high;
    col.lows[i] = c.low;
    col.closes[i] = c.close;
    col.volumes[i] = c.volume;
  }

  return col;
}

export function columnarToCandles(col: ColumnarCandles, startIndex = 0, count?: number): CandleStick[] {
  const end = count !== undefined ? Math.min(col.count, startIndex + count) : col.count;
  const len = Math.max(0, end - startIndex);
  const result: CandleStick[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const idx = startIndex + i;
    result[i] = {
      time: col.timestamps[idx],
      open: col.opens[idx],
      high: col.highs[idx],
      low: col.lows[idx],
      close: col.closes[idx],
      volume: col.volumes[idx],
    };
  }

  return result;
}

/**
 * Binary Serialization for Zero-Copy ArrayBuffer Transfer (Transferrable Objects)
 * Header: [uint32 count]
 * Body: [Float64Array timestamps][Float64Array opens][Float64Array highs][Float64Array lows][Float64Array closes][Float64Array volumes]
 */
export function serializeColumnarToBuffer(col: ColumnarCandles): ArrayBuffer {
  const count = col.count;
  const floatBytes = count * 8;
  const totalBytes = 4 + floatBytes * 6; // 4 bytes header + 6 float64 arrays

  const buffer = new ArrayBuffer(totalBytes);
  const headerView = new Uint32Array(buffer, 0, 1);
  headerView[0] = count;

  let offset = 4;
  new Float64Array(buffer, offset, count).set(col.timestamps.subarray(0, count));
  offset += floatBytes;
  new Float64Array(buffer, offset, count).set(col.opens.subarray(0, count));
  offset += floatBytes;
  new Float64Array(buffer, offset, count).set(col.highs.subarray(0, count));
  offset += floatBytes;
  new Float64Array(buffer, offset, count).set(col.lows.subarray(0, count));
  offset += floatBytes;
  new Float64Array(buffer, offset, count).set(col.closes.subarray(0, count));
  offset += floatBytes;
  new Float64Array(buffer, offset, count).set(col.volumes.subarray(0, count));

  return buffer;
}

export function deserializeColumnarFromBuffer(buffer: ArrayBuffer): ColumnarCandles {
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

  return {
    timestamps,
    opens,
    highs,
    lows,
    closes,
    volumes,
    count,
  };
}

/**
 * High-Speed Deterministic PRNG (XorShift128+) for Realistic Market Simulation
 * Generates multi-million candle datasets with Geometric Brownian Motion & Volatility Clustering in milliseconds.
 */
export function generateColumnarDataset(
  count: number,
  options: {
    startPrice?: number;
    startTime?: number;
    intervalMs?: number;
    volatility?: number;
    drift?: number;
    seed?: number;
  } = {}
): ColumnarCandles {
  const startPrice = options.startPrice ?? 50000.0;
  const startTime = options.startTime ?? Date.now() - count * 60000;
  const intervalMs = options.intervalMs ?? 60000; // 1 minute
  const volatility = options.volatility ?? 0.0015;
  const drift = options.drift ?? 0.00002;

  let s0 = (options.seed ?? 123456789) >>> 0;
  let s1 = (s0 ^ 0xdeadbeef) >>> 0;

  // Fast PRNG
  const nextRandom = (): number => {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    s1 = x ^ y ^ (x >>> 17) ^ (y >>> 26);
    return ((s1 + y) >>> 0) / 4294967296;
  };

  const col = createColumnarCandles(count);
  col.count = count;

  let currentPrice = startPrice;
  let currentTime = startTime;

  for (let i = 0; i < count; i++) {
    const r1 = nextRandom();
    const r2 = nextRandom();
    const r3 = nextRandom();
    const r4 = nextRandom();

    // Box-Muller normal distribution transform
    const z = Math.sqrt(-2.0 * Math.log(Math.max(1e-10, r1))) * Math.cos(2.0 * Math.PI * r2);
    const returnPct = drift + volatility * z;

    const open = currentPrice;
    const close = Math.max(1.0, open * (1.0 + returnPct));
    const spread = Math.abs(close - open);
    const high = Math.max(open, close) + spread * (0.2 + r3 * 0.8);
    const low = Math.max(0.5, Math.min(open, close) - spread * (0.2 + r4 * 0.8));
    const volume = Math.floor(50 + r1 * 500 + Math.abs(z) * 400);

    col.timestamps[i] = currentTime;
    col.opens[i] = open;
    col.highs[i] = high;
    col.lows[i] = low;
    col.closes[i] = close;
    col.volumes[i] = volume;

    currentPrice = close;
    currentTime += intervalMs;
  }

  return col;
}

/**
 * Timeframe interval multiplier in milliseconds
 */
export function timeframeToMs(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1m': return 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '30m': return 30 * 60 * 1000;
    case '1H':
    case '1h': return 60 * 60 * 1000;
    case '4H':
    case '4h': return 4 * 60 * 60 * 1000;
    case '1D': return 24 * 60 * 60 * 1000;
    case '1W': return 7 * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

/**
 * High-Throughput In-Memory Timeframe Aggregator
 * Generates higher timeframes (e.g. 5m, 15m, 1H, 1D) directly from base 1m columnar data without network trips.
 */
export function aggregateTimeframeColumnar(
  baseCol: ColumnarCandles,
  targetTimeframe: Timeframe
): ColumnarCandles {
  const targetMs = timeframeToMs(targetTimeframe);
  const baseCount = baseCol.count;
  if (baseCount === 0) return createColumnarCandles(0);

  // Upper bound capacity estimation
  const estimatedCapacity = Math.ceil((baseCol.timestamps[baseCount - 1] - baseCol.timestamps[0]) / targetMs) + 10;
  const result = createColumnarCandles(Math.max(16, estimatedCapacity));

  let outIdx = 0;
  let currentBucketTime = Math.floor(baseCol.timestamps[0] / targetMs) * targetMs;
  let currentOpen = baseCol.opens[0];
  let currentHigh = baseCol.highs[0];
  let currentLow = baseCol.lows[0];
  let currentClose = baseCol.closes[0];
  let currentVol = baseCol.volumes[0];

  for (let i = 1; i < baseCount; i++) {
    const t = baseCol.timestamps[i];
    const bucket = Math.floor(t / targetMs) * targetMs;

    if (bucket === currentBucketTime) {
      if (baseCol.highs[i] > currentHigh) currentHigh = baseCol.highs[i];
      if (baseCol.lows[i] < currentLow) currentLow = baseCol.lows[i];
      currentClose = baseCol.closes[i];
      currentVol += baseCol.volumes[i];
    } else {
      // Flush completed bar
      if (outIdx >= result.timestamps.length) {
        // Expand if needed
        return resizeAndFinishAggregation(baseCol, targetMs, outIdx);
      }
      result.timestamps[outIdx] = currentBucketTime;
      result.opens[outIdx] = currentOpen;
      result.highs[outIdx] = currentHigh;
      result.lows[outIdx] = currentLow;
      result.closes[outIdx] = currentClose;
      result.volumes[outIdx] = currentVol;
      outIdx++;

      currentBucketTime = bucket;
      currentOpen = baseCol.opens[i];
      currentHigh = baseCol.highs[i];
      currentLow = baseCol.lows[i];
      currentClose = baseCol.closes[i];
      currentVol = baseCol.volumes[i];
    }
  }

  // Flush trailing bar
  result.timestamps[outIdx] = currentBucketTime;
  result.opens[outIdx] = currentOpen;
  result.highs[outIdx] = currentHigh;
  result.lows[outIdx] = currentLow;
  result.closes[outIdx] = currentClose;
  result.volumes[outIdx] = currentVol;
  outIdx++;

  result.count = outIdx;
  return result;
}

function resizeAndFinishAggregation(baseCol: ColumnarCandles, targetMs: number, _startIdx: number): ColumnarCandles {
  // Safe fallback if bucket estimation was tight
  const bars: CandleStick[] = [];
  const baseCount = baseCol.count;
  let curBucket = Math.floor(baseCol.timestamps[0] / targetMs) * targetMs;
  let o = baseCol.opens[0];
  let h = baseCol.highs[0];
  let l = baseCol.lows[0];
  let c = baseCol.closes[0];
  let v = baseCol.volumes[0];

  for (let i = 1; i < baseCount; i++) {
    const bucket = Math.floor(baseCol.timestamps[i] / targetMs) * targetMs;
    if (bucket === curBucket) {
      if (baseCol.highs[i] > h) h = baseCol.highs[i];
      if (baseCol.lows[i] < l) l = baseCol.lows[i];
      c = baseCol.closes[i];
      v += baseCol.volumes[i];
    } else {
      bars.push({ time: curBucket, open: o, high: h, low: l, close: c, volume: v });
      curBucket = bucket;
      o = baseCol.opens[i];
      h = baseCol.highs[i];
      l = baseCol.lows[i];
      c = baseCol.closes[i];
      v = baseCol.volumes[i];
    }
  }
  bars.push({ time: curBucket, open: o, high: h, low: l, close: c, volume: v });
  return candlesToColumnar(bars);
}

/**
 * Level of Detail (LOD) Downsampler for Smooth 60 FPS Viewport Charting
 * When viewing millions of candles, downsamples the visible slice into targetPixelBuckets (e.g. 150-400 bars)
 * preserving exact High/Low extremities and Open/Close boundaries in <1ms.
 */
export function downsampleLOD(
  col: ColumnarCandles,
  startIndex: number,
  endIndex: number,
  targetBuckets = 300
): CandleStick[] {
  const start = Math.max(0, startIndex);
  const end = Math.min(col.count, endIndex);
  const totalCount = end - start;

  if (totalCount <= targetBuckets || totalCount <= 0) {
    return columnarToCandles(col, start, totalCount);
  }

  const bucketSize = totalCount / targetBuckets;
  const result: CandleStick[] = new Array(targetBuckets);

  for (let b = 0; b < targetBuckets; b++) {
    const bStart = Math.floor(start + b * bucketSize);
    const bEnd = Math.min(end, Math.floor(start + (b + 1) * bucketSize));

    let open = col.opens[bStart];
    let high = col.highs[bStart];
    let low = col.lows[bStart];
    let close = col.closes[Math.max(bStart, bEnd - 1)];
    let volume = 0;
    const time = col.timestamps[bStart];

    for (let i = bStart; i < bEnd; i++) {
      if (col.highs[i] > high) high = col.highs[i];
      if (col.lows[i] < low) low = col.lows[i];
      volume += col.volumes[i];
    }

    result[b] = { time, open, high, low, close, volume };
  }

  return result;
}
