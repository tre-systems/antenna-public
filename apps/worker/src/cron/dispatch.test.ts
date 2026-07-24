// Hermetic dispatcher test: in-memory sqlite stands in for D1, a tiny stub
// stands in for the R2 bucket. Shared fixtures live in
// dispatch-test-fixtures.ts so this file stays focused on assertions.

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import type * as DbClientModule from '../db/client';
import { runDispatch, type DispatchEnv } from './dispatch';
import {
  makeR2,
  makeSqlite,
  type Drizzle,
  type R2Stub,
  type Sqlite,
} from './dispatch-test-fixtures';

const setup = (): { sqlite: Sqlite; db: Drizzle; env: DispatchEnv; r2: R2Stub } => {
  const { sqlite, db } = makeSqlite();
  const r2 = makeR2();
  // Cast lets us reuse runDispatch (which targets D1) against better-sqlite3.
  const env: DispatchEnv = {
    DB: { __sqlite: sqlite } as unknown as D1Database,
    PAYLOADS: r2.bucket,
    GOOGLE_CLIENT_ID: 'cid',
    GOOGLE_CLIENT_SECRET: 'csecret',
  };
  return { sqlite, db, env, r2 };
};

// We intercept `db()` by mocking the module so it returns our in-memory client.
vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => {
      const sqlite = env.DB.__sqlite;
      return drizzle(sqlite, { schema });
    },
  };
});

const seedCollection = (
  db: Drizzle,
  visibility: 'private' | 'shared' | 'public' = 'private',
  refreshMode: 'scheduled' | 'on_demand' = 'scheduled',
): void => {
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: 'owner-1',
      title: 'Test',
      visibility,
      refreshMode,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignal = (
  db: Drizzle,
  id: string,
  templateId: string,
  config: Record<string, unknown>,
  refreshSeconds: number,
  position: number,
  visibility: 'private' | 'shared' | 'public' = 'private',
): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId: 'collection-1',
      templateId,
      title: id,
      config: JSON.stringify(config) as unknown as schema.SignalConfig,
      refreshSeconds,
      position,
      visibility,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedStatus = (
  db: Drizzle,
  signalId: string,
  partial: {
    lastOkAt?: number;
    lastManualRequestAt?: number;
    nextAttemptAt?: number;
    updatedAt: number;
  },
): void => {
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: partial.lastOkAt !== undefined ? new Date(partial.lastOkAt) : null,
      lastManualRequestAt:
        partial.lastManualRequestAt !== undefined ? new Date(partial.lastManualRequestAt) : null,
      nextAttemptAt: partial.nextAttemptAt !== undefined ? new Date(partial.nextAttemptAt) : null,
      updatedAt: new Date(partial.updatedAt),
    })
    .run();
};

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const makeChannels = () => {
  const calls: RequestInit[] = [];
  const stub = {
    fetch: vi.fn((_url: string, init?: RequestInit) => {
      if (init) calls.push(init);
      return Promise.resolve(new Response(null, { status: 204 }));
    }),
  };
  return {
    calls,
    namespace: {
      idFromName: vi.fn(() => ({})),
      get: vi.fn(() => stub),
    } as unknown as DurableObjectNamespace,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runDispatch', () => {
  let env: DispatchEnv;
  let r2: R2Stub;
  let db: Drizzle;

  beforeEach(() => {
    const s = setup();
    env = s.env;
    r2 = s.r2;
    db = s.db;
    seedCollection(db);
  });

  it('runs a never-fetched signal and writes point/status without default R2 archival', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        ),
    );

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });

    const points = db
      .select()
      .from(schema.signalPoints)
      .where(eq(schema.signalPoints.signalId, 'b1'))
      .all();
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(1.08);
    expect(points[0]?.fetchedAt.getTime()).toBeGreaterThan(Date.parse('2026-05-19'));
    expect(points[0]?.observedAt.getTime()).toBe(Date.parse('2026-05-19'));
    expect(points[0]?.rawPayloadId).toBeNull();

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.status).toBe('live');
    expect(status[0]?.lastOkAt).not.toBeNull();
    expect(status[0]?.lastError).toBeNull();

    expect(r2.puts).toHaveLength(0);
  });

  it('keeps an empty manual cost in an actionable setup state', async () => {
    seedSignal(
      db,
      'cost-cloudflare',
      'manual-cost',
      {
        amount: '',
        currency: 'GBP',
        period: 'month_to_date',
        provider: 'Cloudflare',
        service: 'All services',
      },
      86_400,
      0,
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'cost-cloudflare'))
      .get();
    expect(status?.status).toBe('error');
    expect(status?.lastError).toBe('setup_required: Enter the current amount in card settings.');
    expect(db.select().from(schema.signalPoints).all()).toHaveLength(0);
  });

  it('updates an existing point when a provider revises the same timestamp', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 0, 0);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.09 } }),
        ),
    );

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

    const points = db
      .select()
      .from(schema.signalPoints)
      .where(eq(schema.signalPoints.signalId, 'b1'))
      .all();
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(1.09);
  });

  it('records registry alert rules when a new point breaches a threshold', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 0, 0);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(Date.parse('2026-05-18T12:00:00Z')),
        observedAt: new Date(Date.parse('2026-05-18T00:00:00Z')),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.08,
        unit: 'USD',
        sourceUrl: 'https://frankfurter.dev/',
      })
      .run();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.09 } }),
          ),
        ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    const alerts = db.select().from(schema.signalAlerts).all();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      collectionId: 'collection-1',
      signalId: 'b1',
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'pair=EUR/USD',
      value: 1.09,
      previousValue: 1.08,
      unit: 'USD',
      sourceUrl: 'https://frankfurter.dev/',
    });

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(db.select().from(schema.signalAlerts).all()).toHaveLength(1);
  });

  it('stores large yearly history payloads in D1-safe batches', async () => {
    seedSignal(db, 'hist', 'market-history', { symbol: 'AZN.L' }, 21_600, 0);
    const timestamps = Array.from({ length: 4_000 }, (_, index) => 1_700_000_000 + index * 86_400);
    const close = timestamps.map((_, index) => 100 + index / 100);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          chart: {
            result: [
              {
                meta: { symbol: 'AZN.L', currency: 'GBp' },
                timestamp: timestamps,
                indicators: { quote: [{ close }] },
              },
            ],
            error: null,
          },
        }),
      ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    const points = db
      .select()
      .from(schema.signalPoints)
      .where(eq(schema.signalPoints.signalId, 'hist'))
      .all();
    expect(points).toHaveLength(4_000);
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'hist'))
      .all();
    expect(status[0]?.status).toBe('live');
    expect(status[0]?.lastError).toBeNull();
  });

  it('skips a signal whose interval has not elapsed', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    // last_ok_at one minute ago, refresh window 15 min — not due.
    seedStatus(db, 'b1', { lastOkAt: Date.now() - 60_000, updatedAt: Date.now() - 60_000 });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 0, ok: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only runs an on-demand collection after an explicit refresh request', async () => {
    db.delete(schema.collections).run();
    seedCollection(db, 'private', 'on_demand');
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    expect(await runDispatch(env)).toEqual({ ran: 0, ok: 0, failed: 0 });

    const requestedAt = Date.now();
    seedStatus(db, 'b1', {
      lastManualRequestAt: requestedAt,
      updatedAt: requestedAt - 1_000,
    });
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('advances freshness without storing an unchanged snapshot twice', async () => {
    seedSignal(db, 'b1', 'manual-metric', { value: 42, unit: 'items' }, 0, 0);

    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });
    const firstPoint = db.select().from(schema.signalPoints).all()[0];
    const firstStatus = db.select().from(schema.signalStatus).all()[0];
    if (!firstPoint || !firstStatus?.lastOkAt || !firstStatus.lastDataAt) {
      throw new Error('expected initial point and snapshot status');
    }

    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(await runDispatch(env)).toEqual({ ran: 1, ok: 1, failed: 0 });

    const points = db.select().from(schema.signalPoints).all();
    const status = db.select().from(schema.signalStatus).all()[0];
    expect(points).toHaveLength(1);
    expect(points[0]?.fetchedAt.getTime()).toBe(firstPoint.fetchedAt.getTime());
    expect(status?.lastOkAt?.getTime()).toBeGreaterThan(firstStatus.lastOkAt.getTime());
    expect(status?.lastDataAt?.getTime()).toBe(firstStatus.lastDataAt.getTime());
    expect(status?.lastDataHash).toBe(firstStatus.lastDataHash);
  });

  it('skips errored signals until next_attempt_at', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    const now = Date.now();
    seedStatus(db, 'b1', {
      lastOkAt: undefined,
      nextAttemptAt: now + 60_000,
      updatedAt: now - 1_000,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 0, ok: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours manual refresh even before next_attempt_at', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    const now = Date.now();
    seedStatus(db, 'b1', {
      nextAttemptAt: now + 60_000,
      lastManualRequestAt: now - 1_000,
      updatedAt: now - 10_000,
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
  });

  it('marks a signal stale without touching last_ok_at on recoverable adapter failure', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    const originalOk = Date.now() - 60 * 60_000;
    seedStatus(db, 'b1', { lastOkAt: originalOk, updatedAt: originalOk });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    const channels = makeChannels();
    env = { ...env, CHANNELS: channels.namespace };

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.status).toBe('stale');
    expect(status[0]?.lastError).toContain('fetch_failed');
    expect(status[0]?.lastOkAt?.getTime()).toBe(originalOk);
    expect(r2.puts).toHaveLength(0);
    expect(status[0]?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now());
    const body = channels.calls[0]?.body;
    if (typeof body !== 'string') throw new Error('expected notification body to be JSON');
    expect(body).toContain('"type":"signal_error"');
  });

  it('records an error on adapter failure when there is no previous success', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.status).toBe('error');
    expect(status[0]?.lastError).toContain('fetch_failed');
    expect(status[0]?.lastOkAt).toBeNull();
  });

  it('records an error and skips fetch when stored config fails registry validation', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EU', quote: 'USD' }, 900, 0);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.status).toBe('error');
    expect(status[0]?.lastError).toContain('invalid_config: fx-pair');
  });

  it('honours refresh backstop requests even when interval has not elapsed', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    const justNow = Date.now();
    // last attempt 30s ago, explicit refresh request 10s ago; should still run.
    seedStatus(db, 'b1', {
      lastOkAt: justNow - 30_000,
      lastManualRequestAt: justNow - 10_000,
      updatedAt: justNow - 30_000,
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.1 } }),
        ),
    );

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
  });

  it('isolates failures across sibling signals', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    seedSignal(db, 'b2', 'fx-pair', { base: 'GBP', quote: 'USD' }, 900, 1);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('from=EUR')) {
          return Promise.resolve(
            jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
          );
        }
        return Promise.resolve(new Response('boom', { status: 500 }));
      }),
    );

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 2, ok: 1, failed: 1 });

    const ok = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    const bad = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b2'))
      .all();
    expect(ok[0]?.status).toBe('live');
    expect(bad[0]?.status).toBe('error');
  });

  it('logs per and per-tick results with one correlation id', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    seedSignal(db, 'b2', 'not-a-template', {}, 900, 1);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        ),
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runDispatch(env);

    const entries = log.mock.calls.map(([line]) => {
      if (typeof line !== 'string') throw new Error('expected structured log line');
      return JSON.parse(line) as {
        event: string;
        run_id: string;
        signal_id?: string;
        status?: string;
        ok?: number;
        failed?: number;
      };
    });
    const runIds = new Set(entries.map((entry) => entry.run_id));
    expect(runIds.size).toBe(1);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'signal_dispatch_completed',
          signal_id: 'b1',
          status: 'live',
        }),
        expect.objectContaining({
          event: 'signal_dispatch_completed',
          signal_id: 'b2',
          status: 'error',
        }),
        expect.objectContaining({
          event: 'dispatch_tick_completed',
          ok: 1,
          failed: 1,
        }),
      ]),
    );
  });

  it('does not write R2 payloads for default registry templates', async () => {
    seedSignal(db, 'b1', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0);
    seedSignal(db, 'b2', 'fx-pair', { base: 'GBP', quote: 'USD' }, 900, 1);
    const put = vi.fn(() => Promise.reject(new Error('R2 should not be called')));
    env = {
      ...env,
      PAYLOADS: {
        put,
      } as unknown as R2Bucket,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const base = url.includes('from=EUR') ? 'EUR' : 'GBP';
        const rate = base === 'EUR' ? 1.08 : 1.25;
        return Promise.resolve(
          jsonResponse({ amount: 1, base, date: '2026-05-19', rates: { USD: rate } }),
        );
      }),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 2, ok: 2, failed: 0 });
    const points = db.select().from(schema.signalPoints).all();
    expect(points).toHaveLength(2);
    expect(points.every((point) => point.rawPayloadId === null)).toBe(true);
    const b1 = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    const b2 = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b2'))
      .all();
    expect(b1[0]?.status).toBe('live');
    expect(b2[0]?.status).toBe('live');
    expect(put).not.toHaveBeenCalled();
  });

  it('marks unknown template as error without throwing', async () => {
    seedSignal(db, 'b1', 'not-a-template', {}, 900, 0);
    vi.stubGlobal('fetch', vi.fn());

    const summary = await runDispatch(env);
    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.lastError).toContain('unknown template');
  });

  it('fails closed for review-required sources before fetching', async () => {
    seedSignal(
      db,
      'b1',
      'rest-metric',
      { url: 'https://example.test/private.json', jsonPath: '$.value' },
      900,
      0,
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.status).toBe('error');
    expect(status[0]?.lastError).toContain('setup_required');
    expect(status[0]?.lastError).toContain('Generic REST requires source review');
  });

  it('materialises owner-provided manual metrics without a network request', async () => {
    seedSignal(db, 'manual', 'manual-metric', { value: 42, unit: 'items' }, 86_400, 0);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const points = db
      .select()
      .from(schema.signalPoints)
      .where(eq(schema.signalPoints.signalId, 'manual'))
      .all();
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'manual'))
      .all();
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ value: 42, unit: 'items' });
    expect(status[0]?.status).toBe('live');
    expect(status[0]?.lastError).toBeNull();
  });

  it('fails closed for public signals whose source policy is not public-display eligible', async () => {
    db.update(schema.collections)
      .set({ visibility: 'public' })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
    seedSignal(db, 'hist', 'market-history', { symbol: 'AZN.L' }, 21_600, 0, 'public');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'hist'))
      .all();
    expect(status[0]?.status).toBe('error');
    expect(status[0]?.lastError).toContain('cannot refresh externally visible signal');
    expect(status[0]?.lastError).toContain('source_not_public_display_eligible');
  });

  it('fails closed for shared-link signals whose source is not public-display eligible', async () => {
    db.update(schema.collections)
      .set({ visibility: 'shared' })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
    seedSignal(db, 'hist', 'market-history', { symbol: 'AZN.L' }, 21_600, 0, 'shared');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          chart: {
            result: [
              {
                meta: { symbol: 'AZN.L', currency: 'GBp' },
                timestamp: [1_700_000_000],
                indicators: { quote: [{ close: [100.1] }] },
              },
            ],
            error: null,
          },
        }),
      ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });
    const points = db
      .select()
      .from(schema.signalPoints)
      .where(eq(schema.signalPoints.signalId, 'hist'))
      .all();
    expect(points).toEqual([]);
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'hist'))
      .all();
    expect(status[0]?.status).toBe('error');
    expect(status[0]?.lastError).toContain('source_not_public_display_eligible');
  });

  it('allows externally visible signals whose source policy permits public cloud display', async () => {
    db.update(schema.collections)
      .set({ visibility: 'public' })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
    seedSignal(db, 'fx', 'fx-pair', { base: 'EUR', quote: 'USD' }, 900, 0, 'public');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ amount: 1, base: 'EUR', date: '2026-05-19', rates: { USD: 1.08 } }),
        ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
  });

  it('marks server-key templates as setup required without fetching when the secret is missing', async () => {
    seedSignal(
      db,
      'te',
      'trading-economics-market',
      {
        symbol: 'XAUUSD:CUR',
        label: 'Gold',
        unit: 'USD/t.oz',
        sourceUrl: 'https://tradingeconomics.com/commodity/gold',
      },
      21_600,
      0,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'te'))
      .all();
    expect(status[0]?.lastError).toContain('setup_required');
    expect(status[0]?.lastError).toContain('TRADING_ECONOMICS_API_KEY');
    expect(status[0]?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now() + 5 * 60 * 60_000);
  });

  it('honours adapter retry-after hints for rate-limited signals', async () => {
    seedSignal(db, 'repo', 'github-repo-activity', { owner: 'tre', repo: 'collection' }, 900, 0);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('rate limit', { status: 403 })));

    const before = Date.now();
    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 0, failed: 1 });
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'repo'))
      .all();
    expect(status[0]?.lastError).toContain('rate_limited');
    expect(status[0]?.nextAttemptAt?.getTime()).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(status[0]?.nextAttemptAt?.getTime()).toBeLessThan(before + 3_700_000);
  });

  it('injects GITHUB_TOKEN into GitHub adapter configs when configured', async () => {
    env = { ...env, GITHUB_TOKEN: 'test-github-token' };
    seedSignal(db, 'repo', 'github-repo-activity', { owner: 'tre', repo: 'collection' }, 900, 0);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ stargazers_count: 1, open_issues_count: 0, forks_count: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer test-github-token');
  });

  it('injects server secrets before running server-key templates', async () => {
    env = { ...env, TRADING_ECONOMICS_API_KEY: 'te-key' };
    seedSignal(
      db,
      'te',
      'trading-economics-market',
      {
        symbol: 'XAUUSD:CUR',
        label: 'Gold',
        unit: 'USD/t.oz',
        sourceUrl: 'https://tradingeconomics.com/commodity/gold',
      },
      21_600,
      0,
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse([{ Symbol: 'XAUUSD:CUR', Date: '14/04/2026', Close: 2500.5 }]),
        ),
    );

    const summary = await runDispatch(env);

    expect(summary).toEqual({ ran: 1, ok: 1, failed: 0 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('c=te-key'), {
      headers: { accept: 'application/json' },
    });
    const points = db
      .select()
      .from(schema.signalPoints)
      .where(eq(schema.signalPoints.signalId, 'te'))
      .all();
    expect(points).toHaveLength(1);
    expect(points[0]?.value).toBe(2500.5);
  });
});
