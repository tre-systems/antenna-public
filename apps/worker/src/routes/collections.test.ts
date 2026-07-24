import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type {
  CollectionSignalOrderRecord,
  CollectionDeleteResponse,
  CollectionDetailResponse,
  CollectionListResponse,
  CollectionRecord,
  CollectionTemplatePublishRecord,
} from '@antenna/shared';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import type { Visibility } from '../policy/source-access';
import { collectionsRoute } from './collections';

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
  CREATE TABLE user_collection_visits (
    user_id text NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    last_seen_at integer NOT NULL,
    PRIMARY KEY (user_id, collection_id)
  );
  CREATE TABLE collection_template_publications (
    collection_id text PRIMARY KEY NOT NULL REFERENCES collections(id),
    label text NOT NULL,
    description text,
    summary text NOT NULL,
    published_by text NOT NULL,
    published_at integer NOT NULL,
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
  CREATE TABLE signal_alerts (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    signal_id text NOT NULL REFERENCES signals(id),
    rule_id text NOT NULL,
    rule_label text NOT NULL,
    metric_key text NOT NULL,
    observed_at integer NOT NULL,
    triggered_at integer NOT NULL,
    value real NOT NULL,
    previous_value real NOT NULL,
    unit text,
    source_url text
  );
  CREATE TABLE notification_prefs (
    user_id text NOT NULL,
    scope text NOT NULL,
    collection_id text REFERENCES collections(id),
    channel text NOT NULL,
    enabled integer DEFAULT false NOT NULL,
    frequency text DEFAULT 'daily' NOT NULL,
    quiet_hours_start text,
    quiet_hours_end text,
    updated_at integer NOT NULL,
    PRIMARY KEY (user_id, scope, channel)
  );
  CREATE TABLE notification_deliveries (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    channel text NOT NULL,
    period_start integer NOT NULL,
    period_end integer NOT NULL,
    sent_at integer,
    status text NOT NULL,
    error text
  );
  CREATE TABLE dismissed_starter_signals (
    collection_id text NOT NULL REFERENCES collections(id),
    signal_signature text NOT NULL,
    dismissed_at integer NOT NULL,
    PRIMARY KEY (collection_id, signal_signature)
  );
  CREATE TABLE collection_plans (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    prompt text NOT NULL,
    proposed text NOT NULL,
    status text DEFAULT 'proposed' NOT NULL,
    created_at integer NOT NULL,
    resolved_at integer
  );
  CREATE TABLE connector_requests (
    id text PRIMARY KEY NOT NULL,
    collection_id text REFERENCES collections(id),
    prompt text NOT NULL,
    requested_by text NOT NULL,
    notes text,
    status text DEFAULT 'requested' NOT NULL,
    created_at integer NOT NULL,
    resolved_at integer
  );
  CREATE TABLE public_collection_reports (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
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

const USER: SessionUser = { id: 'user-1', email: 'user@test.local', name: 'User' };

const setup = (): { db: Drizzle; env: { DB: D1Database } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: { DB: { __sqlite: sqlite } as unknown as D1Database },
  };
};

const buildApp = (user: SessionUser = USER): Hono<{ Variables: AuthVars }> => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/collections', collectionsRoute);
  return app;
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
      id: opts.id ?? 'source-dash',
      ownerId: 'source-owner',
      title: 'Founder Morning',
      description: 'A public collection to fork',
      visibility: opts.visibility ?? 'public',
      slug: opts.slug ?? 'source-slug',
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
      collectionId: 'source-dash',
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

const seedOwnedCollection = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly ownerId?: string;
    readonly title: string;
    readonly description?: string | null;
    readonly visibility?: Visibility;
    readonly slug?: string | null;
    readonly updatedAt: number;
  },
): void => {
  db.insert(schema.collections)
    .values({
      id: opts.id,
      ownerId: opts.ownerId ?? USER.id,
      title: opts.title,
      description: opts.description ?? null,
      visibility: opts.visibility ?? 'private',
      slug: opts.slug ?? null,
      createdAt: new Date(0),
      updatedAt: new Date(opts.updatedAt),
    })
    .run();
};

const seedOwnedSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly collectionId: string;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: opts.collectionId,
      templateId: 'fx-pair',
      title: opts.id,
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: opts.position,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignalChildren = (db: Drizzle, collectionId: string, signalId: string): void => {
  db.insert(schema.signalPoints)
    .values({
      signalId,
      fetchedAt: new Date(1_000),
      observedAt: new Date(1_000),
      metricKey: 'latest',
      value: 12,
    })
    .run();
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: new Date(1_000),
      updatedAt: new Date(1_000),
    })
    .run();
  db.insert(schema.signalAlerts)
    .values({
      id: `alert-${collectionId}`,
      collectionId,
      signalId,
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'value',
      observedAt: new Date(1_000),
      triggeredAt: new Date(1_000),
      value: 1.09,
      previousValue: 1.08,
    })
    .run();
  db.insert(schema.notificationPrefs)
    .values({
      userId: USER.id,
      scope: `collection:${collectionId}`,
      collectionId,
      channel: 'daily_digest',
      enabled: true,
      frequency: 'daily',
      updatedAt: new Date(1_000),
    })
    .run();
  db.insert(schema.notificationDeliveries)
    .values({
      id: `delivery-${collectionId}`,
      userId: USER.id,
      collectionId,
      channel: 'daily_digest',
      periodStart: new Date(0),
      periodEnd: new Date(1_000),
      sentAt: new Date(1_000),
      status: 'sent',
    })
    .run();
  db.insert(schema.dismissedStarterSignals)
    .values({
      collectionId,
      signalSignature: 'fx-pair:EUR/USD',
      dismissedAt: new Date(1_000),
    })
    .run();
  db.insert(schema.collectionPlans)
    .values({
      id: `plan-${collectionId}`,
      collectionId,
      prompt: 'add weather',
      proposed: JSON.stringify([]) as unknown as schema.ProposedPlan,
      status: 'proposed',
      createdAt: new Date(1_000),
    })
    .run();
  db.insert(schema.connectorRequests)
    .values({
      id: `request-${collectionId}`,
      collectionId,
      prompt: 'unsupported',
      requestedBy: USER.id,
      createdAt: new Date(1_000),
    })
    .run();
  db.insert(schema.publicCollectionReports)
    .values({
      id: `report-${collectionId}`,
      collectionId,
      category: 'broken',
      requesterHash: 'hash',
      createdAt: new Date(1_000),
    })
    .run();
  db.insert(schema.userCollectionVisits)
    .values({
      userId: USER.id,
      collectionId,
      lastSeenAt: new Date(1_000),
    })
    .run();
  db.insert(schema.collectionTemplatePublications)
    .values({
      collectionId,
      label: 'Delete template',
      description: 'Will be removed',
      summary: 'Delete me',
      publishedBy: USER.id,
      publishedAt: new Date(1_000),
      updatedAt: new Date(1_000),
    })
    .run();
};

const seedSignalSnapshot = (db: Drizzle, signalId: string): void => {
  db.insert(schema.signalPoints)
    .values({
      signalId,
      fetchedAt: new Date(2_000),
      observedAt: new Date(2_000),
      metricKey: 'latest',
      value: 1.08,
      unit: 'USD',
      sourceUrl: 'https://example.com/fx',
    })
    .run();
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: new Date(2_000),
      updatedAt: new Date(3_000),
    })
    .run();
};

describe('GET /api/collections', () => {
  it('lists the current users collections in updated order with signal counts', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'older',
      title: 'Older collection',
      description: null,
      updatedAt: 1_000,
    });
    seedOwnedCollection(db, {
      id: 'newer',
      title: 'Newer collection',
      description: 'Daily view',
      visibility: 'shared',
      slug: 'newer-slug',
      updatedAt: 3_000,
    });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other user',
      updatedAt: 4_000,
    });
    seedOwnedSignal(db, { id: 'newer-a', collectionId: 'newer', position: 0 });
    seedOwnedSignal(db, { id: 'newer-b', collectionId: 'newer', position: 1 });
    seedOwnedSignal(db, { id: 'older-a', collectionId: 'older', position: 0 });
    seedOwnedSignal(db, { id: 'other-a', collectionId: 'other', position: 0 });

    const res = await buildApp().request('/api/collections', undefined, env);

    expect(res.status).toBe(200);
    const body: CollectionListResponse = await res.json();
    expect(body).toEqual({
      collections: [
        {
          id: 'newer',
          title: 'Newer collection',
          description: 'Daily view',
          visibility: 'shared',
          slug: 'newer-slug',
          updated_at: 3_000,
          signal_count: 2,
        },
        {
          id: 'older',
          title: 'Older collection',
          description: null,
          visibility: 'private',
          slug: null,
          updated_at: 1_000,
          signal_count: 1,
        },
      ],
    });
  });

  it('returns an empty list when the user has no collections', async () => {
    const { env } = setup();

    const res = await buildApp().request('/api/collections', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ collections: [] });
  });
});

describe('GET /api/collections/:id', () => {
  it('returns an owned collection with signals in position order', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'collection-1',
      title: 'Main',
      description: 'Primary collection',
      updatedAt: 5_000,
    });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'collection-1', position: 1 });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'collection-1', position: 0 });
    seedSignalSnapshot(db, 'b1');

    const res = await buildApp().request('/api/collections/collection-1', undefined, env);

    expect(res.status).toBe(200);
    const body: CollectionDetailResponse = await res.json();
    expect(body.collection).toMatchObject({
      id: 'collection-1',
      title: 'Main',
      description: 'Primary collection',
      visibility: 'private',
      slug: null,
      layout: null,
      updated_at: 5_000,
      last_seen_at: null,
    });
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.userId).toBe(USER.id);
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(0);
    expect(body.signals.map((signal) => signal.id)).toEqual(['b1', 'b2']);
    expect(body.signals[0]).toMatchObject({
      id: 'b1',
      template_id: 'fx-pair',
      config: { base: 'EUR', quote: 'USD' },
      refresh_seconds: 900,
      status: {
        status: 'live',
        last_ok_at: 2_000,
        last_attempt_at: 3_000,
      },
    });
    expect(body.signals[0]?.points[0]).toMatchObject({
      value: 1.08,
      unit: 'USD',
      source_url: 'https://example.com/fx',
    });
    expect(body.signals[1]?.points).toEqual([]);
  });

  it('returns the previous visit marker before updating collection detail visits', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'collection-1',
      title: 'Main',
      updatedAt: 5_000,
    });
    db.insert(schema.userCollectionVisits)
      .values({
        userId: USER.id,
        collectionId: 'collection-1',
        lastSeenAt: new Date(2_468),
      })
      .run();

    const res = await buildApp().request('/api/collections/collection-1', undefined, env);

    expect(res.status).toBe(200);
    const body: CollectionDetailResponse = await res.json();
    expect(body.collection.last_seen_at).toBe(2_468);
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(2_468);
  });

  it('returns 404 for missing or cross-owner collections', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });

    const missing = await buildApp().request('/api/collections/missing', undefined, env);
    const other = await buildApp().request('/api/collections/other', undefined, env);

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
  });
});

describe('PATCH /api/collections/:id', () => {
  it('updates an owned collection and validates layout signal ownership', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'collection-1',
      title: 'Main',
      description: null,
      updatedAt: 1_000,
    });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'collection-1', position: 0 });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'collection-1', position: 1 });

    const res = await buildApp().request(
      '/api/collections/collection-1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Renamed',
          description: 'Updated description',
          visibility: 'public',
          layout: {
            version: 1,
            slots: [
              { signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 },
              { signal_id: 'b2', x: 4, y: 0, w: 4, h: 3 },
            ],
          },
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      id: 'collection-1',
      title: 'Renamed',
      description: 'Updated description',
      visibility: 'public',
    });
    expect(body.slug).toMatch(/^[a-f0-9]{32}$/);
    expect(body.layout?.slots.map((slot) => slot.signal_id)).toEqual(['b1', 'b2']);

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(row).toMatchObject({
      title: 'Renamed',
      description: 'Updated description',
      visibility: 'public',
      slug: body.slug,
    });
  });

  it('rejects missing, cross-owner, and invalid layout updates', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });

    const missing = await buildApp().request(
      '/api/collections/missing',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Nope' }),
      },
      env,
    );
    const other = await buildApp().request(
      '/api/collections/other',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Nope' }),
      },
      env,
    );
    const invalidLayout = await buildApp().request(
      '/api/collections/own',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'missing', x: 0, y: 0, w: 4, h: 3 }] },
        }),
      },
      env,
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
    expect(invalidLayout.status).toBe(400);
    expect(await invalidLayout.json()).toEqual({ error: 'invalid_layout_signals' });
  });
});

describe('PATCH /api/collections/:id/signals/order', () => {
  it('reorders signals on the requested owned collection', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'collection-1', title: 'Main', updatedAt: 1_000 });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'collection-1', position: 0 });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'collection-1', position: 1 });
    seedOwnedSignal(db, { id: 'b3', collectionId: 'collection-1', position: 2 });

    const res = await buildApp().request(
      '/api/collections/collection-1/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b3', 'b1', 'b2'] }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: CollectionSignalOrderRecord = await res.json();
    expect(body).toEqual({ updated: true, ordered_signal_ids: ['b3', 'b1', 'b2'] });

    const rows = db
      .select({ id: schema.signals.id, position: schema.signals.position })
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'collection-1'))
      .all()
      .sort((a, b) => a.position - b.position);
    expect(rows.map((row) => row.id)).toEqual(['b3', 'b1', 'b2']);
  });

  it('rejects missing, cross-owner, and invalid signal order requests', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'own', position: 0 });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'own', position: 1 });
    seedOwnedSignal(db, { id: 'other-b1', collectionId: 'other', position: 0 });

    const missing = await buildApp().request(
      '/api/collections/missing/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b2'] }),
      },
      env,
    );
    const other = await buildApp().request(
      '/api/collections/other/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['other-b1'] }),
      },
      env,
    );
    const invalidOrder = await buildApp().request(
      '/api/collections/own/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'other-b1'] }),
      },
      env,
    );
    const duplicate = await buildApp().request(
      '/api/collections/own/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b1'] }),
      },
      env,
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
    expect(invalidOrder.status).toBe(400);
    expect(await invalidOrder.json()).toEqual({ error: 'invalid_order_signals' });
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ error: 'invalid_body' });
  });
});

describe('POST /api/collections', () => {
  it('creates a private blank collection for the current user', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Product signals', description: 'Daily product collection' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      title: 'Product signals',
      description: 'Daily product collection',
      visibility: 'private',
      slug: null,
      layout: null,
    });
    expect(body.updated_at).toBeGreaterThan(0);

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, body.id))
      .all();
    expect(row).toMatchObject({
      ownerId: USER.id,
      title: 'Product signals',
      description: 'Daily product collection',
      visibility: 'private',
      slug: null,
      forkedFromCollectionId: null,
    });
  });

  it('creates a slug when the new collection is externally visible', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Shared signals', visibility: 'shared' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body.visibility).toBe('shared');
    expect(body.slug).toMatch(/^[a-f0-9]{32}$/);
    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all();
    expect(signals).toEqual([]);
  });

  it('creates a collection from a registered collection template', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'My founder morning',
          description: 'Template-backed collection',
          template_id: 'founder-morning',
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      title: 'My founder morning',
      description: 'Template-backed collection',
      visibility: 'private',
      layout: null,
    });

    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all()
      .sort((a, b) => a.position - b.position);
    expect(signals.map((signal) => [signal.templateId, signal.title, signal.visibility])).toEqual([
      ['market-overview', 'Market overview', 'private'],
      ['github-trending', 'GitHub Trending', 'private'],
      ['aa-frontier', 'Frontier model comparison', 'private'],
      ['karpathy-jobs-snapshot', 'Karpathy jobs', 'private'],
      ['uk-economic-calendar', 'UK economic calendar', 'private'],
    ]);
    expect(JSON.parse(signals[2]?.config as unknown as string)).toEqual({ limit: 5 });

    const statuses = db
      .select()
      .from(schema.signalStatus)
      .all()
      .sort((a, b) => a.signalId.localeCompare(b.signalId));
    expect(statuses).toHaveLength(signals.length);
    expect(statuses.every((status) => status.status === 'loading')).toBe(true);
  });

  it('accepts templateId as a query parameter for template-backed creation', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections?templateId=ops-morning',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Ops collection' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all();
    expect(signals.map((signal) => signal.templateId)).toContain('cloudflare-incidents');
  });

  it('creates a collection from a published community collection template by forking safe signals', async () => {
    const { db, env } = setup();
    seedCollection(db, { layoutSignalIds: ['public-fx', 'blocked-market'] });
    seedSignal(db, { id: 'public-fx', templateId: 'fx-pair', visibility: 'public', position: 0 });
    seedSignal(db, {
      id: 'blocked-market',
      templateId: 'market-history',
      visibility: 'public',
      position: 1,
    });
    db.insert(schema.collectionTemplatePublications)
      .values({
        collectionId: 'source-dash',
        label: 'Published signals',
        description: 'A public template',
        summary: 'Forkable public signals',
        publishedBy: 'source-owner',
        publishedAt: new Date(2_000),
        updatedAt: new Date(2_000),
      })
      .run();

    const res = await buildApp().request(
      '/api/collections?templateId=collection:source-slug',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'My community copy' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      title: 'My community copy',
      description: 'A public collection to fork',
      visibility: 'private',
      slug: null,
    });

    const [collection] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, body.id))
      .all();
    expect(collection?.forkedFromCollectionId).toBe('source-dash');

    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all();
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      templateId: 'fx-pair',
      title: 'public-fx',
      visibility: 'private',
    });
    expect(body.layout?.slots).toHaveLength(1);
    expect(body.layout?.slots[0]?.signal_id).toBe(signals[0]?.id);
  });

  it('rejects unknown templates and externally unsafe template-backed creation', async () => {
    const { env } = setup();

    const unknown = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Unknown', template_id: 'missing-template' }),
      },
      env,
    );
    const unsafePublic = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Public investor watchlist',
          visibility: 'public',
          template_id: 'investor-watchlist',
        }),
      },
      env,
    );

    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'unknown_collection_template' });
    expect(unsafePublic.status).toBe(409);
    expect(await unsafePublic.json()).toEqual({
      error: 'source_policy_blocked',
      reason: 'source_not_public_display_eligible',
    });
  });

  it('rejects invalid create bodies', async () => {
    const { env } = setup();

    const emptyTitle = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      },
      env,
    );
    const templateId = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'With template', templateId: 'founder-morning' }),
      },
      env,
    );

    expect(emptyTitle.status).toBe(400);
    expect(await emptyTitle.json()).toEqual({ error: 'invalid_body' });
    expect(templateId.status).toBe(400);
    expect(await templateId.json()).toEqual({ error: 'invalid_body' });
  });

  it('rejects new collections when the user is at the free quota', async () => {
    const { db, env } = setup();
    for (let i = 0; i < 10; i += 1) {
      seedOwnedCollection(db, {
        id: `collection-${String(i)}`,
        title: `Dash ${String(i)}`,
        updatedAt: i,
      });
    }
    seedOwnedCollection(db, {
      id: 'other-user-dash',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 11,
    });

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'One too many' }),
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'collection_quota_exceeded',
      quota: { used: 10, limit: 10, remaining: 0, can_create: false },
    });
  });
});

describe('POST /api/collections/:id/template', () => {
  it('publishes an owned public collection as a community template using public-safe signals only', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'own-public',
      title: 'My public collection',
      description: 'Public source collection',
      visibility: 'public',
      slug: 'own-public-slug',
      updatedAt: 1_000,
    });
    seedOwnedSignal(db, { id: 'public-fx', collectionId: 'own-public', position: 0 });
    db.update(schema.signals)
      .set({ visibility: 'public' })
      .where(eq(schema.signals.id, 'public-fx'))
      .run();
    db.insert(schema.signals)
      .values({
        id: 'blocked-market',
        collectionId: 'own-public',
        templateId: 'market-history',
        title: 'Signaled market chart',
        config: JSON.stringify({ symbol: 'AZN.L' }) as unknown as schema.SignalConfig,
        refreshSeconds: 3_600,
        position: 1,
        visibility: 'public',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const res = await buildApp().request(
      '/api/collections/own-public/template',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: 'Useful public signals',
          summary: 'One safe public card',
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: CollectionTemplatePublishRecord = await res.json();
    expect(body.template).toMatchObject({
      id: 'collection:own-public-slug',
      kind: 'community',
      label: 'Useful public signals',
      description: 'Public source collection',
      summary: 'One safe public card',
      source_collection_id: 'own-public',
      fork_source_slug: 'own-public-slug',
      owner_display_name: USER.name,
    });
    expect(body.template.signals).toEqual([
      {
        template_id: 'fx-pair',
        display_name: 'FX pair',
        title: 'public-fx',
      },
    ]);
    expect(body.skipped_signals).toEqual([
      {
        id: 'blocked-market',
        title: 'Signaled market chart',
        template_id: 'market-history',
        reason: 'source_not_public_display_eligible',
      },
    ]);

    const [publication] = db
      .select()
      .from(schema.collectionTemplatePublications)
      .where(eq(schema.collectionTemplatePublications.collectionId, 'own-public'))
      .all();
    expect(publication).toMatchObject({
      label: 'Useful public signals',
      summary: 'One safe public card',
      publishedBy: USER.id,
    });
  });

  it('rejects missing, non-public, and empty public collections', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'private', title: 'Private', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'empty-public',
      title: 'Empty',
      visibility: 'public',
      slug: 'empty-public',
      updatedAt: 2_000,
    });
    const app = buildApp();

    const missing = await app.request('/api/collections/missing/template', { method: 'POST' }, env);
    const privateCollection = await app.request(
      '/api/collections/private/template',
      { method: 'POST' },
      env,
    );
    const empty = await app.request(
      '/api/collections/empty-public/template',
      { method: 'POST' },
      env,
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(privateCollection.status).toBe(409);
    expect(await privateCollection.json()).toEqual({ error: 'collection_not_public' });
    expect(empty.status).toBe(409);
    expect(await empty.json()).toEqual({ error: 'no_template_signals', skipped_signals: [] });
  });
});

describe('DELETE /api/collections/:id', () => {
  it('deletes an owned collection and its dependent rows', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'keep', title: 'Keep', updatedAt: 2_000 });
    seedOwnedCollection(db, { id: 'delete-me', title: 'Delete', updatedAt: 1_000 });
    seedOwnedSignal(db, { id: 'keep', collectionId: 'keep', position: 0 });
    seedOwnedSignal(db, { id: 'delete', collectionId: 'delete-me', position: 0 });
    seedSignalChildren(db, 'delete-me', 'delete');

    const res = await buildApp().request('/api/collections/delete-me', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    const body: CollectionDeleteResponse = await res.json();
    expect(body).toEqual({ deleted: true, id: 'delete-me' });
    expect(
      db
        .select()
        .from(schema.collections)
        .all()
        .map((row) => row.id),
    ).toEqual(['keep']);
    expect(
      db
        .select()
        .from(schema.signals)
        .all()
        .map((row) => row.id),
    ).toEqual(['keep']);
    expect(db.select().from(schema.signalPoints).all()).toEqual([]);
    expect(db.select().from(schema.signalStatus).all()).toEqual([]);
    expect(db.select().from(schema.signalAlerts).all()).toEqual([]);
    expect(db.select().from(schema.notificationPrefs).all()).toEqual([]);
    expect(db.select().from(schema.notificationDeliveries).all()).toEqual([]);
    expect(db.select().from(schema.dismissedStarterSignals).all()).toEqual([]);
    expect(db.select().from(schema.collectionPlans).all()).toEqual([]);
    expect(db.select().from(schema.connectorRequests).all()).toEqual([]);
    expect(db.select().from(schema.publicCollectionReports).all()).toEqual([]);
    expect(db.select().from(schema.userCollectionVisits).all()).toEqual([]);
    expect(db.select().from(schema.collectionTemplatePublications).all()).toEqual([]);
  });

  it('refuses to delete the users final collection', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'only', title: 'Only', updatedAt: 1_000 });

    const res = await buildApp().request('/api/collections/only', { method: 'DELETE' }, env);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_collection' });
    expect(db.select().from(schema.collections).all()).toHaveLength(1);
  });

  it('returns 404 for missing or cross-owner collections', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });

    const missing = await buildApp().request('/api/collections/missing', { method: 'DELETE' }, env);
    const other = await buildApp().request('/api/collections/other', { method: 'DELETE' }, env);

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
  });
});
