import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult } from './types';
import { DAILY_FIELDS, DAILY_FORECAST_DAYS } from './weather-openmeteo-daily';
import {
  buildWeatherPoints,
  CURRENT_FIELDS,
  HOURLY_FIELDS,
  type WeatherConfig,
} from './weather-openmeteo-points';

export const weatherOpenMeteo: Adapter<WeatherConfig> = async (config): Promise<AdapterResult> => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(config.lat));
  url.searchParams.set('longitude', String(config.lon));
  url.searchParams.set('current', CURRENT_FIELDS.join(','));
  url.searchParams.set('hourly', HOURLY_FIELDS.join(','));
  url.searchParams.set('daily', DAILY_FIELDS.join(','));
  url.searchParams.set('forecast_hours', '12');
  url.searchParams.set('forecast_days', String(DAILY_FORECAST_DAYS));
  // Daily aggregates need the location's own day boundaries; unixtime keeps parsing zone-safe.
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('timeformat', 'unixtime');

  const fetched = await fetchJson(url.toString());
  if (!fetched.ok) return fetched;

  const points = buildWeatherPoints(fetched.body, config);
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected response shape' } };
  }
  return { ok: true, points, rawPayload: fetched.body };
};
