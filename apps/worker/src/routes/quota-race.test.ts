import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, seedOwnedCollection, seedOwnedSignal, setup } from './collections-test-fixtures';
import { setup as setupPlan, insertPlan, post } from './plan-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());
const installGuard = (binding: D1Database) => {
  const { __sqlite: sqlite } = binding as unknown as { __sqlite: Database.Database };
  sqlite.exec(
    readFileSync(
      fileURLToPath(String(new URL('../../drizzle/0005_atomic_quotas.sql', import.meta.url))),
      'utf8',
    ),
  );
};

describe('concurrent quota enforcement', () => {
  it('allows only one of two collection creates competing for the last slot', async () => {
    const { db, env } = setup();
    installGuard(env.DB);
    for (let i = 0; i < 9; i += 1)
      seedOwnedCollection(db, { id: String(i), title: 'Existing', updatedAt: 0 });
    const app = buildApp();
    const responses = await Promise.all(
      [0, 1].map(async () =>
        app.request(
          '/api/collections',
          {
            method: 'POST',
            body: JSON.stringify({ title: 'Concurrent' }),
          },
          env,
        ),
      ),
    );
    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(db.select().from(schema.collections).all()).toHaveLength(10);
    const rejected = responses.find((res) => res.status === 409);
    expect(await rejected?.json()).toMatchObject({ error: 'collection_quota_exceeded' });
  });
  it('allows only one of two different plans competing for the last signal slot', async () => {
    const { db, env, app } = setupPlan();
    installGuard(env.DB);
    for (let i = 0; i < 49; i += 1)
      seedOwnedSignal(db, { id: String(i), collectionId: 'collection-1', position: i });
    for (const id of ['a', 'b']) insertPlan(db, { id, collectionId: 'collection-1' });
    const responses = await Promise.all(
      ['a', 'b'].map(async (id) => post(app, `/api/plan/${id}/confirm`, {}, env)),
    );
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(db.select().from(schema.signals).all()).toHaveLength(50);
    expect(db.select().from(schema.planConfirmationClaims).all()).toHaveLength(1);
    expect(
      db
        .select()
        .from(schema.collectionPlans)
        .all()
        .filter((row) => row.status === 'proposed'),
    ).toHaveLength(1);
    const rejected = responses.find((res) => res.status === 409);
    expect(await rejected?.json()).toEqual({ error: 'signal_quota_exceeded' });
  });
});
