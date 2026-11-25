import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyResponse, sampledResponse } from './cloudflare-web-analytics-test-fixtures';
import { cloudflareWebAnalytics } from './cloudflare-web-analytics';

const ACCOUNT_ID = 'a'.repeat(32);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cloudflareWebAnalytics', () => {
  it('compares visits and identifies active, quiet, and unseen hosts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          viewer: {
            accounts: [
              {
                recent: [
                  {
                    count: 14,
                    avg: { sampleInterval: 1 },
                    sum: { visits: 10 },
                    dimensions: { date: '2026-07-31', requestHost: 'active.example' },
                  },
                ],
                previous: [
                  {
                    count: 8,
                    avg: { sampleInterval: 10 },
                    sum: { visits: 5 },
                    dimensions: { date: '2026-07-20', requestHost: 'active.example' },
                  },
                  {
                    count: 2,
                    avg: { sampleInterval: 10 },
                    sum: { visits: 2 },
                    dimensions: { date: '2026-07-22', requestHost: 'quiet.example' },
                  },
                ],
                lookback: [
                  {
                    count: 50,
                    avg: { sampleInterval: 10 },
                    sum: { visits: 40 },
                    dimensions: { date: '2026-06-01', requestHost: 'active.example' },
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareWebAnalytics({
      accountId: ACCOUNT_ID,
      apiToken: 'token',
      hosts: 'active.example,quiet.example,active.example,unseen.example',
      days: Number.NaN,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points).toHaveLength(3);
    expect(result.points).toMatchObject([
      {
        dimensions: {
          host: 'active.example',
          previous: 5,
          change: 100,
          pageloads: 14,
          telemetry_state: 'active',
          days: 7,
          visits_quality: 'unsampled',
          comparison_quality: 'estimated',
        },
        value: 10,
      },
      { dimensions: { host: 'quiet.example', telemetry_state: 'quiet' }, value: 0 },
      { dimensions: { host: 'unseen.example', telemetry_state: 'unseen' }, value: 0 },
    ]);
    const sent = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body) as {
      variables: Record<string, string>;
      query: string;
    };
    expect(sent.variables).toEqual({
      account: ACCOUNT_ID,
      recentStart: '2026-07-26',
      previousStart: '2026-07-19',
      lookbackStart: '2026-05-04',
      end: '2026-08-01',
    });
    expect(sent.query).toContain('recent: rumPageloadEventsAdaptiveGroups');
    expect(sent.query).toContain('previous: rumPageloadEventsAdaptiveGroups');
    expect(sent.query).toContain('lookback: rumPageloadEventsAdaptiveGroups');
    expect(sent.query).toContain('avg { sampleInterval }');
    expect(sent.query).not.toContain(ACCOUNT_ID);
  });

  it('re-queries sampled recent visits one day at a time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            viewer: {
              accounts: [
                {
                  recent: [
                    {
                      count: 100,
                      avg: { sampleInterval: 100 },
                      sum: { visits: 100 },
                      dimensions: { date: '2026-08-01', requestHost: 'active.example' },
                    },
                  ],
                  previous: [],
                  lookback: [],
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(dailyResponse('2026-07-31', 'active.example', 3))
      .mockResolvedValueOnce(dailyResponse('2026-08-01', 'active.example', 4));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareWebAnalytics({
      accountId: ACCOUNT_ID,
      apiToken: 'token',
      hosts: 'active.example',
      days: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]).toMatchObject({
      value: 7,
      dimensions: { pageloads: 7, visits_quality: 'unsampled' },
    });
    expect(result.rawPayload).toMatchObject({ recentQuery: 'daily' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const dailyBodies = fetchMock.mock.calls.slice(1).map(
      (call) =>
        JSON.parse((call as [string, { body: string }])[1].body) as {
          variables: Record<string, string>;
        },
    );
    expect(dailyBodies.map((body) => body.variables.day)).toEqual(['2026-07-31', '2026-08-01']);
  });

  it('preserves and labels estimates when a daily recent query is still sampled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(sampledResponse()).mockResolvedValueOnce(sampledResponse()),
    );

    const result = await cloudflareWebAnalytics({
      accountId: ACCOUNT_ID,
      apiToken: 'token',
      hosts: 'active.example',
      days: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points[0]).toMatchObject({
      value: 100,
      dimensions: {
        pageloads: 100,
        visits_quality: 'estimated',
        comparison_quality: 'estimated',
      },
    });
  });
});
