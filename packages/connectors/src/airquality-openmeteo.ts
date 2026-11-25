import { fetchJson } from './fetch-json';
import { isFiniteNumber } from './config-values';
import { parseOpenMeteoTs, rawArray } from './openmeteo-time';
import type { Adapter, AdapterResult, DataPoint } from './types';

type AirConfig = { lat: number; lon: number; location?: string };

type AirCurrent = {
  time?: unknown;
  european_aqi?: number;
  pm2_5?: number;
  pm10?: number;
};

type AirHourly = {
  time?: unknown;
  european_aqi?: unknown;
};

type AirResponse = { current?: AirCurrent; hourly?: AirHourly };

export const AQI_PAST_HOURS = 24;
export const AQI_FORECAST_HOURS = 24;

const SOURCE_PAGE = 'https://open-meteo.com/';

export const airQualityOpenMeteo: Adapter<AirConfig> = async (config): Promise<AdapterResult> => {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(config.lat)}` +
    `&longitude=${encodeURIComponent(config.lon)}` +
    `&current=european_aqi,pm2_5,pm10` +
    `&hourly=european_aqi&past_hours=${AQI_PAST_HOURS}&forecast_hours=${AQI_FORECAST_HOURS}` +
    `&timeformat=unixtime`;

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
  const { current, hourly } = body as AirResponse;
  if (!current || typeof current !== 'object') return [];

  const location = config.location ?? `${config.lat},${config.lon}`;
  const ts = parseOpenMeteoTs(current.time);
  const points: DataPoint[] = [];

  pushCurrent(points, location, 'aqi', current.european_aqi, 'EAQI', ts);
  pushCurrent(points, location, 'pm2_5', current.pm2_5, 'µg/m³', ts);
  pushCurrent(points, location, 'pm10', current.pm10, 'µg/m³', ts);
  points.push(...hourlyAqiPoints(hourly, location));
  return points;
};

const pushCurrent = (
  points: DataPoint[],
  location: string,
  metric: string,
  value: number | undefined,
  unit: string,
  ts: number,
): void => {
  if (!isFiniteNumber(value)) return;
  points.push({ dimensions: { location, metric }, value, unit, ts, sourceUrl: SOURCE_PAGE });
};

// Hour offsets are relative to now: -24..-1 observed, 0.. forecast.
const hourlyAqiPoints = (hourly: AirHourly | undefined, location: string): DataPoint[] => {
  if (!hourly || typeof hourly !== 'object') return [];
  const times = rawArray(hourly.time).slice(0, AQI_PAST_HOURS + AQI_FORECAST_HOURS);
  const values = rawArray(hourly.european_aqi);
  const points: DataPoint[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const value = values[index];
    if (!isFiniteNumber(value)) continue;
    points.push({
      dimensions: { location, metric: 'hourly_aqi', hour: index - AQI_PAST_HOURS },
      value,
      unit: 'EAQI',
      ts: parseOpenMeteoTs(times[index]),
      sourceUrl: SOURCE_PAGE,
    });
  }
  return points;
};
