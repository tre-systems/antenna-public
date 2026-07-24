import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import type * as ConnectorsModule from '@antenna/connectors';
import * as schema from '../db/schema';
import { createPlan } from './plan';
import { confirmPlan } from './execute';

const geocodeMock = vi.hoisted(() => vi.fn());

vi.mock('@antenna/connectors', async (importOriginal) => {
  const actual = await importOriginal<typeof ConnectorsModule>();
  return { ...actual, geocode: geocodeMock };
});

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

const setup = (): { db: Drizzle; env: { DB: D1Database } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: 'user-1',
      title: 'Test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  return { db, env: { DB: { __sqlite: sqlite } as unknown as D1Database } };
};

describe('confirmPlan', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    geocodeMock.mockReset();
    geocodeMock.mockResolvedValue(null);
    const s = setup();
    db = s.db;
    env = s.env;
  });

  it('creates signals + signal_status rows and marks the plan confirmed', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    const result = await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });
    expect(result.created_signal_ids).toHaveLength(1);

    const signals = db.select().from(schema.signals).all();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.templateId).toBe('fx-pair');

    const statuses = db.select().from(schema.signalStatus).all();
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.status).toBe('loading');

    const [planRow] = db
      .select()
      .from(schema.collectionPlans)
      .where(eq(schema.collectionPlans.id, record.id))
      .all();
    expect(planRow?.status).toBe('confirmed');
  });

  it('defaults newly confirmed signals to the collection visibility', async () => {
    db.update(schema.collections)
      .set({ visibility: 'shared' })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });

    const [signal] = db.select().from(schema.signals).all();
    expect(signal?.visibility).toBe('shared');
  });

  it('keeps non-display-eligible sources private inside a shared collection', async () => {
    db.update(schema.collections)
      .set({ visibility: 'shared' })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
    // github-trending is registered but not public-display eligible, so the
    // confirmed signal must fall back to private rather than the confirm
    // being rejected outright.
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'github trending',
      requested_by: 'user-1',
    });

    await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });

    const [signal] = db.select().from(schema.signals).all();
    expect(signal?.templateId).toBe('github-trending');
    expect(signal?.visibility).toBe('private');
  });

  it('uses a D1 batch for signal materialisation and plan confirmation when available', async () => {
    const prepared: Array<{ sql: string; params: unknown[] }> = [];
    const batch = vi.fn().mockResolvedValue([]);
    env = {
      DB: {
        ...(env.DB as object),
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => {
            const statement = { sql, params };
            prepared.push(statement);
            return statement;
          },
        }),
        batch,
      } as unknown as D1Database,
    };
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    const result = await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });

    expect(result.created_signal_ids).toHaveLength(1);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(prepared.map((statement) => statement.sql)).toEqual([
      'INSERT INTO plan_confirmation_claims (plan_id, claimed_at) VALUES (?, ?)',
      expect.stringContaining('INSERT INTO signals'),
      'INSERT INTO signal_status (signal_id, status, updated_at) VALUES (?, ?, ?)',
      expect.stringContaining("WHERE id = ? AND status = 'proposed'"),
    ]);
    expect(prepared[0]?.params).toEqual([record.id, expect.any(Number)]);
    expect(prepared[1]?.params[2]).toBe('fx-pair');
    expect(prepared[2]?.params[1]).toBe('loading');
    expect(prepared[3]?.params).toEqual(['confirmed', expect.any(Number), record.id]);
  });

  it('confirms weather plans once demo-city lat/lon have been resolved', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'weather in Madrid',
      requested_by: 'user-1',
    });
    expect(record.plan.signals[0]?.missing).toEqual([]);

    const result = await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });
    expect(result.created_signal_ids).toHaveLength(1);

    const signals = db.select().from(schema.signals).all();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.templateId).toBe('weather');
    expect(JSON.parse(signals[0]?.config as unknown as string)).toEqual({
      location: 'Madrid',
      lat: 40.4168,
      lon: -3.7038,
    });
  });

  it('skips signals with missing params for unknown weather locations', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'weather in Atlantis',
      requested_by: 'user-1',
    });
    const result = await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });
    expect(result.created_signal_ids).toEqual([]);
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });

  it('confirms air quality plans once demo-city lat/lon have been resolved', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'air quality in Madrid',
      requested_by: 'user-1',
    });
    expect(record.plan.signals[0]?.missing).toEqual([]);

    const result = await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });
    expect(result.created_signal_ids).toHaveLength(1);

    const signals = db.select().from(schema.signals).all();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.templateId).toBe('airquality');
    expect(JSON.parse(signals[0]?.config as unknown as string)).toEqual({
      location: 'Madrid',
      lat: 40.4168,
      lon: -3.7038,
    });
  });

  it('throws when the plan has already been resolved', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });
    await expect(
      confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' }),
    ).rejects.toThrow(/already resolved/);
  });

  it('throws when confirming a plan through a different collection', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    await expect(
      confirmPlan(env, { plan_id: record.id, collection_id: 'other-dash' }),
    ).rejects.toThrow(/plan not found/);
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });

  it('only accepts edited values for missing params and keeps server-owned metadata', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'currency',
      requested_by: 'user-1',
    });
    const proposed = record.plan.signals[0];
    if (!proposed) throw new Error('expected a proposed signal');
    expect(proposed.missing).toEqual(['base', 'quote']);
    const editedSignal = {
      ...proposed,
      template_id: 'rest-metric',
      display_name: 'Injected signal',
      config: {
        base: 'GBP',
        quote: 'USD',
        url: 'https://example.test/private',
      },
      missing: [],
      refresh_seconds: 1,
      rights_status: 'requires-auth' as const,
      source_label: 'Injected source',
    };

    const result = await confirmPlan(env, {
      plan_id: record.id,
      collection_id: 'collection-1',
      edited_signals: [editedSignal],
    });

    expect(result.created_signal_ids).toHaveLength(1);
    const [signal] = db.select().from(schema.signals).all();
    expect(signal?.templateId).toBe('fx-pair');
    expect(signal?.title).toBe('FX pair');
    expect(signal?.refreshSeconds).toBe(900);
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'GBP', quote: 'USD' });
  });

  it('rejects completed configs that do not match the registry schema', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'currency',
      requested_by: 'user-1',
    });
    const proposed = record.plan.signals[0];
    if (!proposed) throw new Error('expected a proposed signal');

    await expect(
      confirmPlan(env, {
        plan_id: record.id,
        collection_id: 'collection-1',
        edited_signals: [
          {
            ...proposed,
            config: { base: 'GB', quote: 'USD' },
          },
        ],
      }),
    ).rejects.toThrow(/invalid_config: fx-pair/);
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });

  it('ignores edited values for params that were not missing', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    const proposed = record.plan.signals[0];
    if (!proposed) throw new Error('expected a proposed signal');

    await confirmPlan(env, {
      plan_id: record.id,
      collection_id: 'collection-1',
      edited_signals: [
        {
          ...proposed,
          config: { base: 'GBP', quote: 'EUR' },
        },
      ],
    });

    const [signal] = db.select().from(schema.signals).all();
    expect(JSON.parse(signal?.config as unknown as string)).toEqual({ base: 'CHF', quote: 'USD' });
  });
});
