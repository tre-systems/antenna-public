import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult } from './types';
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
  url.searchParams.set('forecast_hours', '12');

  const fetched = await fetchJson(url.toString());
  if (!fetched.ok) return fetched;

  const points = buildWeatherPoints(fetched.body, config);
  if (points.length === 0) {
    return { ok: false, error: { code: 'parse_failed', message: 'unexpected response shape' } };
  }
  return { ok: true, points, rawPayload: fetched.body };
};
