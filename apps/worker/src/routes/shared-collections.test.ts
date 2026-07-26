import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { Visibility } from '../policy/source-access';
import { sharedCollectionsRoute } from './shared-collections';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;
const OWNER_ONLY_SHARED_KEYS = [
  'config',
  'refresh_seconds',
  'collection_id',
  'position',
  'created_at',
  'updated_at',
  'raw_payload_id',
];

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

const buildApp = (): Hono => {
  const app = new Hono();
  app.route('/api/shared/collections', sharedCollectionsRoute);
  return app;
};

const expectSharedSignalContract = (signal: Record<string, unknown>): void => {
  for (const key of OWNER_ONLY_SHARED_KEYS) {
    expect(signal).not.toHaveProperty(key);
  }
  const points = Array.isArray(signal.points) ? signal.points : [];
  for (const point of points) {
    expect(point).not.toHaveProperty('raw_payload_id');
  }
};

const seedCollection = (
  db: Drizzle,
  opts: {
    readonly id?: string;
    readonly visibility?: Visibility;
    readonly slug?: string | null;
    readonly layoutSignalIds?: ReadonlyArray<string>;
  } = {},
): void => {
  db.insert(schema.collections)
    .values({
      id: opts.id ?? 'collection-1',
      ownerId: 'owner-1',
      title: 'Shared collection',
      description: 'Soft-secret collection',
      visibility: opts.visibility ?? 'shared',
      slug: opts.slug ?? 'shared-slug',
      layout: JSON.stringify({
        version: 1,
        slots: (opts.layoutSignalIds ?? []).map((signalId, index) => ({
          signal_id: signalId,
          x: 0,
          y: index,
          w: 4,
          h: 3,
        })),
      }) as unknown as schema.CollectionLayout,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly templateId: string;
    readonly visibility: Visibility;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: 'collection-1',
      templateId: opts.templateId,
      title: opts.id,
      config:
        opts.templateId === 'fx-pair'
          ? (JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig)
          : (JSON.stringify({ symbol: 'BA.L' }) as unknown as schema.SignalConfig),
      refreshSeconds: 900,
      position: opts.position,
      visibility: opts.visibility,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedPoint = (db: Drizzle, signalId: string, value: number): void => {
  const observedAt = new Date(1_700_000_000_000 + value);
  db.insert(schema.signalPoints)
    .values({
      signalId,
      fetchedAt: observedAt,
      observedAt,
      metricKey: `metric-${signalId}`,
      dimensions: JSON.stringify({ signal: signalId }) as unknown as schema.DataPointDimensions,
      value,
      unit: 'USD',
      sourceUrl: `https://example.test/${signalId}`,
    })
    .run();
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: observedAt,
      updatedAt: observedAt,
    })
    .run();
};

describe('GET /api/shared/collections/:slug', () => {
  it('returns 404 for unknown, private, or public collections without requiring auth', async () => {
    const { db, env } = setup();
    seedCollection(db, { visibility: 'private', slug: 'private-slug' });
    seedCollection(db, { id: 'collection-2', visibility: 'public', slug: 'public-slug' });
    const app = buildApp();

    const unknown = await app.request('/api/shared/collections/missing', undefined, env);
    const privateCollection = await app.request(
      '/api/shared/collections/private-slug',
      undefined,
      env,
    );
    const publicCollection = await app.request(
      '/api/shared/collections/public-slug',
      undefined,
      env,
    );

    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'not_found' });
    expect(privateCollection.status).toBe(404);
    expect(await privateCollection.json()).toEqual({ error: 'not_found' });
    expect(publicCollection.status).toBe(404);
    expect(await publicCollection.json()).toEqual({ error: 'not_found' });
  });

  it('returns shared-link eligible signals and strips owner-only fields', async () => {
    const { db, env } = setup();
    seedCollection(db, {
      layoutSignalIds: ['shared-fx', 'public-fx', 'private-fx', 'auth-app-usage'],
    });
    seedSignal(db, {
      id: 'shared-fx',
      templateId: 'fx-pair',
      visibility: 'shared',
      position: 0,
    });
    seedSignal(db, { id: 'public-fx', templateId: 'fx-pair', visibility: 'public', position: 1 });
    seedSignal(db, { id: 'private-fx', templateId: 'fx-pair', visibility: 'private', position: 2 });
    seedSignal(db, {
      id: 'auth-app-usage',
      templateId: 'app-usage',
      visibility: 'shared',
      position: 3,
    });
    seedPoint(db, 'shared-fx', 72.5);
    seedPoint(db, 'public-fx', 1.09);
    seedPoint(db, 'auth-app-usage', 3);

    const res = await buildApp().request('/api/shared/collections/shared-slug', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      collection: {
        id: string;
        visibility: string;
        slug: string | null;
        layout: { slots: Array<{ signal_id: string }> } | null;
      };
      signals: Array<Record<string, unknown> & { id: string; points: Array<{ value: number }> }>;
    } = await res.json();
    expect(body.collection).toMatchObject({
      id: 'collection-1',
      visibility: 'shared',
      slug: 'shared-slug',
    });
    expect(body.collection.layout?.slots.map((slot) => slot.signal_id)).toEqual([
      'shared-fx',
      'public-fx',
    ]);
    expect(body.signals.map((signal) => signal.id)).toEqual(['shared-fx', 'public-fx']);
    for (const signal of body.signals) expectSharedSignalContract(signal);
    expect(body.signals[0]?.points[0]?.value).toBe(72.5);

    const [privateSignal] = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.id, 'private-fx'))
      .all();
    expect(privateSignal?.visibility).toBe('private');
  });

  it('redacts the raw adapter error from status for shared-link readers', async () => {
    const { db, env } = setup();
    seedCollection(db, { layoutSignalIds: ['shared-fx'] });
    seedSignal(db, { id: 'shared-fx', templateId: 'fx-pair', visibility: 'shared', position: 0 });
    const at = new Date(1_700_000_000_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'shared-fx',
        status: 'error',
        lastOkAt: at,
        lastError: 'FETCH_FAILED: upstream https://internal.example/v1/quote returned 500',
        updatedAt: at,
      })
      .run();

    const res = await buildApp().request('/api/shared/collections/shared-slug', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      signals: Array<{ id: string; status: { status: string | null; last_error: string | null } }>;
    } = await res.json();
    const signal = body.signals.find((s) => s.id === 'shared-fx');
    // Coarse health is visible; the raw adapter error text is owner-only.
    expect(signal?.status.status).toBe('error');
    expect(signal?.status.last_error).toBeNull();
  });
});
