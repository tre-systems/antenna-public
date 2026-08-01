import { errorMessage } from './error-message';
import type { Adapter, AdapterError, AdapterResult, DataPoint } from './types';
import { retryAfterSecondsFromHeaders } from './http-retry-after';
import { discardResponse } from './discard-response';

export type TradingEconomicsMarketConfig = {
  readonly symbol: string;
  readonly apiKey?: string;
  readonly label?: string;
  readonly unit?: string;
  readonly sourceUrl?: string;
  readonly days?: number;
};

type HistoricalRow = {
  readonly Symbol?: string;
  readonly Date?: string;
  readonly Close?: number | string | null;
  readonly Value?: number | string | null;
  readonly Last?: number | string | null;
  readonly URL?: string | null;
  readonly unit?: string | null;
};

const DEFAULT_DAYS = 365;
const MAX_DAYS = 730;

export const tradingEconomicsMarket: Adapter<TradingEconomicsMarketConfig> = async (
  config,
): Promise<AdapterResult> => {
  const symbol = config.symbol.trim().toUpperCase();
  if (symbol.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'symbol is required' } };
  }

  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'TRADING_ECONOMICS_API_KEY is required for Trading Economics market data',
      },
    };
  }

  const fetched = await fetchHistorical(symbol, apiKey, clampDays(config.days ?? DEFAULT_DAYS));
  if (!fetched.ok) return fetched;

  const points = parseHistoricalRows(fetched.body, {
    symbol,
    label: config.label ?? symbol,
    unit: config.unit,
    sourceUrl: config.sourceUrl,
  });
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no market rows parsed' } };
  }

  return { ok: true, points, rawPayload: fetched.body };
};

const clampDays = (days: number): number => {
  if (!Number.isFinite(days)) return DEFAULT_DAYS;
  return Math.max(1, Math.min(Math.round(days), MAX_DAYS));
};

const fetchHistorical = async (
  symbol: string,
  apiKey: string,
  days: number,
): Promise<{ ok: true; body: unknown } | { ok: false; error: AdapterError }> => {
  const { d1, d2 } = dateRange(days);
  // TE puts credentials in the URL, so every returned error must remain key-free.
  const params = new URLSearchParams({ c: apiKey, d1, d2, f: 'json' });
  const url = `https://api.tradingeconomics.com/markets/historical/${encodeURIComponent(symbol)}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    return { ok: false, error: { code: 'fetch_failed', message: errorMessage(err) } };
  }

  if (response.status === 401 || response.status === 403 || response.status === 410) {
    await discardResponse(response);
    return {
      ok: false,
      error: { code: 'unauthorized', message: `Trading Economics rejected credentials` },
    };
  }
  if (response.status === 429) {
    await discardResponse(response);
    return {
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Trading Economics rate limited',
        retryAfterSeconds: retryAfterSecondsFromHeaders(response.headers, 3600),
      },
    };
  }
  if (!response.ok) {
    await discardResponse(response);
    return { ok: false, error: { code: 'fetch_failed', message: `HTTP ${response.status}` } };
  }

  try {
    return { ok: true, body: await response.json() };
  } catch (err) {
    return { ok: false, error: { code: 'parse_failed', message: errorMessage(err) } };
  }
};

const dateRange = (days: number): { d1: string; d2: string } => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  return { d1: toIsoDate(start), d2: toIsoDate(end) };
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

type ParseContext = {
  readonly symbol: string;
  readonly label: string;
  readonly unit?: string;
  readonly sourceUrl?: string;
};

const parseHistoricalRows = (body: unknown, context: ParseContext): DataPoint[] => {
  if (!Array.isArray(body)) return [];
  const points: DataPoint[] = [];

  for (const row of body) {
    const point = rowToPoint(row, context);
    if (point) points.push(point);
  }

  return points;
};

const rowToPoint = (row: unknown, context: ParseContext): DataPoint | null => {
  if (!row || typeof row !== 'object') return null;
  const typed = row as HistoricalRow;
  const value = numeric(typed.Close ?? typed.Value ?? typed.Last);
  if (value === null) return null;

  const ts = parseDate(typed.Date);
  if (ts === null) return null;

  const symbol = (typed.Symbol ?? context.symbol).toUpperCase();
  return {
    dimensions: { symbol, label: context.label },
    value,
    unit: context.unit ?? typed.unit ?? undefined,
    ts,
    sourceUrl: context.sourceUrl ?? sourceUrlFromPath(typed.URL) ?? undefined,
  };
};

const numeric = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: string | undefined): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (dmy) {
    const [, d, m, y] = dmy;
    const ts = Date.UTC(Number(y), Number(m) - 1, Number(d));
    return Number.isFinite(ts) ? ts : null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const sourceUrlFromPath = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `https://tradingeconomics.com${path}`;
  return null;
};
