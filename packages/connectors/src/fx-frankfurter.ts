import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult, DataPoint } from './types';

type FxConfig = { base: string; quote: string };

// Points are timestamped with the ECB reference date, not the call time. Every
// tick re-fetches the whole range; the dispatcher's onConflictDoNothing on
// (signal, date) means only the newest day inserts.

type FrankfurterLatest = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

type FrankfurterRange = {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
};

const HISTORY_HOST = 'https://api.frankfurter.dev/v1';
const HISTORY_DAYS = 365;

export const fxFrankfurter: Adapter<FxConfig> = async (config): Promise<AdapterResult> => {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - HISTORY_DAYS);
  const startDate = toIsoDate(start);
  const endDate = toIsoDate(today);
  const rangeUrl = `${HISTORY_HOST}/${startDate}..${endDate}?from=${encodeURIComponent(config.base)}&to=${encodeURIComponent(config.quote)}`;
  const latestUrl = `${HISTORY_HOST}/latest?base=${encodeURIComponent(config.base)}&symbols=${encodeURIComponent(config.quote)}`;

  const range = await fetchJson(rangeUrl);
  if (range.ok) return pointsResult(range.body, config);

  const latest = await fetchJson(latestUrl);
  if (!latest.ok) return latest;
  return pointsResult(latest.body, config);
};

const pointsResult = (body: unknown, config: FxConfig): AdapterResult => {
  const points = parseFrankfurterRange(body, config);
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected response shape' } };
  }

  return { ok: true, points, rawPayload: body };
};

const parseFrankfurterRange = (body: unknown, config: FxConfig): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const candidate = body as Partial<FrankfurterRange> & Partial<FrankfurterLatest>;
  const pair = `${config.base}/${config.quote}`;

  // Range shape: { rates: { 'YYYY-MM-DD': { QUOTE: rate } } }
  const rangeRates = candidate.rates as unknown;
  if (rangeRates && typeof rangeRates === 'object' && !Array.isArray(rangeRates)) {
    const points: DataPoint[] = [];
    for (const [date, perDate] of Object.entries(rangeRates)) {
      if (!perDate || typeof perDate !== 'object') continue;
      const rate = (perDate as Record<string, unknown>)[config.quote];
      if (typeof rate !== 'number') continue;
      const ts = Date.parse(date);
      if (!Number.isFinite(ts)) continue;
      points.push({
        dimensions: { pair },
        value: rate,
        unit: config.quote,
        ts,
      });
    }
    if (points.length > 0) return points;
  }

  // Legacy /latest shape: { date: 'YYYY-MM-DD', rates: { QUOTE: rate } }
  if (rangeRates && typeof rangeRates === 'object') {
    const flat = rangeRates as Record<string, unknown>;
    const rate = flat[config.quote];
    if (typeof rate === 'number' && typeof candidate.date === 'string') {
      const ts = Date.parse(candidate.date);
      if (Number.isFinite(ts)) {
        return [
          {
            dimensions: { pair },
            value: rate,
            unit: config.quote,
            ts,
          },
        ];
      }
    }
  }

  return [];
};

const toIsoDate = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
