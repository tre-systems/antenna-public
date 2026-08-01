import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import {
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

describe('POST /api/plan/:id/confirm', () => {
  let db: Drizzle;
  let env: { DB: D1Database };
  let app: App;

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    app = s.app;
  });

  it('materialises signals', async () => {
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

  it('returns a stable code when a plan is confirmed twice', async () => {
    const planRes = await post(app, '/api/plan', { prompt: 'track CHF/USD' }, env);
    const plan = await readJson<PlanRecord>(planRes);
    expect((await post(app, `/api/plan/${plan.id}/confirm`, {}, env)).status).toBe(200);

    const repeated = await post(app, `/api/plan/${plan.id}/confirm`, {}, env);

    expect(repeated.status).toBe(409);
    expect(await repeated.json()).toEqual({ error: 'plan_already_resolved' });
  });

  it('materialises selected-collection plans on that collection', async () => {
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

  it('accepts edited config patches only', async () => {
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

  it('rejects client-submitted authority fields', async () => {
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

  it('cannot materialise another collection plan', async () => {
    insertOtherTenantCollection(db);
    insertPlan(db, { id: 'other-plan', collectionId: 'someone-elses-dash' });

    const res = await post(app, '/api/plan/other-plan/confirm', {}, env);
    expect(res.status).toBe(404);
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });
});
