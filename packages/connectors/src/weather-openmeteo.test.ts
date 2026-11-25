import { afterEach, describe, expect, it, vi } from 'vitest';
import { weatherOpenMeteo } from './weather-openmeteo';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

// Open-Meteo returns unixtime seconds because the adapter requests timeformat=unixtime.
const T0 = Date.parse('2026-05-19T10:00:00Z') / 1000;
const D0 = Date.parse('2026-05-19T00:00:00Z') / 1000;

const happyBody = () => {
  const hourlyTimes = Array.from({ length: 13 }, (_, index) => T0 + index * 3600);
  const dailyTimes = Array.from({ length: 6 }, (_, index) => D0 + index * 86_400);
  return {
    current: {
      time: T0,
      temperature_2m: 18.4,
      relative_humidity_2m: 62,
      wind_speed_10m: 3.1,
      apparent_temperature: 17.2,
      precipitation: 0.1,
      weather_code: 61,
      uv_index: 4.3,
      is_day: 1,
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map((_, index) => 18 + index),
      precipitation_probability: hourlyTimes.map((_, index) => 10 + index),
      weather_code: hourlyTimes.map(() => 61),
    },
    daily: {
      time: dailyTimes,
      weather_code: dailyTimes.map(() => 3),
      temperature_2m_max: dailyTimes.map((_, index) => 20 + index),
      temperature_2m_min: dailyTimes.map((_, index) => 9 + index),
      precipitation_probability_max: dailyTimes.map((_, index) => 5 * index),
    },
  };
};

describe('weatherOpenMeteo', () => {
  it('returns current, 12-hour, and 6-day forecast DataPoints on a happy path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(happyBody())));

    const result = await weatherOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m%2Crelative_humidity_2m%2Cwind_speed_10m%2Capparent_temperature%2Cprecipitation%2Cweather_code%2Cuv_index%2Cis_day&hourly=temperature_2m%2Cprecipitation_probability%2Cweather_code&daily=weather_code%2Ctemperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max&forecast_hours=12&forecast_days=6&timezone=auto&timeformat=unixtime',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(68);
    const metrics = result.points.map((p) => p.dimensions.metric);
    expect(metrics.slice(0, 8)).toEqual([
      'temperature',
      'humidity',
      'wind',
      'feels_like',
      'precipitation',
      'weather_code',
      'uv_index',
      'is_day',
    ]);
    expect(metrics.filter((metric) => metric === 'hourly_temperature')).toHaveLength(12);
    expect(metrics.filter((metric) => metric === 'hourly_precipitation_probability')).toHaveLength(
      12,
    );
    expect(metrics.filter((metric) => metric === 'hourly_weather_code')).toHaveLength(12);
    for (const metric of [
      'daily_weather_code',
      'daily_temp_max',
      'daily_temp_min',
      'daily_rain_prob',
    ]) {
      expect(metrics.filter((m) => m === metric)).toHaveLength(6);
    }
    expect(result.points.every((p) => p.dimensions.location === 'Berlin')).toBe(true);
    expect(result.points.every((p) => p.sourceUrl === 'https://open-meteo.com/')).toBe(true);
    expect(
      result.points.find((p) => p.dimensions.metric === 'hourly_temperature')?.dimensions.hour,
    ).toBe(1);
    expect(
      result.points.find(
        (p) => p.dimensions.metric === 'hourly_temperature' && p.dimensions.hour === 12,
      )?.value,
    ).toBe(29);
    const day5Max = result.points.find(
      (p) => p.dimensions.metric === 'daily_temp_max' && p.dimensions.day === 5,
    );
    expect(day5Max?.value).toBe(25);
    expect(day5Max?.unit).toBe('°C');
    expect(day5Max?.ts).toBe((D0 + 5 * 86_400) * 1000);
  });

  it('uses forecast timestamps for hourly and daily rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(happyBody())));
    const result = await weatherOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.slice(0, 8).every((p) => p.ts === T0 * 1000)).toBe(true);
    const hour12 = result.points.find(
      (p) => p.dimensions.metric === 'hourly_temperature' && p.dimensions.hour === 12,
    );
    expect(hour12?.ts).toBe((T0 + 11 * 3600) * 1000);
    const day0 = result.points.find(
      (p) => p.dimensions.metric === 'daily_rain_prob' && p.dimensions.day === 0,
    );
    expect(day0?.ts).toBe(D0 * 1000);
  });

  it('falls back to "lat,lon" when no location provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ current: { time: '2026-05-19T10:00', temperature_2m: 10 } }),
        ),
    );

    const result = await weatherOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]?.dimensions.location).toBe('1,2');
  });

  it('maps non-2xx to fetch_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    const result = await weatherOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
  });

  it('maps malformed JSON to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const result = await weatherOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('returns parse_failed when current signal is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const result = await weatherOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });
});
