import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_ID,
  baseConfig,
  fleetPayload,
  gqlResponse,
  type SentBody,
} from './cloudflare-analytics-test-fixtures';
import { cloudflareAnalytics } from './cloudflare-analytics';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cloudflareAnalytics', () => {
  it('returns complete-day trends, Worker totals, and comparison windows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T08:38:00Z'));
    const fetchMock = vi.fn().mockResolvedValue(gqlResponse(fleetPayload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareAnalytics(baseConfig);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dayPoints = result.points.filter((point) => point.dimensions.kind === 'day');
    const workerPoints = result.points.filter((point) => point.dimensions.kind === 'worker');
    const windowPoints = result.points.filter((point) => point.dimensions.kind === 'fleet-window');
    expect([dayPoints.length, workerPoints.length, windowPoints.length]).toEqual([2, 2, 2]);
    expect(dayPoints[0]).toMatchObject({
      dimensions: { day: '2026-07-10', metric: 'requests' },
      value: 100,
      unit: 'requests',
    });
    expect(workerPoints[0]).toMatchObject({
      dimensions: {
        window: 'current',
        window_start: '2026-07-19T08:00:00.000Z',
        window_end: '2026-07-20T08:00:00.000Z',
        script: 'antenna',
        errors: 2,
        error_rate_ppm: 6667,
      },
      value: 300,
    });
    expect(windowPoints.find((point) => point.dimensions.window === 'current')).toMatchObject({
      dimensions: { errors: 2, error_rate_ppm: 5714 },
      value: 350,
    });

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    const sent = JSON.parse(init.body) as SentBody;
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(init.headers.Authorization).toBe('Bearer cf-token');
    expect(sent.variables).toMatchObject({
      account: ACCOUNT_ID,
      trendStart: '2026-07-13T00:00:00.000Z',
      trendEnd: '2026-07-20T00:00:00.000Z',
      previousStart: '2026-07-18T08:00:00.000Z',
      currentStart: '2026-07-19T08:00:00.000Z',
      end: '2026-07-20T08:00:00.000Z',
    });
    expect(sent.query).not.toContain(ACCOUNT_ID);
  });

  it('clamps the trend window and rejects malformed account ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(gqlResponse(fleetPayload));
    vi.stubGlobal('fetch', fetchMock);

    await cloudflareAnalytics({ ...baseConfig, days: 999 });
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as [string, { body: string }])[1].body,
    ) as SentBody;
    const span = Date.parse(sent.variables.trendEnd) - Date.parse(sent.variables.trendStart);
    expect(span / 86_400_000).toBe(30);

    const bad = await cloudflareAnalytics({ ...baseConfig, accountId: 'not-hex' });
    expect(bad).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid account id' },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('keeps a quiet account live with zeroed comparison windows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        gqlResponse({
          data: { viewer: { accounts: [{ daily: [], current: [], previous: [] }] } },
        }),
      ),
    );

    const result = await cloudflareAnalytics(baseConfig);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(2);
    expect(result.points.every((point) => point.value === 0)).toBe(true);
  });
});
