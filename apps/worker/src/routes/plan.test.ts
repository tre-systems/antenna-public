import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import type { CollectionPlan, PlanRecord } from '@antenna/shared';
import { planRoute } from './plan';

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
  CREATE TABLE collection_plans (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    prompt text NOT NULL,
    proposed text NOT NULL,
    status text DEFAULT 'proposed' NOT NULL,
    created_at integer NOT NULL,
    resolved_at integer
  );
  CREATE TABLE plan_confirmation_claims (
    plan_id text PRIMARY KEY NOT NULL REFERENCES collection_plans(id) ON DELETE CASCADE,
    claimed_at integer NOT NULL
  );
  CREATE TRIGGER plan_confirmation_claim_must_be_proposed
  BEFORE INSERT ON plan_confirmation_claims
  WHEN NOT EXISTS (
    SELECT 1 FROM collection_plans
    WHERE id = NEW.plan_id AND status = 'proposed'
  )
  BEGIN
    SELECT RAISE(ABORT, 'plan is not proposed');
  END;
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

const TEST_USER: SessionUser = {
  id: 'user-1',
  email: 'owner@example.test',
  name: 'Test Owner',
};

type App = Hono<{ Variables: AuthVars }>;

const setup = (
  collection: { readonly id?: string; readonly ownerId?: string } = {},
): { db: Drizzle; env: { DB: D1Database }; app: App } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  db.insert(schema.collections)
    .values({
      id: collection.id ?? 'collection-1',
      ownerId: collection.ownerId ?? 'user-1',
      title: 'Test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();

  const app = new Hono<{ Variables: AuthVars }>();
  // Stub `requireUser` so the route layer sees a session without booting BA.
  app.use('/api/*', async (c, next) => {
    c.set('user', TEST_USER);
    await next();
  });
  app.route('/api/plan', planRoute);
  return { db, env: { DB: { __sqlite: sqlite } as unknown as D1Database }, app };
};

const post = (app: App, path: string, body: unknown, env: { DB: D1Database }) =>
  app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );

const get = (app: App, path: string, env: { DB: D1Database }) =>
  app.request(path, { method: 'GET' }, env);

const readJson = async <T>(res: Response): Promise<T> => await res.json();

const insertPlan = (
  db: Drizzle,
  args: {
    readonly id: string;
    readonly collectionId: string;
    readonly plan?: CollectionPlan;
  },
): void => {
  db.insert(schema.collectionPlans)
    .values({
      id: args.id,
      collectionId: args.collectionId,
      prompt: args.plan?.prompt ?? 'track CHF/USD',
      proposed: JSON.stringify(
        args.plan ?? {
          prompt: 'track CHF/USD',
          signals: [
            {
              template_id: 'fx-pair',
              display_name: 'FX pair',
              config: { base: 'CHF', quote: 'USD' },
              missing: [],
              refresh_seconds: 900,
              rights_status: 'public',
              source_label: 'Frankfurter (ECB)',
            },
          ],
          unmatched: [],
        },
      ) as unknown as schema.ProposedPlan,
      status: 'proposed',
      createdAt: new Date(0),
    })
    .run();
};

const insertCollection = (
  db: Drizzle,
  args: {
    readonly id: string;
    readonly ownerId?: string;
    readonly title?: string;
  },
): void => {
  db.insert(schema.collections)
    .values({
      id: args.id,
      ownerId: args.ownerId ?? TEST_USER.id,
      title: args.title ?? args.id,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

describe('plan routes', () => {
  let db: Drizzle;
  let env: { DB: D1Database };
  let app: App;

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    app = s.app;
  });

  it('POST / creates a plan tied to the caller collection', async () => {
    const res = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-1');
    expect(body.plan.signals).toHaveLength(1);
    expect(body.plan.signals[0]?.template_id).toBe('fx-pair');
  });

  it('POST / can create a plan for an explicitly selected owned collection', async () => {
    insertCollection(db, { id: 'collection-2', title: 'Second' });

    const res = await post(
      app,
      '/api/plan',
      { prompt: 'track CHF/USD', collection_id: 'collection-2' },
      env,
    );

    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-2');
  });

  it('POST / rejects explicit collections not owned by the caller', async () => {
    insertCollection(db, { id: 'someone-elses-dash', ownerId: 'someone-else' });

    const res = await post(
      app,
      '/api/plan',
      { prompt: 'track CHF/USD', collection_id: 'someone-elses-dash' },
      env,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('POST / lazy-creates a collection for callers who have none', async () => {
    // The BA auth hook normally provisions a collection on first sign-in, but
    // the BYPASS_AUTH e2e path skips the hook entirely. The route guarantees
    // a collection exists by calling ensureUserCollection on demand instead of
    // returning 409 — that way new users + test paths both succeed.
    const s = setup({ id: 'seed-collection', ownerId: 'other-user' });

    const res = await post(s.app, '/api/plan', { prompt: 'track CHF/USD' }, s.env);
    expect(res.status).toBe(200);
    const body: { collection_id: string } = await res.json();
    expect(body.collection_id).not.toBe('seed-collection');

    // The new collection belongs to TEST_USER, not to other-user's seed row.
    const owned = s.db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, TEST_USER.id))
      .all();
    expect(owned).toHaveLength(1);
    expect(owned[0]?.id).toBe(body.collection_id);
  });

  it('POST / writes to the caller collection, not to another tenant', async () => {
    // Seed a second collection owned by a different user. The route must pick
    // the caller's collection, not "any" collection.
    const s = setup();
    s.db
      .insert(schema.collections)
      .values({
        id: 'someone-elses-dash',
        ownerId: 'someone-else',
        title: 'Other',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const res = await post(s.app, '/api/plan', { prompt: 'track CHF/USD' }, s.env);
    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-1');
  });

  it('POST /:id/confirm materialises signals', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    const plan = await readJson<PlanRecord>(planRes);

    const res = await post(app, `/api/plan/${plan.id}/confirm`, {}, env);
    expect(res.status).toBe(200);
    const body = await readJson<{ created_signal_ids: string[] }>(res);
    expect(body.created_signal_ids).toHaveLength(1);

    const signals = db.select().from(schema.signals).all();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.collectionId).toBe('collection-1');
  });

  it('POST /:id/confirm materialises selected-collection plans on that collection', async () => {
    insertCollection(db, { id: 'collection-2', title: 'Second' });
    const planRes = await post(
      app,
      '/api/plan',
      { prompt: 'track CHF/USD', collection_id: 'collection-2' },
      env,
    );
    const plan = await readJson<PlanRecord>(planRes);

    const res = await post(app, `/api/plan/${plan.id}/confirm`, {}, env);

    expect(res.status).toBe(200);
    const signals = db.select().from(schema.signals).all();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.collectionId).toBe('collection-2');
  });

  it('POST /:id/confirm accepts edited config patches only', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'currency' }, env);
    const plan = await readJson<PlanRecord>(planRes);

    const res = await post(
      app,
      `/api/plan/${plan.id}/confirm`,
      {
        edited_signals: [
          {
            config: { base: 'GBP', quote: 'USD', url: 'https://example.test/private' },
          },
        ],
      },
      env,
    );

    expect(res.status).toBe(200);
    const [signal] = db.select().from(schema.signals).all();
    expect(signal?.templateId).toBe('fx-pair');
    expect(signal?.title).toBe('FX pair');
    expect(signal?.refreshSeconds).toBe(900);
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'GBP', quote: 'USD' });
  });

  it('POST /:id/confirm rejects client-submitted authority fields', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'currency' }, env);
    const plan = await readJson<PlanRecord>(planRes);
    const proposed = plan.plan.signals[0];
    if (!proposed) throw new Error('expected proposed signal');

    const res = await post(
      app,
      `/api/plan/${plan.id}/confirm`,
      {
        edited_signals: [
          {
            ...proposed,
            template_id: 'rest-metric',
            refresh_seconds: 1,
            source_label: 'Injected source',
            config: { base: 'GBP', quote: 'USD' },
          },
        ],
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(db.select().from(schema.signals).all()).toEqual([]);
  });

  it('GET /:id returns only plans owned by the caller collection', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    const plan = await readJson<PlanRecord>(planRes);
    const ownRes = await get(app, `/api/plan/${plan.id}`, env);
    expect(ownRes.status).toBe(200);

    db.insert(schema.collections)
      .values({
        id: 'someone-elses-dash',
        ownerId: 'someone-else',
        title: 'Other',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    insertPlan(db, { id: 'other-plan', collectionId: 'someone-elses-dash' });

    const otherRes = await get(app, '/api/plan/other-plan', env);
    expect(otherRes.status).toBe(404);
  });

  it('GET /:id returns owned plans outside the primary collection', async () => {
    insertCollection(db, { id: 'collection-2', title: 'Second' });
    insertPlan(db, { id: 'second-plan', collectionId: 'collection-2' });

    const res = await get(app, '/api/plan/second-plan', env);

    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-2');
  });

  it('POST /:id/confirm cannot materialise another collection plan', async () => {
    db.insert(schema.collections)
      .values({
        id: 'someone-elses-dash',
        ownerId: 'someone-else',
        title: 'Other',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    insertPlan(db, { id: 'other-plan', collectionId: 'someone-elses-dash' });

    const res = await post(app, '/api/plan/other-plan/confirm', {}, env);
    expect(res.status).toBe(404);
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });

  it('POST /:id/reject flips status to rejected', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    const plan = await readJson<PlanRecord>(planRes);

    const res = await post(app, `/api/plan/${plan.id}/reject`, {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [row] = db
      .select()
      .from(schema.collectionPlans)
      .where(eq(schema.collectionPlans.id, plan.id))
      .all();
    expect(row?.status).toBe('rejected');
  });

  it('POST /:id/reject cannot reject another collection plan', async () => {
    db.insert(schema.collections)
      .values({
        id: 'someone-elses-dash',
        ownerId: 'someone-else',
        title: 'Other',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    insertPlan(db, { id: 'other-plan', collectionId: 'someone-elses-dash' });

    const res = await post(app, '/api/plan/other-plan/reject', {}, env);
    expect(res.status).toBe(404);

    const [row] = db
      .select()
      .from(schema.collectionPlans)
      .where(eq(schema.collectionPlans.id, 'other-plan'))
      .all();
    expect(row?.status).toBe('proposed');
  });

  it('POST / rejects an empty prompt with 400', async () => {
    const res = await post(app, '/api/plan', { prompt: '' }, env);
    expect(res.status).toBe(400);
  });
});
