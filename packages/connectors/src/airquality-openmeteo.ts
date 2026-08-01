import { fetchJson } from './fetch-json';
import { isFiniteNumber } from './config-values';
import type { Adapter, AdapterResult, DataPoint } from './types';

type AirConfig = { lat: number; lon: number; location?: string };

type AirCurrent = {
  time?: string;
  european_aqi?: number;
  pm2_5?: number;
  pm10?: number;
};

type AirResponse = { current?: AirCurrent };

export const airQualityOpenMeteo: Adapter<AirConfig> = async (config): Promise<AdapterResult> => {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(config.lat)}` +
    `&longitude=${encodeURIComponent(config.lon)}` +
    `&current=european_aqi,pm2_5,pm10`;

  const fetched = await fetchJson(url);
  if (!fetched.ok) return fetched;

  const points = buildPoints(fetched.body, config);
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected response shape' } };
  }
  return { ok: true, points, rawPayload: fetched.body };
};

const buildPoints = (body: unknown, config: AirConfig): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const current = (body as AirResponse).current;
  if (!current || typeof current !== 'object') return [];

  const location = config.location ?? `${config.lat},${config.lon}`;
  const ts = parseTs(current.time);
  const points: DataPoint[] = [];

  if (isFiniteNumber(current.european_aqi)) {
    points.push({
      dimensions: { location, metric: 'aqi' },
      value: current.european_aqi,
      unit: 'EAQI',
      ts,
    });
  }
  if (isFiniteNumber(current.pm2_5)) {
    points.push({
      dimensions: { location, metric: 'pm2_5' },
      value: current.pm2_5,
      unit: 'µg/m³',
      ts,
    });
  }
  if (isFiniteNumber(current.pm10)) {
    points.push({
      dimensions: { location, metric: 'pm10' },
      value: current.pm10,
      unit: 'µg/m³',
      ts,
    });
  }
  return points;
};

const parseTs = (time: string | undefined): number => {
  if (typeof time !== 'string') return Date.now();
  const parsed = Date.parse(time);
  return Number.isFinite(parsed) ? parsed : Date.now();
};
