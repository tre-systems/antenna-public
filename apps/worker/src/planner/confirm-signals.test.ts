import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { setupPlannerDb, type Drizzle, type Sqlite } from './plan-test-fixtures';
import { createPlan } from './plan';
import { confirmPlan } from './execute';

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

// Exercised through confirmPlan: what a client may influence, and what the
// registry re-resolves regardless, is only observable in the written row.
describe('confirmed signal materialisation', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    const s = setupPlannerDb();
    db = s.db;
    env = s.env;
  });

  const shareCollection = () => {
    db.update(schema.collections)
      .set({ visibility: 'shared' })
      .where(eq(schema.collections.id, 'collection-1'))
      .run();
  };

  it('defaults newly confirmed signals to the collection visibility', async () => {
    shareCollection();
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
    shareCollection();
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

    expect(result.ok).toBe(true);
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

    const result = await confirmPlan(env, {
      plan_id: record.id,
      collection_id: 'collection-1',
      edited_signals: [
        {
          ...proposed,
          config: { base: 'GB', quote: 'USD' },
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid_config: fx-pair/);
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
