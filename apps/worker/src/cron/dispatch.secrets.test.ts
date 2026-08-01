// Missing server credentials must report setup before fetching.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDispatch, type DispatchEnv } from './dispatch';
import {
  arrangeDispatch,
  jsonResponse,
  pointsFor,
  seedSignal,
  statusFor,
  type Drizzle,
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

const GOLD_CONFIG = {
  symbol: 'XAUUSD:CUR',
  label: 'Gold',
  unit: 'USD/t.oz',
  sourceUrl: 'https://tradingeconomics.com/commodity/gold',
};

describe('runDispatch server secrets', () => {
  let env: DispatchEnv;
  let db: Drizzle;

  beforeEach(() => {
    ({ db, env } = arrangeDispatch());
  });

  it('marks server-key templates as setup required without fetching when the secret is missing', async () => {
    seedSignal(db, 'te', 'trading-economics-market', GOLD_CONFIG, 21_600);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
    const status = statusFor(db, 'te');
    expect(status?.lastError).toContain('setup_required');
    expect(status?.lastError).toContain('TRADING_ECONOMICS_API_KEY');
    expect(status?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now() + 5 * 60 * 60_000);
  });

  it('injects server secrets before running server-key templates', async () => {
    env = { ...env, TRADING_ECONOMICS_API_KEY: 'te-key' };
    seedSignal(db, 'te', 'trading-economics-market', GOLD_CONFIG, 21_600);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse([{ Symbol: 'XAUUSD:CUR', Date: '14/04/2026', Close: 2500.5 }]),
        ),
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('c=te-key'), {
      headers: { accept: 'application/json' },
    });
    const points = pointsFor(db, 'te');
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(2500.5);
  });

  it('injects GITHUB_TOKEN into GitHub adapter configs when configured', async () => {
    env = { ...env, GITHUB_TOKEN: 'ghp_worker' };
    seedSignal(db, 'repo', 'github-repo-activity', { owner: 'tre', repo: 'collection' }, 900);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ stargazers_count: 1, open_issues_count: 0, forks_count: 0 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer ghp_worker');
  });
});
