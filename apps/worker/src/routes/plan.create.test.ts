import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import {
  insertCollection,
  insertOtherTenantCollection,
  post,
  readJson,
  setup,
  TEST_USER,
  type App,
  type Drizzle,
} from './plan-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('POST /api/plan', () => {
  let db: Drizzle;
  let env: { DB: D1Database };
  let app: App;

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    app = s.app;
  });

  it('creates a plan tied to the caller collection', async () => {
    const res = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-1');
    expect(body.plan.signals).toHaveLength(1);
    expect(body.plan.signals[0]?.template_id).toBe('fx-pair');
  });

  it('can create a plan for an explicitly selected owned collection', async () => {
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

  it('rejects explicit collections not owned by the caller', async () => {
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

  it('lazy-creates a collection for callers who have none', async () => {
    // The BA auth hook normally provisions a collection on first sign-in, but
    // the BYPASS_AUTH e2e path skips the hook entirely. The route guarantees
    // a collection exists by calling ensureUserCollection on demand instead of
    // returning 409 — that way new users + test paths both succeed.
    const s = setup({ id: 'seed-collection', ownerId: 'other-user' });

    const res = await post(s.app, '/api/plan', { prompt: 'track CHF/USD' }, s.env);
    expect(res.status).toBe(200);
    const body: { collection_id: string } = await res.json();
    expect(body.collection_id).not.toBe('seed-collection');

    const owned = s.db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, TEST_USER.id))
      .all();
    expect(owned).toHaveLength(1);
    expect(owned[0]?.id).toBe(body.collection_id);
  });

  it('writes to the caller collection, not to another tenant', async () => {
    // Seed a second collection owned by a different user. The route must pick
    // the caller's collection, not "any" collection.
    const s = setup();
    insertOtherTenantCollection(s.db);

    const res = await post(s.app, '/api/plan', { prompt: 'track CHF/USD' }, s.env);
    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-1');
  });

  it('rejects an empty prompt with 400', async () => {
    const res = await post(app, '/api/plan', { prompt: '' }, env);
    expect(res.status).toBe(400);
  });
});
