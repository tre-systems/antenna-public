import {
  allPairsFailed,
  clampDays,
  defaultDays,
  fetchPairCandles,
} from './crypto-coinbase-candles-client';
import type { Adapter, AdapterResult, DataPoint } from './types';

export type CoinbaseCandlesConfig = {
  readonly pairs: string[];
  readonly days?: number;
};

export const cryptoCoinbaseCandles: Adapter<CoinbaseCandlesConfig> = async (
  config,
): Promise<AdapterResult> => {
  if (config.pairs.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'no pairs provided' } };
  }

  const days = clampDays(config.days ?? defaultDays());
  const outcomes = await Promise.all(config.pairs.map((pair) => fetchPairCandles(pair, days)));
  const points: DataPoint[] = [];
  const perPair: Record<string, unknown> = {};

  outcomes.forEach((outcome, index) => {
    const pair = config.pairs[index] ?? '';
    if (outcome.ok) {
      points.push(...outcome.points);
      perPair[pair] = outcome.raw;
    } else {
      perPair[pair] = { error: outcome.error };
    }
  });

  if (points.length === 0) return allPairsFailed(outcomes);

  return { ok: true, points, rawPayload: { perPair } };
};
