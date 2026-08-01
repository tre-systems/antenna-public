import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import type * as ConnectorsModule from '@antenna/connectors';
import * as schema from '../db/schema';
import { setupPlannerDb, type Drizzle, type Sqlite } from './plan-test-fixtures';
import { createPlan } from './plan';
import { confirmPlan } from './execute';

// confirmPlan returns a result union; success-path assertions want the ids.
const confirmOk = async (
  ...args: Parameters<typeof confirmPlan>
): Promise<{ created_signal_ids: string[] }> => {
  const result = await confirmPlan(...args);
  if (!result.ok) throw new Error(`expected confirm to succeed, got ${result.error}`);
  return { created_signal_ids: result.created_signal_ids };
};

const geocodeMock = vi.hoisted(() => vi.fn());

vi.mock('@antenna/connectors', async (importOriginal) => {
  const actual = await importOriginal<typeof ConnectorsModule>();
  return { ...actual, geocode: geocodeMock };
});

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

describe('confirmPlan', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    geocodeMock.mockReset();
    geocodeMock.mockResolvedValue(null);
    const s = setupPlannerDb();
    db = s.db;
    env = s.env;
  });

  it('creates signals + signal_status rows and marks the plan confirmed', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    const result = await confirmOk(env, { plan_id: record.id, collection_id: 'collection-1' });
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

    const result = await confirmOk(env, { plan_id: record.id, collection_id: 'collection-1' });

    expect(result.created_signal_ids).toHaveLength(1);
    expect(batch).toHaveBeenCalledTimes(1);
    // The claim must precede signal writes.
    expect(prepared.map((statement) => statement.sql)).toEqual([
      'INSERT INTO plan_confirmation_claims (plan_id, claimed_at) VALUES (?, ?)',
      expect.stringContaining('INSERT INTO signals'),
      'INSERT INTO signal_status (signal_id, status, updated_at) VALUES (?, ?, ?)',
      'UPDATE collection_plans SET status = ?, resolved_at = ? WHERE id = ?',
    ]);
    expect(prepared[0]?.params[0]).toBe(record.id);
    expect(prepared[1]?.params[2]).toBe('fx-pair');
    expect(prepared[2]?.params[1]).toBe('loading');
    expect(prepared[3]?.params).toEqual(['confirmed', expect.any(Number), record.id]);
  });

  it('lets unexpected D1 failures reach the invocation boundary', async () => {
    env = {
      DB: {
        ...(env.DB as object),
        prepare: (sql: string) => ({ bind: (...params: unknown[]) => ({ sql, params }) }),
        batch: vi.fn().mockRejectedValue(new Error('D1 unavailable')),
      } as unknown as D1Database,
    };
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    await expect(
      confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' }),
    ).rejects.toThrow('D1 unavailable');
  });

  it('confirms weather plans once demo-city lat/lon have been resolved', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'weather in Madrid',
      requested_by: 'user-1',
    });
    expect(record.plan.signals[0]?.missing).toEqual([]);

    const result = await confirmOk(env, { plan_id: record.id, collection_id: 'collection-1' });
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

  it('confirms air quality plans once demo-city lat/lon have been resolved', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'air quality in Madrid',
      requested_by: 'user-1',
    });
    expect(record.plan.signals[0]?.missing).toEqual([]);

    const result = await confirmOk(env, { plan_id: record.id, collection_id: 'collection-1' });
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

  it('skips signals with missing params for unknown weather locations', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'weather in Atlantis',
      requested_by: 'user-1',
    });
    const result = await confirmOk(env, { plan_id: record.id, collection_id: 'collection-1' });
    expect(result.created_signal_ids).toEqual([]);
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });

  it('materialises a plan once when two confirmations race it', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    // Both start before either resolves the plan, so both see it as proposed.
    const [first, second] = await Promise.all([
      confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' }),
      confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' }),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(db.select().from(schema.signals).all()).toHaveLength(1);
    expect(db.select().from(schema.planConfirmationClaims).all()).toHaveLength(1);
  });

  it('refuses a plan that has already been resolved', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    await confirmPlan(env, { plan_id: record.id, collection_id: 'collection-1' });
    const result = await confirmPlan(env, {
      plan_id: record.id,
      collection_id: 'collection-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('plan_already_resolved');
  });

  it('refuses a plan confirmed through a different collection', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    const result = await confirmPlan(env, { plan_id: record.id, collection_id: 'other-dash' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_found');
    expect(db.select().from(schema.signals).all()).toHaveLength(0);
  });
});
