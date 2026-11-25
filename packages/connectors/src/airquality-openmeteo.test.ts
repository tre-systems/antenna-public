import { afterEach, describe, expect, it, vi } from 'vitest';
import { airQualityOpenMeteo } from './airquality-openmeteo';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

const T0 = Date.parse('2026-05-19T10:00:00Z') / 1000;

describe('airQualityOpenMeteo', () => {
  it('returns AQI, PM2.5 and PM10 points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: { time: T0, european_aqi: 42, pm2_5: 8.1, pm10: 14.3 },
        }),
      ),
    );

    const result = await airQualityOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });
    expect(fetch).toHaveBeenCalledWith(
      'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=52.52&longitude=13.41' +
        '&current=european_aqi,pm2_5,pm10&hourly=european_aqi&past_hours=24&forecast_hours=24' +
        '&timeformat=unixtime',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((p) => p.dimensions.metric)).toEqual(['aqi', 'pm2_5', 'pm10']);
    expect(result.points[0]?.value).toBe(42);
    expect(result.points.every((p) => p.sourceUrl === 'https://open-meteo.com/')).toBe(true);
  });

  it('emits a 48-hour AQI series with offsets relative to now', async () => {
    const times = Array.from({ length: 48 }, (_, index) => T0 + (index - 24) * 3600);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: { time: T0, european_aqi: 42, pm2_5: 8.1, pm10: 14.3 },
          hourly: { time: times, european_aqi: times.map((_, index) => 30 + index) },
        }),
      ),
    );

    const result = await airQualityOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hourly = result.points.filter((p) => p.dimensions.metric === 'hourly_aqi');
    expect(hourly).toHaveLength(48);
    expect(hourly[0]?.dimensions.hour).toBe(-24);
    expect(hourly[0]?.ts).toBe((T0 - 24 * 3600) * 1000);
    expect(hourly[47]?.dimensions.hour).toBe(23);
    expect(hourly[47]?.value).toBe(77);
    expect(hourly.every((p) => p.unit === 'EAQI')).toBe(true);
  });

  it('maps non-2xx to fetch_failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));
    const result = await airQualityOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('fetch_failed');
  });

  it('maps malformed JSON to parse_failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('xxx', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
    );
    const result = await airQualityOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });

  it('returns parse_failed on empty shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ current: {} })));
    const result = await airQualityOpenMeteo({ lat: 1, lon: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('parse_failed');
  });
});
