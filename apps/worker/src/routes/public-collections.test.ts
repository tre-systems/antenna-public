import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { Visibility } from '../policy/source-access';
import { publicCollectionsRoute } from './public-collections';
import { requesterMetadataHash } from './public-collection-helpers';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;
const OWNER_ONLY_PUBLIC_KEYS = [
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
  CREATE TABLE user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified integer DEFAULT false NOT NULL,
    image text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    first_seen_at integer,
    onboarded_at integer
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
  CREATE TABLE public_collection_reports (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id) ON DELETE cascade,
    category text NOT NULL,
    message text,
    requester_hash text NOT NULL,
    created_at integer NOT NULL
  );
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const setup = (): { db: Drizzle; env: { DB: D1Database; BETTER_AUTH_SECRET: string } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: {
      DB: { __sqlite: sqlite } as unknown as D1Database,
      BETTER_AUTH_SECRET: 'test-better-auth-secret',
    },
  };
};

const buildApp = (): Hono => {
  const app = new Hono();
  app.route('/api/public/collections', publicCollectionsRoute);
  return app;
};

const expectPublicSignalContract = (signal: Record<string, unknown>): void => {
  for (const key of OWNER_ONLY_PUBLIC_KEYS) {
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
    readonly ownerId?: string;
    readonly title?: string;
    readonly description?: string | null;
    readonly visibility?: Visibility;
    readonly slug?: string | null;
    readonly layoutSignalIds?: ReadonlyArray<string>;
    readonly updatedAt?: Date;
  } = {},
): void => {
  db.insert(schema.collections)
    .values({
      id: opts.id ?? 'collection-1',
      ownerId: opts.ownerId ?? 'owner-1',
      title: opts.title ?? 'Public collection',
      description: opts.description === undefined ? 'External collection' : opts.description,
      visibility: opts.visibility ?? 'public',
      slug: opts.slug ?? 'public-slug',
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
      updatedAt: opts.updatedAt ?? new Date(0),
    })
    .run();
};

const seedUser = (
  db: Drizzle,
  opts: {
    readonly id?: string;
    readonly name?: string;
    readonly email?: string;
  } = {},
): void => {
  const id = opts.id ?? 'owner-1';
  db.insert(schema.user)
    .values({
      id,
      name: opts.name ?? 'Rob',
      email: opts.email ?? `${id}@example.test`,
      emailVerified: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly collectionId?: string;
    readonly templateId: string;
    readonly visibility: Visibility;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: opts.collectionId ?? 'collection-1',
      templateId: opts.templateId,
      title: opts.id,
      config:
        opts.templateId === 'fx-pair'
          ? (JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig)
          : (JSON.stringify({ symbol: 'AZN.L' }) as unknown as schema.SignalConfig),
      refreshSeconds: 900,
      position: opts.position,
      visibility: opts.visibility,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

describe('GET /api/public/collections', () => {
  it('keeps public discovery hidden even when public collections exist', async () => {
    const { db, env } = setup();
    seedUser(db, { name: 'Test User' });
    seedCollection(db, {
      id: 'public',
      title: 'Hidden public collection',
      slug: 'hidden-public',
    });
    seedSignal(db, {
      id: 'public-fx',
      collectionId: 'public',
      templateId: 'fx-pair',
      visibility: 'public',
      position: 0,
    });

    const res = await buildApp().request('/api/public/collections?limit=100', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ collections: [], next_offset: null });
  });
});

describe('GET /api/public/collections/:slug', () => {
  it('returns 404 for unknown, private, or shared collections without requiring auth', async () => {
    const { db, env } = setup();
    seedCollection(db, { visibility: 'private', slug: 'private-slug' });
    seedCollection(db, { id: 'collection-2', visibility: 'shared', slug: 'shared-slug' });
    const app = buildApp();

    const unknown = await app.request('/api/public/collections/missing', undefined, env);
    const privateCollection = await app.request(
      '/api/public/collections/private-slug',
      undefined,
      env,
    );
    const sharedCollection = await app.request(
      '/api/public/collections/shared-slug',
      undefined,
      env,
    );

    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'not_found' });
    expect(privateCollection.status).toBe(404);
    expect(await privateCollection.json()).toEqual({ error: 'not_found' });
    expect(sharedCollection.status).toBe(404);
    expect(await sharedCollection.json()).toEqual({ error: 'not_found' });
  });

  it('returns only public-display eligible public signals and strips owner-only fields', async () => {
    const { db, env } = setup();
    seedCollection(db, { layoutSignalIds: ['public-fx', 'private-fx', 'blocked-market'] });
    seedSignal(db, { id: 'public-fx', templateId: 'fx-pair', visibility: 'public', position: 0 });
    seedSignal(db, { id: 'private-fx', templateId: 'fx-pair', visibility: 'private', position: 1 });
    seedSignal(db, {
      id: 'blocked-market',
      templateId: 'market-history',
      visibility: 'public',
      position: 2,
    });
    const observedAt = new Date(1_700_000_000_000);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'public-fx',
        fetchedAt: observedAt,
        observedAt,
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
        sourceUrl: 'https://example.test/fx',
      })
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'public-fx',
        status: 'live',
        lastOkAt: observedAt,
        updatedAt: observedAt,
      })
      .run();

    const res = await buildApp().request('/api/public/collections/public-slug', undefined, env);

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
      visibility: 'public',
      slug: 'public-slug',
    });
    expect(body.collection.layout?.slots.map((slot) => slot.signal_id)).toEqual(['public-fx']);
    expect(body.signals.map((signal) => signal.id)).toEqual(['public-fx']);
    for (const signal of body.signals) expectPublicSignalContract(signal);
    expect(body.signals[0]?.points[0]?.value).toBe(1.09);

    const [privateSignal] = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.id, 'private-fx'))
      .all();
    expect(privateSignal?.visibility).toBe('private');
  });

  it('redacts the raw adapter error from status for anonymous readers', async () => {
    const { db, env } = setup();
    seedCollection(db, { layoutSignalIds: ['public-fx'] });
    seedSignal(db, { id: 'public-fx', templateId: 'fx-pair', visibility: 'public', position: 0 });
    const at = new Date(1_700_000_000_000);
    db.insert(schema.signalStatus)
      .values({
        signalId: 'public-fx',
        status: 'stale',
        lastOkAt: at,
        lastError: 'FETCH_FAILED: upstream https://internal.example/v1/quote returned 500',
        updatedAt: at,
      })
      .run();

    const res = await buildApp().request('/api/public/collections/public-slug', undefined, env);

    expect(res.status).toBe(200);
    const body: {
      signals: Array<{ id: string; status: { status: string | null; last_error: string | null } }>;
    } = await res.json();
    const signal = body.signals.find((s) => s.id === 'public-fx');
    // The coarse health state stays visible so the UI can flag staleness…
    expect(signal?.status.status).toBe('stale');
    // …but the raw adapter error text must never reach anonymous readers.
    expect(signal?.status.last_error).toBeNull();
  });
});

describe('requesterMetadataHash', () => {
  const request = (): Request =>
    new Request('https://antenna.example/api/public/collections/x/report', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '203.0.113.10', 'User-Agent': 'Vitest' },
    });

  it('is deterministic for the same secret and metadata', async () => {
    const a = await requesterMetadataHash(request(), 'shared-secret');
    const b = await requesterMetadataHash(request(), 'shared-secret');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is keyed: a different secret yields a different hash (not plain SHA-256)', async () => {
    const withKeyA = await requesterMetadataHash(request(), 'secret-a');
    const withKeyB = await requesterMetadataHash(request(), 'secret-b');
    expect(withKeyA).not.toBe(withKeyB);

    // Guard against a regression back to an unkeyed digest an attacker could
    // recompute from IP + UA alone.
    const plain = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('203.0.113.10\nVitest'),
    );
    const plainHex = [...new Uint8Array(plain)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(withKeyA).not.toBe(plainHex);
  });
});

describe('POST /api/public/collections/:slug/report', () => {
  it('stores a report for a public collection with hashed requester metadata', async () => {
    const { db, env } = setup();
    seedCollection(db);

    const res = await buildApp().request(
      '/api/public/collections/public-slug/report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10',
          'User-Agent': 'Vitest',
        },
        body: JSON.stringify({ category: 'broken', message: 'Chart looks stale.' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: { id: string; created_at: number } = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/);
    expect(body.created_at).toBeGreaterThan(0);

    const [report] = db.select().from(schema.publicCollectionReports).all();
    expect(report).toMatchObject({
      id: body.id,
      collectionId: 'collection-1',
      category: 'broken',
      message: 'Chart looks stale.',
    });
    expect(report?.requesterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report?.requesterHash).not.toContain('203.0.113.10');
  });

  it('rejects invalid bodies and non-public collections', async () => {
    const { db, env } = setup();
    seedCollection(db, { visibility: 'private', slug: 'private-slug' });

    const invalid = await buildApp().request(
      '/api/public/collections/private-slug/report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'abuse' }),
      },
      env,
    );
    const privateCollection = await buildApp().request(
      '/api/public/collections/private-slug/report',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'inappropriate' }),
      },
      env,
    );

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'invalid_body' });
    expect(privateCollection.status).toBe(404);
    expect(await privateCollection.json()).toEqual({ error: 'not_found' });
    expect(db.select().from(schema.publicCollectionReports).all()).toEqual([]);
  });
});
