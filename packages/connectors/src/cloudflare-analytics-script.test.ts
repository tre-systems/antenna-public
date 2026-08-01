import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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

describe('cloudflareAnalytics script scope', () => {
  it('scopes trends and outcomes to one Worker script', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T08:38:00Z'));
    const source = fleetPayload.data.viewer.accounts[0];
    if (source === undefined) throw new Error('missing fixture account');
    const payload = {
      data: {
        viewer: {
          accounts: [
            {
              ...source,
              daily: [
                {
                  sum: { requests: 25, errors: 0 },
                  dimensions: { date: '2026-07-19', scriptName: 'sample-worker' },
                },
                {
                  sum: { requests: 100, errors: 1 },
                  dimensions: { date: '2026-07-19', scriptName: 'antenna' },
                },
              ],
              current: [
                ...source.current,
                {
                  sum: { requests: 75, errors: 0 },
                  dimensions: { scriptName: 'sample-worker', status: 'success' },
                },
              ],
              previous: [
                ...source.previous,
                {
                  sum: { requests: 50, errors: 0 },
                  dimensions: { scriptName: 'sample-worker', status: 'success' },
                },
              ],
            },
          ],
        },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(gqlResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareAnalytics({ ...baseConfig, script: 'sample-worker' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.points.find((point) => point.dimensions.kind === 'day')).toMatchObject({
      dimensions: { script: 'sample-worker' },
      value: 25,
    });
    expect(result.points.find((point) => point.dimensions.kind === 'worker')).toMatchObject({
      dimensions: { script: 'sample-worker' },
      value: 75,
    });
    expect(result.points.some((point) => point.dimensions.script === 'antenna')).toBe(false);
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as [string, { body: string }])[1].body,
    ) as SentBody;
    expect(sent.query).toContain('dimensions { date scriptName }');
  });

  it('rejects malformed script names before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareAnalytics({ ...baseConfig, script: "x' OR 1=1" });

    expect(result).toEqual({
      ok: false,
      error: { code: 'parse_failed', message: 'invalid Worker script name' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
