// The whole point of sharing: adoption must not multiply upstream load.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { runDispatch, type DispatchEnv } from './dispatch';
import {
  arrangeDispatch,
  jsonResponse,
  pointsFor,
  seedCollection,
  seedSignal,
  type Drizzle,
} from './dispatch-test-harness';

vi.mock('../db/client', async () => (await import('./test-db')).inMemoryDbClient());

afterEach(() => {
  vi.unstubAllGlobals();
});

// Answer with the base that was actually asked for; a mismatched body makes the
// adapter fall back to a second endpoint and muddies the fetch count.
const stubFx = () => {
  const fetchMock = vi.fn((url: string) => {
    const base = /from=([A-Z]+)|base=([A-Z]+)/.exec(url);
    return Promise.resolve(
      jsonResponse({
        amount: 1,
        base: base?.[1] ?? base?.[2] ?? 'EUR',
        date: '2026-05-19',
        rates: { USD: 1.08 },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('runDispatch shared upstream fetches', () => {
  let env: DispatchEnv;
  let db: Drizzle;

  const seedFx = (collectionId: string, id: string, config: Record<string, unknown>): void => {
    seedSignal(db, id, 'fx-pair', config, 3600, 0, 'private', collectionId);
  };

  beforeEach(() => {
    ({ db, env } = arrangeDispatch());
    seedCollection(db, 'collection-2', 'owner-2');
  });

  it('costs one upstream call when two users track the same thing', async () => {
    seedFx('collection-1', 'user-1-fx', { base: 'EUR', quote: 'USD' });
    seedFx('collection-2', 'user-2-fx', { base: 'EUR', quote: 'USD' });
    const fetchMock = stubFx();

    expect(await runDispatch(env)).toEqual({ ran: 2, ok: 2, failed: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Both users still get their own points — only the fetch was shared.
    expect(pointsFor(db, 'user-1-fx')).toHaveLength(1);
    expect(pointsFor(db, 'user-2-fx')).toHaveLength(1);
    expect(pointsFor(db, 'user-2-fx')[0]?.value).toBe(1.08);
  });

  it('still fetches separately for different configs', async () => {
    seedFx('collection-1', 'user-1-fx', { base: 'EUR', quote: 'USD' });
    seedFx('collection-2', 'user-2-fx', { base: 'GBP', quote: 'USD' });
    const fetchMock = stubFx();

    await runDispatch(env);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses a stored snapshot on a later tick, not just within one', async () => {
    seedFx('collection-1', 'user-1-fx', { base: 'EUR', quote: 'USD' });
    const fetchMock = stubFx();
    await runDispatch(env);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A second user joins later, so their signal comes due on its own tick.
    seedFx('collection-2', 'user-2-fx', { base: 'EUR', quote: 'USD' });
    await runDispatch(env);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pointsFor(db, 'user-2-fx')).toHaveLength(1);
  });

  it('does not share a private-cloud source between users', async () => {
    seedSignal(db, 'user-1-manual', 'manual-metric', { value: 11 }, 3600, 0, 'private');
    seedSignal(
      db,
      'user-2-manual',
      'manual-metric',
      { value: 11 },
      3600,
      0,
      'private',
      'collection-2',
    );

    await runDispatch(env);

    // Identical config, but nothing was cached for either of them.
    expect(db.select().from(schema.upstreamSnapshots).all()).toEqual([]);
    expect(pointsFor(db, 'user-1-manual')).toHaveLength(1);
    expect(pointsFor(db, 'user-2-manual')).toHaveLength(1);
  });

  it('does not cache a failed fetch, so each signal keeps its own retry', async () => {
    seedFx('collection-1', 'user-1-fx', { base: 'EUR', quote: 'USD' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    const summary = await runDispatch(env);

    expect(summary.failed).toBe(1);
    expect(db.select().from(schema.upstreamSnapshots).all()).toEqual([]);
  });
});
