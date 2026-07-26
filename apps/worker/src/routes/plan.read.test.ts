import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanRecord } from '@antenna/shared';
import {
  get,
  insertCollection,
  insertOtherTenantCollection,
  insertPlan,
  post,
  readJson,
  setup,
  type App,
  type Drizzle,
} from './plan-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/plan/:id', () => {
  let db: Drizzle;
  let env: { DB: D1Database };
  let app: App;

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    app = s.app;
  });

  it('returns only plans owned by the caller collection', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    const plan = await readJson<PlanRecord>(planRes);
    const ownRes = await get(app, `/api/plan/${plan.id}`, env);
    expect(ownRes.status).toBe(200);

    insertOtherTenantCollection(db);
    insertPlan(db, { id: 'other-plan', collectionId: 'someone-elses-dash' });

    const otherRes = await get(app, '/api/plan/other-plan', env);
    expect(otherRes.status).toBe(404);
  });

  it('returns owned plans outside the primary collection', async () => {
    insertCollection(db, { id: 'collection-2', title: 'Second' });
    insertPlan(db, { id: 'second-plan', collectionId: 'collection-2' });

    const res = await get(app, '/api/plan/second-plan', env);

    expect(res.status).toBe(200);
    const body = await readJson<PlanRecord>(res);
    expect(body.collection_id).toBe('collection-2');
  });
});
