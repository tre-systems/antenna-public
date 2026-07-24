import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { signalsRoute } from './signals';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const SCHEMA_DDL = `
  CREATE TABLE collections (
    id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL,
    title text NOT NULL,
    description text,
    visibility text DEFAULT 'private' NOT NULL,
    refresh_mode text DEFAULT 'scheduled' NOT NULL,
    slug text UNIQUE,
    forked_from_collection_id text,
    layout text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE signals (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    template_id text NOT NULL,
    title text NOT NULL,
    config text NOT NULL,
    refresh_seconds integer NOT NULL,
    position integer NOT NULL,
    visibility text DEFAULT 'private' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE dismissed_starter_signals (
    collection_id text NOT NULL REFERENCES collections(id),
    signal_signature text NOT NULL,
    dismissed_at integer NOT NULL,
    PRIMARY KEY (collection_id, signal_signature)
  );
  CREATE TABLE signal_points (
    signal_id text NOT NULL REFERENCES signals(id),
    fetched_at integer NOT NULL,
    observed_at integer NOT NULL,
    metric_key text NOT NULL,
    dimensions text,
    value real,
    value_text text,
    unit text,
    source_url text,
    raw_payload_id text,
    PRIMARY KEY (signal_id, observed_at, metric_key)
  );
  CREATE TABLE signal_status (
    signal_id text PRIMARY KEY NOT NULL REFERENCES signals(id),
    status text NOT NULL,
    last_ok_at integer,
    last_error text,
    last_manual_request_at integer,
    next_attempt_at integer,
    last_data_hash text,
    last_data_at integer,
    updated_at integer NOT NULL
  );
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const setup = (): { db: Drizzle; env: { DB: D1Database } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: { DB: { __sqlite: sqlite } as unknown as D1Database },
  };
};

const OWNER_1: SessionUser = { id: 'owner-1', email: 'one@test', name: 'One' };
const OWNER_2: SessionUser = { id: 'owner-2', email: 'two@test', name: 'Two' };

const seedBaseline = (db: Drizzle): void => {
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: OWNER_1.id,
      title: 'Test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  db.insert(schema.signals)
    .values({
      id: 'b1',
      collectionId: 'collection-1',
      templateId: 'fx-pair',
      title: 'EUR/USD',
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedOtherTenant = (db: Drizzle): void => {
  db.insert(schema.collections)
    .values({
      id: 'collection-2',
      ownerId: OWNER_2.id,
      title: 'Other tenant',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  db.insert(schema.signals)
    .values({
      id: 'b2',
      collectionId: 'collection-2',
      templateId: 'fx-pair',
      title: 'GBP/USD',
      config: JSON.stringify({ base: 'GBP', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

type App = Hono<{ Variables: AuthVars }>;

const buildApp = (user: SessionUser = OWNER_1): App => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/signals', signalsRoute);
  return app;
};

describe('GET /api/signals', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    seedBaseline(db);
  });

  it('returns the latest point per dimension signature', async () => {
    const older = new Date(1_700_000_000_000);
    const newer = new Date(1_700_000_100_000);
    const newerFetched = new Date(1_700_000_200_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: older,
          observedAt: older,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.07,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: newerFetched,
          observedAt: newer,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
          sourceUrl: 'https://example.test/source',
        },
      ])
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: newer,
        updatedAt: newer,
      })
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{
      id: string;
      display: { title: string; source_label: string; source_url: string | null };
      points: Array<{
        value: number;
        observed_at: number;
        fetched_at: number;
        source_url: string | null;
        display: { label: string; source_url: string | null };
      }>;
      status: { last_ok_at: number | null };
    }> = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe('b1');
    expect(body[0]?.points).toHaveLength(1);
    expect(body[0]?.points[0]?.value).toBe(1.09);
    expect(body[0]?.points[0]?.observed_at).toBe(newer.getTime());
    expect(body[0]?.points[0]?.fetched_at).toBe(newerFetched.getTime());
    expect(body[0]?.points[0]?.source_url).toBe('https://example.test/source');
    expect(body[0]?.points[0]?.display).toEqual({
      label: 'EUR/USD',
      source_url: 'https://example.test/source',
    });
    expect(body[0]?.display).toEqual({
      title: 'EUR/USD',
      source_label: 'Frankfurter (ECB)',
      source_url: 'https://example.test/source',
    });
    expect(body[0]?.status.last_ok_at).toBe(newer.getTime());
  });

  it('returns null status fields when no signal_status row exists', async () => {
    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    const body: Array<{
      visibility: string;
      source_policy: {
        source_id: string;
        label: string;
        source_url: string;
        execution_mode: string;
        public_display_eligible: boolean;
      } | null;
      status: { last_ok_at: number | null; status: string | null };
      points: unknown[];
    }> = await res.json();
    expect(body[0]?.source_policy).toMatchObject({
      source_id: 'frankfurter-ecb',
      label: 'Frankfurter (ECB)',
      source_url: 'https://frankfurter.dev/',
      execution_mode: 'public_cloud',
      public_display_eligible: true,
    });
    expect(body[0]?.visibility).toBe('private');
    expect(body[0]?.status.last_ok_at).toBeNull();
    expect(body[0]?.status.status).toBeNull();
    expect(body[0]?.points).toEqual([]);
  });

  it('returns server-resolved display metadata when no points carry a source URL', async () => {
    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    const body: Array<{
      display: { title: string; source_label: string; source_url: string | null };
    }> = await res.json();

    expect(body[0]?.display).toEqual({
      title: 'EUR/USD',
      source_label: 'Frankfurter (ECB)',
      source_url: 'https://frankfurter.dev/?from=EUR&to=USD',
    });
  });

  it('returns latest points for all owned signals in one listing', async () => {
    db.insert(schema.signals)
      .values({
        id: 'b-extra',
        collectionId: 'collection-1',
        templateId: 'fx-pair',
        title: 'GBP/USD',
        config: JSON.stringify({ base: 'GBP', quote: 'USD' }) as unknown as schema.SignalConfig,
        refreshSeconds: 900,
        position: 1,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: new Date(1_700_000_000_000),
          observedAt: new Date(1_700_000_000_000),
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
        {
          signalId: 'b-extra',
          fetchedAt: new Date(1_700_000_010_000),
          observedAt: new Date(1_700_000_010_000),
          metricKey: 'pair=GBP/USD',
          dimensions: JSON.stringify({ pair: 'GBP/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.25,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{ id: string; points: Array<{ value: number }> }> = await res.json();

    expect(body).toHaveLength(2);
    expect(body.map((signal) => [signal.id, signal.points[0]?.value])).toEqual([
      ['b1', 1.09],
      ['b-extra', 1.25],
    ]);
  });

  it('returns only signals owned by the caller', async () => {
    seedOtherTenant(db);

    const a = buildApp(OWNER_1);
    const resA = await a.request('/api/signals', undefined, env);
    const bodyA: Array<{ id: string }> = await resA.json();
    expect(bodyA.map((b) => b.id)).toEqual(['b1']);

    const b = buildApp(OWNER_2);
    const resB = await b.request('/api/signals', undefined, env);
    const bodyB: Array<{ id: string }> = await resB.json();
    expect(bodyB.map((b) => b.id)).toEqual(['b2']);
  });

  it('can scope a listing to one owned collection id', async () => {
    seedOtherTenant(db);
    db.insert(schema.collections)
      .values({
        id: 'collection-extra',
        ownerId: OWNER_1.id,
        title: 'Extra',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.signals)
      .values({
        id: 'b-extra',
        collectionId: 'collection-extra',
        templateId: 'fx-pair',
        title: 'CHF/USD',
        config: JSON.stringify({ base: 'CHF', quote: 'USD' }) as unknown as schema.SignalConfig,
        refreshSeconds: 900,
        position: 0,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals?collection_id=collection-extra', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{ id: string }> = await res.json();
    expect(body.map((b) => b.id)).toEqual(['b-extra']);
  });

  it('rejects an empty collection id filter', async () => {
    const app = buildApp();
    const res = await app.request('/api/signals?collection_id=', undefined, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_query' });
  });

  it('keeps per-signal latest points even when other signals dominate by fetched_at', async () => {
    // Regression: a flat `LIMIT POINT_LIMIT * signalCount` ordered globally by
    // fetched_at lets live signals (which write many fresh rows on every cron
    // tick) starve out history-heavy signals whose latest fetched_at is older
    // (their data is historical-dated). The per-signal top-N must survive.
    db.insert(schema.signals)
      .values({
        id: 'b-history',
        collectionId: 'collection-1',
        templateId: 'macro-market-history',
        title: 'UK 10Y gilt 1Y',
        config: JSON.stringify({ preset: 'uk-10y-gilt' }) as unknown as schema.SignalConfig,
        refreshSeconds: 21_600,
        position: 1,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    // The live signal (b1) has 80 very-recent points; the history signal
    // (b-history) has one older point. Old flat-limit logic would consume the
    // global budget on b1 and return [] for b-history.
    const liveBase = Date.now() - 60_000;
    for (let i = 0; i < 80; i += 1) {
      db.insert(schema.signalPoints)
        .values({
          signalId: 'b1',
          fetchedAt: new Date(liveBase + i),
          observedAt: new Date(liveBase + i),
          metricKey: `m${String(i)}`,
          dimensions: JSON.stringify({}) as unknown as schema.DataPointDimensions,
          value: i,
          unit: 'USD',
        })
        .run();
    }
    const historyTs = new Date(Date.now() - 5 * 86_400_000);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b-history',
        fetchedAt: historyTs,
        observedAt: historyTs,
        metricKey: 'yield',
        dimensions: JSON.stringify({}) as unknown as schema.DataPointDimensions,
        value: 5.1,
        unit: '%',
      })
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{ id: string; points: Array<{ value: number }> }> = await res.json();
    const history = body.find((b) => b.id === 'b-history');
    expect(history?.points).toHaveLength(1);
    expect(history?.points[0]?.value).toBe(5.1);
  });

  it('returns an empty array for a user with no collections', async () => {
    const stranger: SessionUser = { id: 'noone', email: 'noone@test', name: 'No One' };
    const app = buildApp(stranger);
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('GET /api/signals/:id', () => {
  it('returns one owned signal with display, source policy, status, and latest points', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const older = new Date(1_700_000_000_000);
    const newer = new Date(1_700_000_100_000);
    const newerFetched = new Date(1_700_000_200_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: older,
          observedAt: older,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.07,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: newerFetched,
          observedAt: newer,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
          sourceUrl: 'https://example.test/source',
        },
      ])
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: newer,
        updatedAt: newer,
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b1', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      id: string;
      display: { title: string; source_label: string; source_url: string | null };
      source_policy: { source_id: string; public_display_eligible: boolean } | null;
      points: Array<{
        value: number;
        observed_at: number;
        fetched_at: number;
        source_url: string | null;
        display: { label: string; source_url: string | null };
      }>;
      status: { status: string | null; last_ok_at: number | null };
    } = await res.json();
    expect(body.id).toBe('b1');
    expect(body.display).toEqual({
      title: 'EUR/USD',
      source_label: 'Frankfurter (ECB)',
      source_url: 'https://example.test/source',
    });
    expect(body.source_policy).toMatchObject({
      source_id: 'frankfurter-ecb',
      public_display_eligible: true,
    });
    expect(body.points).toHaveLength(1);
    expect(body.points[0]?.value).toBe(1.09);
    expect(body.points[0]?.observed_at).toBe(newer.getTime());
    expect(body.points[0]?.fetched_at).toBe(newerFetched.getTime());
    expect(body.points[0]?.display).toEqual({
      label: 'EUR/USD',
      source_url: 'https://example.test/source',
    });
    expect(body.status).toMatchObject({ status: 'live', last_ok_at: newer.getTime() });
  });

  it('returns 404 for a signal owned by another tenant', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2', undefined, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('GET /api/signals/:id/history', () => {
  it('returns owned history points in ascending timestamp order', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const older = new Date(Date.now() - 10 * 86_400_000);
    const newer = new Date(Date.now() - 2 * 86_400_000);
    const fetched = new Date();
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: fetched,
          observedAt: newer,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: fetched,
          observedAt: older,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.07,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=1m', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      signal_id: string;
      range: string;
      points: Array<{
        value: number;
        observed_at: number;
        fetched_at: number;
        display: { label: string; source_url: string | null };
      }>;
    } = await res.json();
    expect(body.signal_id).toBe('b1');
    expect(body.range).toBe('1m');
    expect(body.points.map((p) => p.value)).toEqual([1.07, 1.09]);
    expect(body.points.map((p) => p.observed_at)).toEqual([older.getTime(), newer.getTime()]);
    expect(body.points.map((p) => p.fetched_at)).toEqual([fetched.getTime(), fetched.getTime()]);
    expect(body.points.map((p) => p.display.label)).toEqual(['EUR/USD', 'EUR/USD']);
  });

  it('applies the requested range window', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const stale = new Date(Date.now() - 45 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: stale,
          observedAt: stale,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.01,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: recent,
          observedAt: recent,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=1m', undefined, env);
    const body: { points: Array<{ value: number }> } = await res.json();

    expect(body.points.map((p) => p.value)).toEqual([1.09]);
  });

  it('returns all owned history points when range is all', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const stale = new Date(Date.now() - 500 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);
    db.insert(schema.signalPoints)
      .values([
        {
          signalId: 'b1',
          fetchedAt: stale,
          observedAt: stale,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.01,
          unit: 'USD',
        },
        {
          signalId: 'b1',
          fetchedAt: recent,
          observedAt: recent,
          metricKey: 'pair=EUR/USD',
          dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
          value: 1.09,
          unit: 'USD',
        },
      ])
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=all', undefined, env);
    const body: { range: string; points: Array<{ value: number }> } = await res.json();

    expect(res.status).toBe(200);
    expect(body.range).toBe('all');
    expect(body.points.map((p) => p.value)).toEqual([1.01, 1.09]);
  });

  it('rejects unsupported history ranges', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp();
    const res = await app.request('/api/signals/b1/history?range=10y', undefined, env);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_query' });
  });

  it('returns 404 for a signal owned by another tenant', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2/history', undefined, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});

describe('POST /api/signals/:id/refresh', () => {
  it('sets last_manual_request_at on the existing status row', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: new Date(1_000),
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp();
    const before = Date.now();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ requested: true });

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    const manual = status[0]?.lastManualRequestAt;
    expect(manual).toBeInstanceOf(Date);
    expect((manual as Date).getTime()).toBeGreaterThanOrEqual(before);
    // The dispatcher refetches only when lastManualRequestAt > updatedAt
    // (its proxy for "last attempt"). Touching updatedAt here would defeat
    // that, so the refresh backstop must leave it alone on the existing row.
    const updated = status[0]?.updatedAt;
    expect(updated).toBeInstanceOf(Date);
    expect((updated as Date).getTime()).toBe(1_000);
  });

  it('creates a loading status row when none exists', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(200);

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status).toHaveLength(1);
    expect(status[0]?.status).toBe('loading');
    expect(status[0]?.lastManualRequestAt).not.toBeNull();
  });

  it('rate limits repeated manual refresh requests for the same signal', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const lastManual = new Date(Date.now() - 10_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'loading',
        lastManualRequestAt: lastManual,
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).not.toBeNull();
    const body: {
      error: string;
      retry_after_seconds: number;
      limit: number;
      reset_at: number;
    } = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(body.limit).toBe(1);
    expect(body.retry_after_seconds).toBeGreaterThan(0);
    expect(body.retry_after_seconds).toBeLessThanOrEqual(60);
    expect(body.reset_at).toBe(Math.ceil((lastManual.getTime() + 60_000) / 1000));

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.lastManualRequestAt?.getTime()).toBe(lastManual.getTime());
    expect(status[0]?.updatedAt.getTime()).toBe(1_000);
  });

  it('allows another manual refresh after the per-signal window resets', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const oldManual = new Date(Date.now() - 61_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'loading',
        lastManualRequestAt: oldManual,
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp();
    const before = Date.now();
    const res = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(200);

    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b1'))
      .all();
    expect(status[0]?.lastManualRequestAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(status[0]?.updatedAt.getTime()).toBe(1_000);
  });

  it('returns 404 and writes nothing when the signal belongs to another user', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    // OWNER_1 trying to refresh OWNER_2's signal id: must not leak existence.
    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });

    // No signal_status row should have been written for b2.
    const status = db
      .select()
      .from(schema.signalStatus)
      .where(eq(schema.signalStatus.signalId, 'b2'))
      .all();
    expect(status).toEqual([]);
  });

  it('returns 404 for an unknown signal id', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/does-not-exist/refresh', { method: 'POST' }, env);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/signals/:id', () => {
  it('updates owned signal config, clears stale points/status, and returns the validated config', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_700_000_000_000),
        observedAt: new Date(1_700_000_000_000),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
      })
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: new Date(1_000),
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'GBP' }, refresh_seconds: 600 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      updated: true,
      config: { base: 'GBP', quote: 'USD' },
      refresh_seconds: 600,
      visibility: 'private',
      cleared_points: true,
    });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'GBP', quote: 'USD' });
    expect(signal?.refreshSeconds).toBe(600);
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toEqual([]);
    expect(
      db.select().from(schema.signalStatus).where(eq(schema.signalStatus.signalId, 'b1')).all(),
    ).toEqual([]);
  });

  it('updates refresh interval without clearing current points', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_700_000_000_000),
        observedAt: new Date(1_700_000_000_000),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ refresh_seconds: 1200 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: { cleared_points: boolean } = await res.json();
    expect(body.cleared_points).toBe(false);
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toHaveLength(1);
  });

  it('updates signal visibility when the source policy allows public display', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'public' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      updated: true,
      visibility: 'public',
      cleared_points: false,
    });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.visibility).toBe('public');
  });

  it('updates signal visibility when the source policy allows shared display', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'shared' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      updated: true,
      visibility: 'shared',
      cleared_points: false,
    });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.visibility).toBe('shared');
  });

  it('rejects shared and public visibility for sources that are not display eligible', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.update(schema.signals)
      .set({ templateId: 'market-history', title: 'AZN.L yearly chart' })
      .where(eq(schema.signals.id, 'b1'))
      .run();

    const app = buildApp(OWNER_1);
    for (const visibility of ['shared', 'public'] as const) {
      const res = await app.request(
        '/api/signals/b1',
        {
          method: 'PATCH',
          body: JSON.stringify({ visibility }),
          headers: { 'content-type': 'application/json' },
        },
        env,
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        error: 'source_policy_blocked',
        reason: 'source_not_public_display_eligible',
        source_policy: {
          source_id: 'yahoo-finance-chart',
          public_display_eligible: false,
        },
      });
    }
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.visibility).toBe('private');
  });

  it('clamps refresh interval edits to the server-owned cadence window', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const app = buildApp(OWNER_1);

    const tooFast = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ refresh_seconds: 1 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const tooSlow = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ refresh_seconds: 999_999_999 }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(tooFast.status).toBe(200);
    expect(await tooFast.json()).toMatchObject({ refresh_seconds: 60 });
    expect(tooSlow.status).toBe(200);
    expect(await tooSlow.json()).toMatchObject({ refresh_seconds: 604_800 });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all();
    expect(signal?.refreshSeconds).toBe(604_800);
  });

  it('rejects config patches that violate the template schema', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'GB' } }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid_config: fx-pair config does not match registry schema',
    });
  });

  it('returns 404 and writes nothing when the signal belongs to another user', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request(
      '/api/signals/b2',
      {
        method: 'PATCH',
        body: JSON.stringify({ config: { base: 'EUR' } }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    const [signal] = db.select().from(schema.signals).where(eq(schema.signals.id, 'b2')).all();
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'GBP', quote: 'USD' });
  });

  it('rejects empty or malformed patch bodies', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const empty = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const malformed = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        body: '{',
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'invalid_body' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_body' });
  });
});

describe('DELETE /api/signals/:id', () => {
  it('deletes an owned signal and its child rows', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_700_000_000_000),
        observedAt: new Date(1_700_000_000_000),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
      })
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: new Date(1_000),
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b1', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all()).toEqual([]);
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toEqual([]);
    expect(
      db.select().from(schema.signalStatus).where(eq(schema.signalStatus.signalId, 'b1')).all(),
    ).toEqual([]);
  });

  it('records dismissed starter signals so seed sync does not resurrect them', async () => {
    const { db, env } = setup();
    db.insert(schema.collections)
      .values([
        {
          id: 'seed-collection',
          ownerId: 'seed-owner',
          title: 'Seed',
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        {
          id: 'collection-1',
          ownerId: OWNER_1.id,
          title: 'Test',
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ])
      .run();
    const config = JSON.stringify({ base: 'EUR', quote: 'USD' });
    db.insert(schema.signals)
      .values([
        {
          id: 'seed-fx',
          collectionId: 'seed-collection',
          templateId: 'fx-pair',
          title: 'EUR/USD',
          config: config as unknown as schema.SignalConfig,
          refreshSeconds: 900,
          position: 0,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        {
          id: 'b1',
          collectionId: 'collection-1',
          templateId: 'fx-pair',
          title: 'EUR/USD',
          config: config as unknown as schema.SignalConfig,
          refreshSeconds: 900,
          position: 0,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ])
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b1', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    expect(db.select().from(schema.dismissedStarterSignals).all()).toMatchObject([
      {
        collectionId: 'collection-1',
        signalSignature: `fx-pair|${config}`,
      },
    ]);
  });

  it('returns 404 and deletes nothing when the signal belongs to another user', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2', { method: 'DELETE' }, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(db.select().from(schema.signals).where(eq(schema.signals.id, 'b2')).all()).toHaveLength(
      1,
    );
  });

  it('returns 404 for an unknown signal id', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/does-not-exist', { method: 'DELETE' }, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
