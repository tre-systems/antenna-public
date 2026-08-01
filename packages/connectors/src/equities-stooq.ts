import type { Adapter, AdapterResult, DataPoint } from './types';
import { fetchStooqCsv } from './stooq';
import { fetchYahooLatestQuote, yahooSymbolForStooqTicker } from './yahoo-quote';

type EquitiesConfig = { tickers: string[] };

export const equitiesStooq: Adapter<EquitiesConfig> = async (config): Promise<AdapterResult> => {
  if (config.tickers.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no tickers provided' } };
  }

  const bodies: string[] = [];
  const points: DataPoint[] = [];
  const failures: string[] = [];
  for (const ticker of config.tickers) {
    const csv = await fetchStooqCsv(ticker);
    if (!csv.ok) {
      const fallback = await yahooPointForTicker(ticker);
      if (fallback.ok) {
        bodies.push(JSON.stringify(fallback.rawPayload));
        points.push(fallback.point);
        failures.push(`${ticker}: stooq ${csv.error.code}: ${csv.error.message}; used yahoo`);
        continue;
      }
      failures.push(
        `${ticker}: ${csv.error.code}: ${csv.error.message}; yahoo ${fallback.error.code}: ${fallback.error.message}`,
      );
      continue;
    }

    const parsed = parseCsv(csv.body);
    if (parsed.length === 0) {
      const fallback = await yahooPointForTicker(ticker);
      if (fallback.ok) {
        bodies.push(csv.body, JSON.stringify(fallback.rawPayload));
        points.push(fallback.point);
        failures.push(`${ticker}: stooq parse_failed: no rows parsed; used yahoo`);
        continue;
      }
      failures.push(
        `${ticker}: parse_failed: no rows parsed; yahoo ${fallback.error.code}: ${fallback.error.message}`,
      );
      continue;
    }
    bodies.push(csv.body);
    points.push(...parsed);
  }

  if (points.length === 0) {
    if (failures.length > 0) {
      const code = failures.some((failure) => failure.includes('fetch_failed'))
        ? 'fetch_failed'
        : 'parse_failed';
      return { ok: false, error: { code, message: failures.join('; ') } };
    }
    return { ok: false, error: { code: 'parse_failed', message: 'no rows parsed' } };
  }
  return { ok: true, points, rawPayload: [...bodies, ...failures].join('\n\n') };
};

type YahooPointResult =
  | { readonly ok: true; readonly point: DataPoint; readonly rawPayload: unknown }
  | Extract<AdapterResult, { ok: false }>;

const yahooPointForTicker = async (ticker: string): Promise<YahooPointResult> => {
  const result = await fetchYahooLatestQuote(yahooSymbolForStooqTicker(ticker));
  if (!result.ok) return result;
  return {
    ok: true,
    point: {
      dimensions: { ticker: result.quote.symbol.toUpperCase(), exchange: 'YAHOO' },
      value: result.quote.price,
      unit: result.quote.currency,
      ts: result.quote.ts,
      sourceUrl: result.quote.sourceUrl,
    },
    rawPayload: result.rawPayload,
  };
};

// Stooq's fixed CSV shape uses "N/D" for missing closes.
const parseCsv = (csv: string): DataPoint[] => {
  const lines = csv
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const points: DataPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = (lines[i] ?? '').split(',');
    const point = rowToPoint(row);
    if (point) points.push(point);
  }
  return points;
};

const rowToPoint = (row: string[]): DataPoint | null => {
  const symbol = row[0];
  const date = row[1];
  const time = row[2];
  const closeRaw = row[6];
  if (!symbol || !closeRaw || closeRaw === 'N/D') return null;
  const close = Number(closeRaw);
  if (!Number.isFinite(close)) return null;
  const ticker = symbol.toUpperCase();
  return {
    dimensions: { ticker, exchange: 'STOOQ' },
    value: close,
    unit: currencyForTicker(ticker),
    ts: parseTs(date, time),
  };
};

// Map common ticker suffixes so prices do not render as bare numbers.
const TICKER_CURRENCY: Record<string, string> = {
  UK: 'GBP',
  L: 'GBP',
  US: 'USD',
  N: 'USD',
  Q: 'USD',
  DE: 'EUR',
  F: 'EUR',
  PA: 'EUR',
  AS: 'EUR',
  MI: 'EUR',
  MC: 'EUR',
  ST: 'SEK',
  CO: 'DKK',
  OL: 'NOK',
  SW: 'CHF',
  HK: 'HKD',
  T: 'JPY',
  AU: 'AUD',
  TO: 'CAD',
};
const currencyForTicker = (ticker: string): string => {
  const dot = ticker.lastIndexOf('.');
  if (dot === -1) return 'USD'; // bare symbols (e.g. AAPL) historically meant US
  const suffix = ticker.slice(dot + 1);
  return TICKER_CURRENCY[suffix] ?? '';
};

const parseTs = (date: string | undefined, time: string | undefined): number => {
  if (!date) return Date.now();
  const stamp = time ? `${date}T${time}Z` : `${date}T00:00:00Z`;
  const parsed = Date.parse(stamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
};
