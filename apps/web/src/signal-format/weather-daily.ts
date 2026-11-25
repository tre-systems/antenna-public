import type { DataPoint } from '../api';
import { pointTs } from './common';
import { weatherCondition } from './weather-conditions';
import type { WeatherForecastDay } from './weather-types';

type DailyMetric = 'daily_weather_code' | 'daily_temp_max' | 'daily_temp_min' | 'daily_rain_prob';

type DailyBucket = {
  ts: number;
  code: number | null;
  tempMax: number | null;
  tempMin: number | null;
  rainProb: number | null;
};

const DAILY_LIMIT = 6;

export const extractDaily = (points: ReadonlyArray<DataPoint>): WeatherForecastDay[] => {
  const byDay = new Map<number, DailyBucket>();
  for (const point of points) {
    const metric = dailyMetric(point.dimensions?.metric);
    const dayOffset = dayOffsetOf(point);
    if (!metric || !Number.isFinite(dayOffset)) continue;
    const current = byDay.get(dayOffset) ?? initialBucket(point);
    byDay.set(dayOffset, applyDailyPoint(current, metric, point));
  }
  return orderedDays(byDay).slice(0, DAILY_LIMIT);
};

export const forecastDayLabel = (day: WeatherForecastDay): string => {
  if (day.dayOffset === 0) return 'Today';
  if (!Number.isFinite(day.ts) || day.ts <= 0) return `+${String(day.dayOffset)}d`;
  return new Date(day.ts).toLocaleDateString(undefined, { weekday: 'short' });
};

const dailyMetric = (metric: unknown): DailyMetric | null => {
  if (
    metric === 'daily_weather_code' ||
    metric === 'daily_temp_max' ||
    metric === 'daily_temp_min' ||
    metric === 'daily_rain_prob'
  ) {
    return metric;
  }
  return null;
};

const dayOffsetOf = (point: DataPoint): number => {
  const raw = point.dimensions?.day;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return Number(raw);
  return Number.NaN;
};

const initialBucket = (point: DataPoint): DailyBucket => ({
  ts: pointTs(point) ?? 0,
  code: null,
  tempMax: null,
  tempMin: null,
  rainProb: null,
});

const applyDailyPoint = (
  bucket: DailyBucket,
  metric: DailyMetric,
  point: DataPoint,
): DailyBucket => {
  const next = { ...bucket };
  const ts = pointTs(point);
  if (ts !== null && ts > next.ts) next.ts = ts;
  if (typeof point.value !== 'number') return next;
  if (metric === 'daily_temp_max') next.tempMax = point.value;
  else if (metric === 'daily_temp_min') next.tempMin = point.value;
  else if (metric === 'daily_rain_prob') next.rainProb = point.value;
  else next.code = point.value;
  return next;
};

const orderedDays = (byDay: ReadonlyMap<number, DailyBucket>): WeatherForecastDay[] =>
  [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayOffset, bucket]) => forecastDay(dayOffset, bucket))
    .filter((day): day is WeatherForecastDay => day !== null);

const forecastDay = (dayOffset: number, bucket: DailyBucket): WeatherForecastDay | null => {
  if (bucket.tempMax === null || bucket.tempMin === null) return null;
  return {
    dayOffset,
    ts: bucket.ts,
    condition: weatherCondition(bucket.code ?? undefined),
    tempMax: bucket.tempMax,
    tempMin: bucket.tempMin,
    rainProb: bucket.rainProb,
  };
};
