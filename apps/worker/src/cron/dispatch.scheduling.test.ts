// When a signal is due: intervals, manual refresh, on-demand collections, and
// the backoff that follows a failure.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runDispatch, type DispatchEnv } from './dispatch';
import {
  arrangeDispatch,
  jsonResponse,
  seedCollection,
  seedSignal,
  seedStatus,
  statusFor,
  type Drizzle,
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFx = (rate = 1.08) => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: rate } }),
    );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('runDispatch scheduling', () => {
  let env: DispatchEnv;
  let db: Drizzle;

  beforeEach(() => {
    ({ db, env } = arrangeDispatch());
  });

  it('skips a signal whose interval has not elapsed', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    // last_ok_at one minute ago, refresh window 15 min — not due.
    seedStatus(db, 'b1', { lastOkAt: Date.now() - 60_000, updatedAt: Date.now() - 60_000 });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await runDispatch(env)).toEqual({ ran: 0, ok: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only runs an on-demand collection after an explicit refresh request', async () => {
    db.delete(schema.collections).run();
    seedCollection(db, 'collection-1', 'owner-1', 'private', 'on_demand');
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    const fetchMock = stubFx();

    expect(await runDispatch(env)).toEqual({ ran: 0, ok: 0, failed: 0 });

    const requestedAt = Date.now();
    seedStatus(db, 'b1', { lastManualRequestAt: requestedAt, updatedAt: requestedAt - 1_000 });
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('advances freshness without storing an unchanged snapshot twice', async () => {
    seedSignal(db, 'b1', 'manual-metric', { value: 42, unit: 'items' }, 0);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    const firstPoint = db.select().from(schema.signalPoints).all()[0];
    const firstStatus = statusFor(db, 'b1');
    if (!firstPoint || !firstStatus?.lastOkAt || !firstStatus.lastDataAt) {
      throw new Error('expected initial point and snapshot status');
    }

    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

    const points = db.select().from(schema.signalPoints).all();
    const status = statusFor(db, 'b1');
    expect(points).toHaveLength(1);
    expect(points[0]?.fetchedAt.getTime()).toBe(firstPoint.fetchedAt.getTime());
    expect(status?.lastOkAt?.getTime()).toBeGreaterThan(firstStatus.lastOkAt.getTime());
    expect(status?.lastDataAt?.getTime()).toBe(firstStatus.lastDataAt.getTime());
    expect(status?.lastDataHash).toBe(firstStatus.lastDataHash);
  });

  it('skips errored signals until next_attempt_at', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    const now = Date.now();
    seedStatus(db, 'b1', { nextAttemptAt: now + 60_000, updatedAt: now - 1_000 });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await runDispatch(env)).toEqual({ ran: 0, ok: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours manual refresh even before next_attempt_at', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    const now = Date.now();
    seedStatus(db, 'b1', {
      nextAttemptAt: now + 60_000,
      lastManualRequestAt: now - 1_000,
      updatedAt: now - 10_000,
    });
    stubFx();

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
  });

  it('honours refresh backstop requests even when interval has not elapsed', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900);
    const justNow = Date.now();
    // last attempt 30s ago, explicit refresh request 10s ago; should still run.
    seedStatus(db, 'b1', {
      lastOkAt: justNow - 30_000,
      lastManualRequestAt: justNow - 10_000,
      updatedAt: justNow - 30_000,
    });
    stubFx(1.1);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
  });

  it('honours adapter retry-after hints for rate-limited signals', async () => {
    seedSignal(db, 'repo', 'github-repo-activity', { owner: 'tre', repo: 'collection' }, 900);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('rate limit', { status: 403 })));

    const before = Date.now();
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = statusFor(db, 'repo');
    expect(status?.lastError).toContain('rate_limited');
    expect(status?.nextAttemptAt?.getTime()).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(status?.nextAttemptAt?.getTime()).toBeLessThan(before + 3_700_000);
  });
});
