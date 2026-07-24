import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUsage } from './app-usage';

const ACCOUNT_ID = 'a'.repeat(32);

const baseConfig = {
  project: 'sample-app',
  accountId: ACCOUNT_ID,
  apiToken: 'cf-analytics-token',
};

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appUsage', () => {
  it('returns one point per event per day with sampling-aware counts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { day: '2026-07-10 00:00:00', event: 'character_created', count: '12' },
          { day: '2026-07-10 00:00:00', event: 'dice_rolled', count: 40 },
          { day: '2026-07-09 00:00:00', event: 'character_created', count: '7' },
        ],
        rows: 3,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await appUsage(baseConfig);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toEqual({
      dimensions: {
        source: 'app-usage',
        project: 'sample-app',
        event: 'character_created',
        day: '2026-07-10',
      },
      value: 12,
      unit: 'events',
      ts: Date.parse('2026-07-10T00:00:00Z'),
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: unknown; body: string }];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`,
    );
    expect(init.headers).toEqual({ Authorization: 'Bearer cf-analytics-token' });
    expect(init.body).toContain("index1 = 'sample-app'");
    expect(init.body).toContain('SUM(_sample_interval * double1)');
    expect(init.body).toContain("INTERVAL '14' DAY");
  });

  it('clamps the day window and rejects non-slug identifiers before fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await appUsage({ ...baseConfig, days: 500 });
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(init.body).toContain("INTERVAL '90' DAY");

    const badProject = await appUsage({ ...baseConfig, project: "x'; DROP TABLE app_usage;--" });
    const badDataset = await appUsage({ ...baseConfig, dataset: 'app_usage; SELECT 1' });
    const badAccount = await appUsage({ ...baseConfig, accountId: 'not-hex' });

    expect(badProject).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid project slug' },
    });
    expect(badDataset).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid dataset name' },
    });
    expect(badAccount).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid account id' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats an empty window as a live zero, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [] })));

    const result = await appUsage(baseConfig);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.value).toBe(0);
    expect(result.points[0]?.dimensions.event).toBe('total');
  });

  it('maps auth, rate-limit, and server errors to adapter error codes', async () => {
    const cases: ReadonlyArray<[number, string]> = [
      [401, 'unauthorized'],
      [403, 'unauthorized'],
      [429, 'rate_limited'],
      [500, 'fetch_failed'],
    ];

    for (const [status, code] of cases) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status })));
      const result = await appUsage(baseConfig);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(code);
    }
  });

  it('fails cleanly on malformed payloads and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ nope: true })));
    const malformed = await appUsage(baseConfig);
    expect(malformed).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'unexpected SQL API payload' },
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const network = await appUsage(baseConfig);
    expect(network).toEqual({
      ok: false,
      error: { code: 'fetch_failed', message: 'boom' },
    });
  });
});
