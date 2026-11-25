import { isFiniteNumber } from './config-values';
import { parseOpenMeteoTs, rawArray } from './openmeteo-time';
import type { DataPoint } from './types';

export const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
] as const;

export const DAILY_FORECAST_DAYS = 6;

const SOURCE_PAGE = 'https://open-meteo.com/';

type OpenMeteoDaily = {
  time?: unknown;
  weather_code?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_probability_max?: unknown;
};

export const buildDailyPoints = (daily: unknown, location: string): DataPoint[] => {
  if (!daily || typeof daily !== 'object') return [];
  const shape = daily as OpenMeteoDaily;
  const times = rawArray(shape.time).slice(0, DAILY_FORECAST_DAYS);
  const points: DataPoint[] = [];
  for (let day = 0; day < times.length; day += 1) {
    const ts = parseOpenMeteoTs(times[day]);
    pushDailyNumber(
      points,
      location,
      'daily_weather_code',
      day,
      rawArray(shape.weather_code)[day],
      undefined,
      ts,
    );
    pushDailyNumber(
      points,
      location,
      'daily_temp_max',
      day,
      rawArray(shape.temperature_2m_max)[day],
      '°C',
      ts,
    );
    pushDailyNumber(
      points,
      location,
      'daily_temp_min',
      day,
      rawArray(shape.temperature_2m_min)[day],
      '°C',
      ts,
    );
    pushDailyNumber(
      points,
      location,
      'daily_rain_prob',
      day,
      rawArray(shape.precipitation_probability_max)[day],
      '%',
      ts,
    );
  }
  return points;
};

const pushDailyNumber = (
  points: DataPoint[],
  location: string,
  metric: string,
  day: number,
  value: unknown,
  unit: string | undefined,
  ts: number,
): void => {
  if (!isFiniteNumber(value)) return;
  points.push({
    dimensions: { location, metric, day },
    value,
    ...(unit !== undefined ? { unit } : {}),
    ts,
    sourceUrl: SOURCE_PAGE,
  });
};
