import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { collectionRoute } from './collection';

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
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const OWNER_1: SessionUser = { id: 'owner-1', email: 'one@test', name: 'One' };
const OWNER_2: SessionUser = { id: 'owner-2', email: 'two@test', name: 'Two' };

const setup = (): { db: Drizzle; env: { DB: D1Database } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: { DB: { __sqlite: sqlite } as unknown as D1Database },
  };
};

type App = Hono<{ Variables: AuthVars }>;

const buildApp = (user: SessionUser = OWNER_1): App => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/collection', collectionRoute);
  return app;
};

const seedCollection = (db: Drizzle, owner: SessionUser = OWNER_1): void => {
  db.insert(schema.collections)
    .values({
      id: owner.id === OWNER_1.id ? 'collection-1' : 'collection-2',
      ownerId: owner.id,
      title: owner.id === OWNER_1.id ? 'Antenna' : 'Other Collection',
      description: 'Initial description',
      layout: JSON.stringify({
        version: 1,
        slots: [{ signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 }],
      }) as unknown as schema.CollectionLayout,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignal = (db: Drizzle, id = 'b1', collectionId = 'collection-1'): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId,
      templateId: 'fx-pair',
      title: id,
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

describe('GET /api/collection', () => {
  it('returns the caller collection metadata and layout', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedCollection(db, OWNER_2);

    const res = await buildApp().request('/api/collection', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'collection-1',
      title: 'Antenna',
      description: 'Initial description',
      visibility: 'private',
      slug: null,
      layout: { version: 1, slots: [{ signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 }] },
      updated_at: 0,
      last_seen_at: null,
    });
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.userId).toBe(OWNER_1.id);
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(0);
  });

  it('returns the previous last seen timestamp before updating the visit marker', async () => {
    const { db, env } = setup();
    seedCollection(db);
    db.insert(schema.userCollectionVisits)
      .values({
        userId: OWNER_1.id,
        collectionId: 'collection-1',
        lastSeenAt: new Date(1_234),
      })
      .run();

    const res = await buildApp().request('/api/collection', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'collection-1', last_seen_at: 1_234 });
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(1_234);
  });

  it('handles concurrent first visits to the same collection', async () => {
    const { db, env } = setup();
    seedCollection(db);
    const app = buildApp();

    const responses = await Promise.all([
      app.request('/api/collection', undefined, env),
      app.request('/api/collection', undefined, env),
    ]);

    const visits = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    expect(visits).toHaveLength(1);
    expect(visits[0]?.lastSeenAt.getTime()).toBeGreaterThan(0);
  });

  it('provisions a collection when the auth hook has not already done so', async () => {
    const { db, env } = setup();

    const res = await buildApp().request('/api/collection', undefined, env);

    expect(res.status).toBe(200);
    const body: { id: string; title: string } = await res.json();
    expect(body.title).toBe('Antenna');
    const rows = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, OWNER_1.id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(body.id);
  });
});

describe('PATCH /api/collection', () => {
  it('updates the caller collection title, description, and layout', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db);
    seedCollection(db, OWNER_2);
    const layout = { version: 1, slots: [{ signal_id: 'b1', x: 2, y: 3, w: 6, h: 4 }] };

    const res = await buildApp().request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Morning collection',
          description: 'Daily operating view',
          layout,
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: 'collection-1',
      title: 'Morning collection',
      description: 'Daily operating view',
      layout,
    });
    const [own] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    const [other] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-2'))
      .all();
    expect(own?.title).toBe('Morning collection');
    expect(JSON.parse(own?.layout as unknown as string)).toEqual(layout);
    expect(other?.title).toBe('Other Collection');
  });

  it('clears nullable fields without replacing untouched fields', async () => {
    const { db, env } = setup();
    seedCollection(db);

    const res = await buildApp().request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ description: null, layout: null }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      title: 'Antenna',
      description: null,
      layout: null,
    });
    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(row?.description).toBeNull();
    expect(row?.layout).toBeNull();
  });

  it('revokes and rotates the share slug across a private transition', async () => {
    const { db, env } = setup();
    seedCollection(db);
    const app = buildApp();

    const shared = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'shared' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(shared.status).toBe(200);
    const sharedBody: { visibility: string; slug: string | null } = await shared.json();
    expect(sharedBody.visibility).toBe('shared');
    expect(sharedBody.slug).toMatch(/^[a-f0-9]{32}$/);

    const privateAgain = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'private' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const publicAgain = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility: 'public' }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(privateAgain.status).toBe(200);
    expect(publicAgain.status).toBe(200);
    const privateBody: { visibility: string; slug: string | null } = await privateAgain.json();
    const publicBody: { visibility: string; slug: string | null } = await publicAgain.json();
    expect(privateBody).toMatchObject({ visibility: 'private', slug: null });
    expect(publicBody.visibility).toBe('public');
    expect(publicBody.slug).toMatch(/^[a-f0-9]{32}$/);
    expect(publicBody.slug).not.toBe(sharedBody.slug);

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(row?.visibility).toBe('public');
    expect(row?.slug).toBe(publicBody.slug);
  });

  it('rejects empty, malformed, and invalid layout bodies', async () => {
    const { db, env } = setup();
    seedCollection(db);
    const app = buildApp();

    const empty = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const malformed = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: '{',
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const invalidLayout = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'b1', x: 0, y: 0, w: 0, h: 1 }] },
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'invalid_body' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_body' });
    expect(invalidLayout.status).toBe(400);
    expect(await invalidLayout.json()).toEqual({ error: 'invalid_body' });
  });

  it('rejects layouts that reference unknown or cross-owner signals', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, 'b1', 'collection-1');
    seedCollection(db, OWNER_2);
    seedSignal(db, 'b2', 'collection-2');
    const app = buildApp();

    const unknown = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'missing', x: 0, y: 0, w: 4, h: 3 }] },
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const otherTenant = await app.request(
      '/api/collection',
      {
        method: 'PATCH',
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'b2', x: 0, y: 0, w: 4, h: 3 }] },
        }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({ error: 'invalid_layout_signals' });
    expect(otherTenant.status).toBe(400);
    expect(await otherTenant.json()).toEqual({ error: 'invalid_layout_signals' });

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(JSON.parse(row?.layout as unknown as string)).toEqual({
      version: 1,
      slots: [{ signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 }],
    });
  });
});

describe('PATCH /api/collection/signals/order', () => {
  it('reorders all signals owned by the caller collection', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, 'b1', 'collection-1');
    seedSignal(db, 'b2', 'collection-1');
    seedSignal(db, 'b3', 'collection-1');
    const app = buildApp();

    const res = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b3', 'b1', 'b2'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      updated: true,
      ordered_signal_ids: ['b3', 'b1', 'b2'],
    });
    const rows = db
      .select({ id: schema.signals.id, position: schema.signals.position })
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'collection-1'))
      .orderBy(schema.signals.position)
      .all();
    expect(rows).toEqual([
      { id: 'b3', position: 0 },
      { id: 'b1', position: 1 },
      { id: 'b2', position: 2 },
    ]);
  });

  it('rejects missing, duplicate, unknown, and cross-owner signal ids without changing positions', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, 'b1', 'collection-1');
    seedSignal(db, 'b2', 'collection-1');
    seedCollection(db, OWNER_2);
    seedSignal(db, 'b3', 'collection-2');
    const app = buildApp();

    const missing = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b2'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const duplicate = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b1'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const otherTenant = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b3'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'invalid_order_signals' });
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ error: 'invalid_body' });
    expect(otherTenant.status).toBe(400);
    expect(await otherTenant.json()).toEqual({ error: 'invalid_order_signals' });

    const rows = db
      .select({ id: schema.signals.id, position: schema.signals.position })
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'collection-1'))
      .orderBy(schema.signals.id)
      .all();
    expect(rows).toEqual([
      { id: 'b1', position: 0 },
      { id: 'b2', position: 0 },
    ]);
  });
});
