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

describe('airQualityOpenMeteo', () => {
  it('returns AQI, PM2.5 and PM10 points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: { time: '2026-05-19T10:00', european_aqi: 42, pm2_5: 8.1, pm10: 14.3 },
        }),
      ),
    );

    const result = await airQualityOpenMeteo({ lat: 52.52, lon: 13.41, location: 'Berlin' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.map((p) => p.dimensions.metric)).toEqual(['aqi', 'pm2_5', 'pm10']);
    expect(result.points[0]?.value).toBe(42);
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
