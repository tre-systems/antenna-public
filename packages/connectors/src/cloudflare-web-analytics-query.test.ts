import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDailyRecentRows } from './cloudflare-web-analytics-query';
import { dailyResponse } from './cloudflare-web-analytics-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('daily web analytics', () => {
  it.each([
    ['HTTP failure', () => new Response('', { status: 503 }), 'fetch_failed'],
    ['rate limit', () => new Response('', { status: 429 }), 'rate_limited'],
    ['authentication', () => new Response('', { status: 403 }), 'unauthorized'],
    ['invalid JSON', () => new Response('not json'), 'parse_failed'],
    [
      'missing account',
      () => Response.json({ data: { viewer: { accounts: [] } } }),
      'parse_failed',
    ],
    [
      'GraphQL error',
      () => Response.json({ errors: [{ message: 'invalid query' }] }),
      'parse_failed',
    ],
  ])(
    'rejects the whole window on %s rather than publishing partial totals',
    async (_, response, code) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(dailyResponse('2026-09-08', 'active.example', 3))
          .mockResolvedValueOnce(response()),
      );
      await expect(
        fetchDailyRecentRows('a'.repeat(32), 'token', '2026-09-08', '2026-09-09'),
      ).resolves.toMatchObject({ ok: false, error: { code } });
    },
  );

  it('rejects malformed numeric sampling metadata', async () => {
    const payload: {
      data: { viewer: { accounts: { recent: { avg: { sampleInterval: unknown } }[] }[] } };
    } = await dailyResponse('2026-09-09', 'active.example', 10).json();
    const row = payload.data.viewer.accounts[0]?.recent[0];
    expect(row).toBeDefined();
    if (!row) return;
    row.avg.sampleInterval = 'unknown';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(
      fetchDailyRecentRows('a'.repeat(32), 'token', '2026-09-09', '2026-09-09'),
    ).resolves.toMatchObject({ ok: false, error: { code: 'parse_failed' } });
  });
});
