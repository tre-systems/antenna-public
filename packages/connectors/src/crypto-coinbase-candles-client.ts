import { errorMessage } from './error-message';
import { retryAfterSecondsFromHeaders } from './http-retry-after';
import type { AdapterError, AdapterResult, DataPoint } from './types';

type Candle = [number, number, number, number, number, number];
type HistoricPricesResponse = {
  readonly data?: {
    readonly base?: string;
    readonly currency?: string;
    readonly prices?: Array<{ readonly price?: string; readonly time?: string }>;
  };
};

const DAY_SECONDS = 86_400;
const MAX_CANDLES_PER_REQUEST = 300;
const DEFAULT_DAYS = 365;

export type PairOutcome =
  { ok: true; points: DataPoint[]; raw: unknown[] } | { ok: false; error: AdapterError };

export const clampDays = (days: number): number => {
  if (!Number.isFinite(days)) return DEFAULT_DAYS;
  return Math.max(1, Math.min(Math.round(days), 730));
};

export const defaultDays = (): number => DEFAULT_DAYS;

export const fetchPairCandles = async (pair: string, days: number): Promise<PairOutcome> => {
  const normalised = pair.trim().toUpperCase();
  if (normalised.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'empty pair' } };
  }

  let cursorEnd = Math.floor(Date.now() / 1000);
  let remaining = days;
  const raw: unknown[] = [];
  const points: DataPoint[] = [];
  const seen = new Set<number>();

  while (remaining > 0) {
    const span = Math.min(remaining, MAX_CANDLES_PER_REQUEST);
    const cursorStart = cursorEnd - span * DAY_SECONDS;
    const fetched = await fetchCandles(normalised, cursorStart, cursorEnd);
    if (!fetched.ok) return fetchHistoricPricesOrOriginalError(normalised, days, fetched);
    raw.push(fetched.body);
    for (const candle of fetched.body) {
      const point = candleToPoint(normalised, candle);
      if (!point || seen.has(point.ts)) continue;
      seen.add(point.ts);
      points.push(point);
    }
    remaining -= span;
    cursorEnd = cursorStart;
  }

  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no candles parsed' } };
  }
  return { ok: true, points, raw };
};

export const allPairsFailed = (outcomes: readonly PairOutcome[]): AdapterResult => {
  const failures = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome.error]));
  const retryable = failures.find((error) => error.code === 'rate_limited');
  if (retryable) return { ok: false, error: retryable };
  return { ok: false, error: { code: 'fetch_failed', message: 'all pairs failed' } };
};

const fetchHistoricPricesOrOriginalError = async (
  pair: string,
  days: number,
  original: Extract<PairOutcome, { ok: false }>,
): Promise<PairOutcome> => {
  const fallback = await fetchHistoricPrices(pair, days);
  return fallback.ok ? fallback : original;
};

const fetchHistoricPrices = async (pair: string, days: number): Promise<PairOutcome> => {
  const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/historic?period=year`;
  const response = await fetchCoinbaseJson(url);
  if (!response.ok) return response;

  const points = parseHistoricPrices(pair, response.body, days);
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no historic prices parsed' } };
  }
  return { ok: true, points, raw: [response.body] };
};

const parseHistoricPrices = (pair: string, body: unknown, days: number): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const prices = (body as HistoricPricesResponse).data?.prices;
  if (!Array.isArray(prices)) return [];

  const cutoff = Date.now() - clampDays(days) * DAY_SECONDS * 1000;
  const points: DataPoint[] = [];
  const seen = new Set<number>();
  for (const item of prices) {
    const price = Number(item.price);
    const seconds = Number(item.time);
    if (!Number.isFinite(price) || !Number.isFinite(seconds)) continue;
    const ts = seconds * 1000;
    if (ts < cutoff || seen.has(ts)) continue;
    seen.add(ts);
    points.push(toPricePoint(pair, price, ts));
  }
  return points;
};

const fetchCandles = async (
  pair: string,
  startSeconds: number,
  endSeconds: number,
): Promise<{ ok: true; body: Candle[] } | { ok: false; error: AdapterError }> => {
  const params = new URLSearchParams({
    granularity: String(DAY_SECONDS),
    start: new Date(startSeconds * 1000).toISOString(),
    end: new Date(endSeconds * 1000).toISOString(),
  });
  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(pair)}/candles?${params.toString()}`;
  const response = await fetchCoinbaseJson(url);
  if (!response.ok) return response;
  if (!Array.isArray(response.body)) {
    return { ok: false, error: { code: 'parse_failed', message: 'expected candle array' } };
  }
  return { ok: true, body: response.body.filter(isCandle) };
};

const fetchCoinbaseJson = async (
  url: string,
): Promise<{ ok: true; body: unknown } | { ok: false; error: AdapterError }> => {
  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }
  if (response.status === 429) return rateLimitError(response.headers);
  if (!response.ok) {
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }
  try {
    return { ok: true, body: await response.json() };
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
};

const rateLimitError = (headers: Headers): Extract<PairOutcome, { ok: false }> => ({
  ok: false,
  error: {
    code: 'rate_limited',
    message: 'Coinbase rate limited',
    retryAfterSeconds: retryAfterSecondsFromHeaders(headers, 3600),
  },
});

const isCandle = (value: unknown): value is Candle =>
  Array.isArray(value) &&
  value.length >= 5 &&
  value.slice(0, 5).every((item) => typeof item === 'number' && Number.isFinite(item));

const candleToPoint = (pair: string, candle: Candle): DataPoint | null => {
  const [time, , , , close] = candle;
  if (!Number.isFinite(close)) return null;
  return toPricePoint(pair, close, time * 1000);
};

const toPricePoint = (pair: string, value: number, ts: number): DataPoint => ({
  dimensions: { pair },
  value,
  unit: pair.split('-')[1] ?? 'USD',
  ts,
  sourceUrl: coinbasePriceUrl(pair),
});

const coinbasePriceUrl = (pair: string): string => {
  const base = pair.split('-')[0]?.toLowerCase() ?? pair.toLowerCase();
  return `https://www.coinbase.com/price/${encodeURIComponent(base)}`;
};
