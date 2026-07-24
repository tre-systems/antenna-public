import { fetchJson } from './fetch-json';
import type { Adapter, AdapterError, AdapterResult, DataPoint } from './types';

type CryptoConfig = { pairs: string[] };

type CoinbaseSpot = { data?: { amount?: string; base?: string; currency?: string } };

type PairOutcome =
  { ok: true; point: DataPoint; raw: unknown } | { ok: false; error: AdapterError };

export const cryptoCoinbase: Adapter<CryptoConfig> = async (config): Promise<AdapterResult> => {
  const outcomes = await Promise.all(config.pairs.map((pair) => fetchPair(pair)));

  const points: DataPoint[] = [];
  const perPair: Record<string, unknown> = {};

  outcomes.forEach((outcome, i) => {
    const pair = config.pairs[i] ?? '';
    if (outcome.ok) {
      points.push(outcome.point);
      perPair[pair] = outcome.raw;
    } else {
      perPair[pair] = { error: outcome.error };
    }
  });

  if (points.length === 0) {
    return {
      ok: false,
      error: { code: 'fetch_failed', message: 'all pairs failed' },
    };
  }

  return { ok: true, points, rawPayload: { perPair } };
};

const fetchPair = async (pair: string): Promise<PairOutcome> => {
  const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`;

  const fetched = await fetchJson(url);
  if (!fetched.ok) return fetched;

  const point = parseSpot(fetched.body, pair);
  if (!point) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected response shape' } };
  }
  return { ok: true, point, raw: fetched.body };
};

const parseSpot = (body: unknown, pair: string): DataPoint | null => {
  if (!body || typeof body !== 'object') return null;
  const data = (body as CoinbaseSpot).data;
  if (!data || typeof data.amount !== 'string') return null;
  const value = Number(data.amount);
  if (!Number.isFinite(value)) return null;
  const unit = data.currency ?? pair.split('-')[1] ?? 'USD';
  return {
    dimensions: { pair },
    value,
    unit,
    ts: Date.now(),
  };
};
