import type { Adapter, AdapterResult, DataPoint } from './types';

// The Worker supplies only aggregate D1 counts so this adapter remains pure.
export type AntennaUsersConfig = {
  readonly total_users?: number;
  readonly new_users_24h?: number;
  readonly new_users_7d?: number;
  readonly active_users_7d?: number;
  readonly collections?: number;
  readonly signals?: number;
};

// Card order. Labels come from the registry's metric table, keyed off `metric`.
const METRICS: ReadonlyArray<{ key: keyof AntennaUsersConfig; unit: string }> = [
  { key: 'total_users', unit: 'users' },
  { key: 'active_users_7d', unit: 'users' },
  { key: 'new_users_7d', unit: 'users' },
  { key: 'new_users_24h', unit: 'users' },
  { key: 'collections', unit: 'collections' },
  { key: 'signals', unit: 'signals' },
];

export const antennaUsers: Adapter<AntennaUsersConfig> = (config): Promise<AdapterResult> => {
  const points = METRICS.flatMap<DataPoint>(({ key, unit }) => {
    const value = config[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    return [
      {
        dimensions: { metric: key },
        value,
        unit,
        ts: Date.now(),
      },
    ];
  });

  if (points.length === 0) {
    return Promise.resolve({
      ok: false,
      error: { code: 'parse_failed', message: 'no deployment user counts available' },
    });
  }

  return Promise.resolve({ ok: true, points, rawPayload: { source: 'antenna-d1' } });
};
