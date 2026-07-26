import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { ensureUserCollection, SEED_TEMPLATE_COLLECTION_ID } from './ensure-user-collection';

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

const setup = (): Drizzle => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  return drizzle(sqlite, { schema });
};

// The helper takes the drizzle client directly (it is called from a Better Auth
// hook that already has one), so the test client is handed in cast.
const provision = (db: Drizzle, userId: string, binding?: D1Database): Promise<void> =>
  ensureUserCollection(
    db as unknown as Parameters<typeof ensureUserCollection>[0],
    userId,
    binding,
  );

const insertCollection = (db: Drizzle, id: string, ownerId: string): void => {
  db.insert(schema.collections)
    .values({ id, ownerId, title: id, createdAt: new Date(0), updatedAt: new Date(0) })
    .run();
};

const insertSeedSignal = (db: Drizzle, id: string, templateId: string, position: number): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId: SEED_TEMPLATE_COLLECTION_ID,
      templateId,
      title: id,
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

describe('ensureUserCollection', () => {
  it('provisions a collection for a new user', async () => {
    const db = setup();
    await provision(db, 'u1');
    const rows = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, 'u1'))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Antenna');
  });

  it('is idempotent: running twice yields exactly one row', async () => {
    const db = setup();
    await provision(db, 'u1');
    await provision(db, 'u1');
    const rows = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, 'u1'))
      .all();
    expect(rows).toHaveLength(1);
  });

  it('clones the seed-template signals into the new user collection', async () => {
    const db = setup();
    insertCollection(db, SEED_TEMPLATE_COLLECTION_ID, 'rob');
    insertSeedSignal(db, 'seed-signal-fx', 'fx-pair', 0);
    insertSeedSignal(db, 'seed-signal-crypto', 'crypto-watchlist', 1);

    await provision(db, 'member');

    const memberDash = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, 'member'))
      .all();
    expect(memberDash).toHaveLength(1);
    const memberDashId = memberDash[0]?.id ?? '';
    expect(memberDashId).not.toBe('');

    const memberSignals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, memberDashId))
      .all();
    // Cloned with fresh ids but the same templates / configs / refresh /
    // positions so the second user lands on the same layout as the demo.
    expect(memberSignals).toHaveLength(2);
    expect(memberSignals.map((b) => b.templateId).sort()).toEqual(['crypto-watchlist', 'fx-pair']);
    expect(
      memberSignals.every((b) => b.id !== 'seed-signal-fx' && b.id !== 'seed-signal-crypto'),
    ).toBe(true);
    // The seed template's own rows must be untouched.
    const robSeedSignals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, SEED_TEMPLATE_COLLECTION_ID))
      .all();
    expect(robSeedSignals).toHaveLength(2);
  });

  it('uses a D1 batch for seed signal cloning when available', async () => {
    const db = setup();
    insertCollection(db, SEED_TEMPLATE_COLLECTION_ID, 'rob');
    insertSeedSignal(db, 'seed-signal-fx', 'fx-pair', 0);
    const prepared: Array<{ sql: string; params: unknown[] }> = [];
    const batch = vi.fn().mockResolvedValue([]);
    const binding = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => {
          const statement = { sql, params };
          prepared.push(statement);
          return statement;
        },
      }),
      batch,
    } as unknown as D1Database;

    await provision(db, 'member', binding);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.sql).toContain('INSERT INTO signals');
    expect(prepared[0]?.params[2]).toBe('fx-pair');
    expect(prepared[0]?.params[7]).toBe('private');
  });

  it('does not touch other users collections', async () => {
    const db = setup();
    insertCollection(db, 'other-dash', 'other-user');
    await provision(db, 'u1');
    const all = db.select().from(schema.collections).all();
    expect(all).toHaveLength(2);
    expect(all.find((d) => d.ownerId === 'other-user')?.id).toBe('other-dash');
  });

  it('does not reconcile seed signals into an existing user collection', async () => {
    const db = setup();
    insertCollection(db, SEED_TEMPLATE_COLLECTION_ID, 'seed-owner');
    insertCollection(db, 'user-dash', 'u1');
    insertSeedSignal(db, 'seed-watchlist', 'market-history', 0);

    await provision(db, 'u1');

    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'user-dash'))
      .all();
    expect(signals).toEqual([]);
  });

  it('does not reconcile default connector setup requests into an existing collection', async () => {
    const db = setup();
    insertCollection(db, 'user-dash', 'u1');

    await provision(db, 'u1');

    const requests = db.select().from(schema.connectorRequests).all();
    expect(requests).toEqual([]);
  });

  it('adds default connector setup requests for dogfood collection sources', async () => {
    const db = setup();

    await provision(db, 'u1');

    const requests = db.select().from(schema.connectorRequests).all();
    expect(requests.map((r) => r.prompt)).toEqual(expect.arrayContaining(['https://finviz.com/']));
    expect(requests.some((r) => r.prompt.includes('artificialanalysis.ai'))).toBe(false);
    expect(requests.some((r) => r.prompt.includes('tbench.ai'))).toBe(false);
    expect(requests.some((r) => r.prompt.includes('tradingeconomics.com'))).toBe(false);
  });
});
