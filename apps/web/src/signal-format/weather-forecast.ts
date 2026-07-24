import type { DataPoint } from '../api';
import { weatherCondition } from './weather-conditions';
import type { WeatherForecastHour } from './weather-types';

type ForecastMetric =
  'hourly_temperature' | 'hourly_precipitation_probability' | 'hourly_weather_code';

type ForecastBucket = {
  ts: number;
  temp: number | null;
  rainProb: number | null;
  code: number | null;
};

const FORECAST_LIMIT = 12;

export const extractForecast = (points: ReadonlyArray<DataPoint>): WeatherForecastHour[] => {
  const byHour = new Map<number, ForecastBucket>();
  for (const point of points) {
    const metric = forecastMetric(point.dimensions?.metric);
    const hourOffset = hourOffsetOf(point);
    if (!metric || !Number.isFinite(hourOffset)) continue;
    const current = byHour.get(hourOffset) ?? initialBucket(point);
    byHour.set(hourOffset, applyForecastPoint(current, metric, point));
  }
  return orderedForecastHours(byHour).slice(0, FORECAST_LIMIT);
};

export const forecastHourLabel = (hour: WeatherForecastHour): string => {
  if (!Number.isFinite(hour.ts) || hour.ts <= 0) return `+${String(hour.hourOffset)}h`;
  const h = new Date(hour.ts).getHours();
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  if (h < 12) return `${String(h)}a`;
  return `${String(h - 12)}p`;
};

export const peakRainHour = (
  forecast: ReadonlyArray<WeatherForecastHour>,
): { hour: WeatherForecastHour; pct: number } | null =>
  forecast.reduce<{ hour: WeatherForecastHour; pct: number } | null>((best, h) => {
    if (h.rainProb === null) return best;
    if (best === null || h.rainProb > best.pct) return { hour: h, pct: h.rainProb };
    return best;
  }, null);

const forecastMetric = (metric: unknown): ForecastMetric | null => {
  if (
    metric === 'hourly_temperature' ||
    metric === 'hourly_precipitation_probability' ||
    metric === 'hourly_weather_code'
  ) {
    return metric;
  }
  return null;
};

const hourOffsetOf = (point: DataPoint): number => {
  const raw = point.dimensions?.hour;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return Number(raw);
  return Number.NaN;
};

const initialBucket = (point: DataPoint): ForecastBucket => ({
  ts: typeof point.ts === 'number' ? point.ts : 0,
  temp: null,
  rainProb: null,
  code: null,
});

const applyForecastPoint = (
  bucket: ForecastBucket,
  metric: ForecastMetric,
  point: DataPoint,
): ForecastBucket => {
  const next = { ...bucket };
  if (typeof point.ts === 'number' && point.ts > next.ts) next.ts = point.ts;
  if (typeof point.value !== 'number') return next;
  if (metric === 'hourly_temperature') next.temp = point.value;
  else if (metric === 'hourly_precipitation_probability') next.rainProb = point.value;
  else next.code = point.value;
  return next;
};

const orderedForecastHours = (byHour: ReadonlyMap<number, ForecastBucket>): WeatherForecastHour[] =>
  [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hourOffset, hour]) => forecastHour(hourOffset, hour))
    .filter((hour): hour is WeatherForecastHour => hour !== null);

const forecastHour = (hourOffset: number, hour: ForecastBucket): WeatherForecastHour | null => {
  if (hour.temp === null) return null;
  return {
    hourOffset,
    ts: hour.ts,
    condition: weatherCondition(hour.code ?? undefined),
    temp: hour.temp,
    rainProb: hour.rainProb,
    code: hour.code,
  };
};
