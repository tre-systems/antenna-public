import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import type * as ConnectorsModule from '@antenna/connectors';
import * as schema from '../db/schema';
import { setupPlannerDb, type Drizzle, type Sqlite } from './plan-test-fixtures';
import { createPlan, getPlan, parsePlan, rejectPlan } from './plan';

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

describe('createPlan', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    geocodeMock.mockReset();
    geocodeMock.mockResolvedValue(null);
    const s = setupPlannerDb();
    db = s.db;
    env = s.env;
  });

  it('persists a collection_plans row with the matched plan', async () => {
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    expect(record.status).toBe('proposed');
    expect(record.plan.signals).toHaveLength(1);
    expect(record.plan.signals[0]?.template_id).toBe('fx-pair');

    const rows = db
      .select()
      .from(schema.collectionPlans)
      .where(eq(schema.collectionPlans.id, record.id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('proposed');
  });

  it('creates a connector_requests row per unmatched fragment', async () => {
    await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'silver futures every hour',
      requested_by: 'user-1',
    });
    const rows = db.select().from(schema.connectorRequests).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.prompt).toBe('silver futures every hour');
    expect(rows[0]?.requestedBy).toBe('user-1');
    expect(rows[0]?.status).toBe('requested');
  });

  it('writes nothing to connector_requests when every fragment matched', async () => {
    await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });
    const rows = db.select().from(schema.connectorRequests).all();
    expect(rows).toHaveLength(0);
  });
});

describe('getPlan / rejectPlan', () => {
  it('round-trips through getPlan and updates status on reject', async () => {
    const { env } = setupPlannerDb();
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    const fetched = await getPlan(env, record.id, 'collection-1');
    expect(fetched?.id).toBe(record.id);
    expect(fetched?.plan.signals).toHaveLength(1);

    await rejectPlan(env, record.id, 'collection-1');
    const after = await getPlan(env, record.id, 'collection-1');
    expect(after?.status).toBe('rejected');
  });

  it('does not expose or reject plans from another collection', async () => {
    const { env } = setupPlannerDb();
    const record = await createPlan(env, {
      collection_id: 'collection-1',
      prompt: 'track CHF/USD',
      requested_by: 'user-1',
    });

    await expect(getPlan(env, record.id, 'other-dash')).resolves.toBeUndefined();
    await expect(rejectPlan(env, record.id, 'other-dash')).resolves.toBe(false);

    const visible = await getPlan(env, record.id, 'collection-1');
    expect(visible?.status).toBe('proposed');
  });
});

describe('parsePlan', () => {
  it('falls back to an empty plan for malformed persisted JSON', () => {
    expect(parsePlan('{not json', 'track something')).toEqual({
      prompt: 'track something',
      signals: [],
      unmatched: [],
    });
  });

  it('falls back to an empty plan for invalid persisted shape', () => {
    expect(
      parsePlan({ prompt: 'track something', signals: [{ template_id: '' }] }, 'track something'),
    ).toEqual({
      prompt: 'track something',
      signals: [],
      unmatched: [],
    });
  });
});
