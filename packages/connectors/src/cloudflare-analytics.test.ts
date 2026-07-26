import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloudflareAnalytics } from './cloudflare-analytics';

type SentBody = {
  readonly query: string;
  readonly variables: {
    readonly account: string;
    readonly trendStart: string;
    readonly trendEnd: string;
    readonly previousStart: string;
    readonly currentStart: string;
    readonly end: string;
  };
};

const ACCOUNT_ID = 'a'.repeat(32);
const baseConfig = { accountId: ACCOUNT_ID, apiToken: 'cf-token' };

const gqlResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const fleetPayload = {
  data: {
    viewer: {
      accounts: [
        {
          daily: [
            { sum: { requests: 100, errors: 1 }, dimensions: { date: '2026-07-10' } },
            { sum: { requests: 250, errors: 0 }, dimensions: { date: '2026-07-11' } },
          ],
          current: [
            {
              sum: { requests: 290, errors: 0 },
              dimensions: { scriptName: 'antenna', status: 'success' },
            },
            {
              sum: { requests: 2, errors: 2 },
              dimensions: { scriptName: 'antenna', status: 'scriptThrewException' },
            },
            {
              sum: { requests: 8, errors: 0 },
              dimensions: { scriptName: 'antenna', status: 'clientDisconnected' },
            },
            {
              sum: { requests: 50, errors: 0 },
              dimensions: { scriptName: 'cepheus', status: 'success' },
            },
          ],
          previous: [
            {
              sum: { requests: 199, errors: 0 },
              dimensions: { scriptName: 'antenna', status: 'success' },
            },
            {
              sum: { requests: 1, errors: 1 },
              dimensions: { scriptName: 'antenna', status: 'scriptThrewException' },
            },
          ],
          hourly: [
            {
              sum: { requests: 1, errors: 1 },
              dimensions: {
                datetimeHour: '2026-07-20T06:00:00Z',
                scriptName: 'antenna',
                status: 'scriptThrewException',
              },
            },
            {
              sum: { requests: 3, errors: 0 },
              dimensions: {
                datetimeHour: '2026-07-20T07:00:00Z',
                scriptName: 'antenna',
                status: 'clientDisconnected',
              },
            },
          ],
        },
      ],
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cloudflareAnalytics', () => {
  it('returns complete-day trends plus aligned current/previous Worker outcomes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T08:38:00Z'));
    const fetchMock = vi.fn().mockResolvedValue(gqlResponse(fleetPayload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareAnalytics(baseConfig);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dayPoints = result.points.filter((p) => p.dimensions.kind === 'day');
    const workerPoints = result.points.filter((p) => p.dimensions.kind === 'worker');
    const previousWorkerPoints = result.points.filter(
      (p) => p.dimensions.kind === 'worker-comparison',
    );
    const statusPoints = result.points.filter((p) => p.dimensions.kind === 'worker-status');
    const windowPoints = result.points.filter((p) => p.dimensions.kind === 'fleet-window');
    const hourlyExceptionPoints = result.points.filter(
      (p) => p.dimensions.kind === 'worker-status-hour',
    );
    expect(dayPoints).toHaveLength(2);
    expect(workerPoints).toHaveLength(2);
    expect(previousWorkerPoints).toHaveLength(1);
    expect(statusPoints).toHaveLength(6);
    expect(windowPoints).toHaveLength(2);
    expect(hourlyExceptionPoints).toHaveLength(1);

    expect(dayPoints[0]).toMatchObject({
      dimensions: {
        source: 'cloudflare-analytics',
        kind: 'day',
        day: '2026-07-10',
        metric: 'requests',
      },
      value: 100,
      unit: 'requests',
    });
    expect(workerPoints[0]).toMatchObject({
      dimensions: {
        kind: 'worker',
        window: 'current',
        window_start: '2026-07-19T08:00:00.000Z',
        window_end: '2026-07-20T08:00:00.000Z',
        script: 'antenna',
        errors: 2,
        error_rate_ppm: 6667,
        metric: 'requests',
      },
      value: 300,
    });
    expect(previousWorkerPoints[0]).toMatchObject({
      dimensions: {
        kind: 'worker-comparison',
        window: 'previous',
        script: 'antenna',
        errors: 1,
        error_rate_ppm: 5000,
      },
      value: 200,
    });
    expect(
      statusPoints.find(
        (point) =>
          point.dimensions.window === 'current' &&
          point.dimensions.script === 'antenna' &&
          point.dimensions.status === 'clientDisconnected',
      ),
    ).toMatchObject({
      dimensions: {
        kind: 'worker-status',
        window: 'current',
        script: 'antenna',
        status: 'clientDisconnected',
      },
      value: 8,
    });
    expect(windowPoints.find((point) => point.dimensions.window === 'current')).toMatchObject({
      dimensions: {
        kind: 'fleet-window',
        window: 'current',
        errors: 2,
        error_rate_ppm: 5714,
      },
      value: 350,
    });
    expect(hourlyExceptionPoints[0]).toMatchObject({
      dimensions: {
        kind: 'worker-status-hour',
        hour_start: '2026-07-20T06:00:00.000Z',
        hour_end: '2026-07-20T07:00:00.000Z',
        script: 'antenna',
        status: 'scriptThrewException',
        errors: 1,
      },
      value: 1,
      ts: Date.parse('2026-07-20T07:00:00.000Z'),
    });

    // Uses GraphQL variables, not string interpolation, for all user input.
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(init.headers.Authorization).toBe('Bearer cf-token');
    const sent = JSON.parse(init.body) as SentBody;
    expect(sent.variables.account).toBe(ACCOUNT_ID);
    expect(sent.variables).toMatchObject({
      trendStart: '2026-07-13T00:00:00.000Z',
      trendEnd: '2026-07-20T00:00:00.000Z',
      previousStart: '2026-07-18T08:00:00.000Z',
      currentStart: '2026-07-19T08:00:00.000Z',
      end: '2026-07-20T08:00:00.000Z',
    });
    expect(sent.query).toContain('dimensions { scriptName status }');
    expect(sent.query).toContain('dimensions { datetimeHour scriptName status }');
    expect(sent.query).toContain('datetime_lt: $end');
    expect(sent.query).not.toContain(ACCOUNT_ID);
  });

  it('clamps the day window and rejects a malformed account id before fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(gqlResponse(fleetPayload));
    vi.stubGlobal('fetch', fetchMock);

    await cloudflareAnalytics({ ...baseConfig, days: 999 });
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as [string, { body: string }])[1].body,
    ) as SentBody;
    const spanMs = Date.parse(sent.variables.trendEnd) - Date.parse(sent.variables.trendStart);
    expect(Math.round(spanMs / 86_400_000)).toBe(30); // clamped to MAX_DAYS

    const bad = await cloudflareAnalytics({ ...baseConfig, accountId: 'not-hex' });
    expect(bad).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid account id' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces GraphQL permission errors as unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        gqlResponse({
          errors: [{ message: 'authentication error: insufficient permissions' }],
          data: null,
        }),
      ),
    );
    const result = await cloudflareAnalytics(baseConfig);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unauthorized');
  });

  it('keeps a quiet account live with zeroed comparison windows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        gqlResponse({
          data: { viewer: { accounts: [{ daily: [], current: [], previous: [], hourly: [] }] } },
        }),
      ),
    );
    const result = await cloudflareAnalytics(baseConfig);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(2);
    expect(result.points.every((point) => point.dimensions.kind === 'fleet-window')).toBe(true);
    expect(result.points.every((point) => point.value === 0)).toBe(true);
  });

  it('maps HTTP auth, rate-limit, and server errors to adapter codes', async () => {
    for (const [status, code] of [
      [403, 'unauthorized'],
      [429, 'rate_limited'],
      [500, 'fetch_failed'],
    ] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status })));
      const result = await cloudflareAnalytics(baseConfig);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(code);
    }
  });
});
