import { isFiniteNumber } from './config-values';
import { parseOpenMeteoTs, rawArray } from './openmeteo-time';
import { buildDailyPoints } from './weather-openmeteo-daily';
import type { DataPoint } from './types';

export type WeatherConfig = { lat: number; lon: number; location?: string };

type OpenMeteoCurrent = {
  time?: unknown;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  wind_speed_10m?: number;
  apparent_temperature?: number;
  precipitation?: number;
  weather_code?: number;
  uv_index?: number;
  is_day?: number;
};

type OpenMeteoHourly = {
  time?: unknown;
  temperature_2m?: unknown;
  precipitation_probability?: unknown;
  weather_code?: unknown;
};

type OpenMeteoResponse = { current?: OpenMeteoCurrent; hourly?: OpenMeteoHourly; daily?: unknown };

export const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'wind_speed_10m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'uv_index',
  'is_day',
] as const;

export const HOURLY_FIELDS = [
  'temperature_2m',
  'precipitation_probability',
  'weather_code',
] as const;

const SOURCE_PAGE = 'https://open-meteo.com/';

export const buildWeatherPoints = (body: unknown, config: WeatherConfig): DataPoint[] => {
  if (!body || typeof body !== 'object') return [];
  const { current, hourly, daily } = body as OpenMeteoResponse;
  if (!current || typeof current !== 'object') return [];

  const location = config.location ?? `${config.lat},${config.lon}`;
  const ts = parseOpenMeteoTs(current.time);
  const points: DataPoint[] = [];

  pushCurrentNumber(points, location, 'temperature', current.temperature_2m, '°C', ts);
  pushCurrentNumber(points, location, 'humidity', current.relative_humidity_2m, '%', ts);
  pushCurrentNumber(points, location, 'wind', current.wind_speed_10m, 'm/s', ts);
  pushCurrentNumber(points, location, 'feels_like', current.apparent_temperature, '°C', ts);
  pushCurrentNumber(points, location, 'precipitation', current.precipitation, 'mm', ts);
  pushCurrentNumber(points, location, 'weather_code', current.weather_code, undefined, ts);
  pushCurrentNumber(points, location, 'uv_index', current.uv_index, undefined, ts);
  pushCurrentNumber(points, location, 'is_day', current.is_day, undefined, ts);
  points.push(...hourlyPoints(hourly, location));
  points.push(...buildDailyPoints(daily, location));
  return points;
};

const pushCurrentNumber = (
  points: DataPoint[],
  location: string,
  metric: string,
  value: number | undefined,
  unit: string | undefined,
  ts: number,
): void => {
  if (!isFiniteNumber(value)) return;
  points.push({
    dimensions: { location, metric },
    value,
    ...(unit !== undefined ? { unit } : {}),
    ts,
    sourceUrl: SOURCE_PAGE,
  });
};

const hourlyPoints = (hourly: OpenMeteoHourly | undefined, location: string): DataPoint[] => {
  if (!hourly || typeof hourly !== 'object') return [];
  const times = rawArray(hourly.time).slice(0, 12);
  if (times.length === 0) return [];

  const temperatures = numberArray(hourly.temperature_2m);
  const rainProbabilities = numberArray(hourly.precipitation_probability);
  const weatherCodes = numberArray(hourly.weather_code);
  const points: DataPoint[] = [];

  for (let index = 0; index < times.length; index += 1) {
    const hour = index + 1;
    const ts = parseOpenMeteoTs(times[index]);
    pushHourlyNumber(points, location, 'hourly_temperature', hour, temperatures[index], '°C', ts);
    pushHourlyNumber(
      points,
      location,
      'hourly_precipitation_probability',
      hour,
      rainProbabilities[index],
      '%',
      ts,
    );
    pushHourlyNumber(
      points,
      location,
      'hourly_weather_code',
      hour,
      weatherCodes[index],
      undefined,
      ts,
    );
  }
  return points;
};

const pushHourlyNumber = (
  points: DataPoint[],
  location: string,
  metric: string,
  hour: number,
  value: number | undefined,
  unit: string | undefined,
  ts: number,
): void => {
  if (!isFiniteNumber(value)) return;
  points.push({
    dimensions: { location, metric, hour },
    value,
    ...(unit !== undefined ? { unit } : {}),
    ts,
    sourceUrl: SOURCE_PAGE,
  });
};

const numberArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter(isFiniteNumber) : [];
