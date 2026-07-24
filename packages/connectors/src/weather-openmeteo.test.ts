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

describe('weatherOpenMeteo', () => {
  it('returns current condition and 12-hour forecast DataPoints on a happy path', async () => {
    const hourlyTimes = Array.from(
      { length: 13 },
      (_, index) => `2026-05-19T${String(10 + index).padStart(2, '0')}:00`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: {
            time: '2026-05-19T10:00',
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
        }),
      ),
    );

    const result = await weatherOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m%2Crelative_humidity_2m%2Cwind_speed_10m%2Capparent_temperature%2Cprecipitation%2Cweather_code%2Cuv_index%2Cis_day&hourly=temperature_2m%2Cprecipitation_probability%2Cweather_code&forecast_hours=12',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(44);
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
  });

  it('uses forecast-hour timestamps for hourly forecast rows', async () => {
    const hourlyTimes = Array.from(
      { length: 13 },
      (_, index) => `2026-05-19T${String(10 + index).padStart(2, '0')}:00`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: {
            time: '2026-05-19T10:00',
            temperature_2m: 18.4,
            relative_humidity_2m: 62,
            wind_speed_10m: 3.1,
            apparent_temperature: 17.2,
            precipitation: 0,
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
        }),
      ),
    );
    const result = await weatherOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const currentTs = Date.parse('2026-05-19T10:00');
    expect(result.points.slice(0, 8).every((p) => p.ts === currentTs)).toBe(true);
    const hour12 = result.points.find(
      (p) => p.dimensions.metric === 'hourly_temperature' && p.dimensions.hour === 12,
    );
    expect(hour12?.ts).toBe(Date.parse('2026-05-19T21:00'));
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
