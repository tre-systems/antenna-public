import { afterEach, describe, expect, it, vi } from 'vitest';
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
                rumPageloadEventsAdaptiveGroups: [
                  {
                    count: 14,
                    sum: { visits: 10 },
                    dimensions: { date: '2026-07-31', requestHost: 'active.example' },
                  },
                  {
                    count: 8,
                    sum: { visits: 5 },
                    dimensions: { date: '2026-07-20', requestHost: 'active.example' },
                  },
                  {
                    count: 2,
                    sum: { visits: 2 },
                    dimensions: { date: '2026-07-22', requestHost: 'quiet.example' },
                  },
                  {
                    count: 50,
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
      start: '2026-05-04',
      end: '2026-08-01',
    });
    expect(sent.query).not.toContain(ACCOUNT_ID);
  });
});
