import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import {
  insertOtherTenantCollection,
  insertPlan,
  post,
  readJson,
  setup,
  type App,
  type Drizzle,
} from './plan-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('POST /api/plan/:id/reject', () => {
  let db: Drizzle;
  let env: { DB: D1Database };
  let app: App;

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    app = s.app;
  });

  it('flips status to rejected', async () => {
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

  it('cannot reject another collection plan', async () => {
    insertOtherTenantCollection(db);
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
});
