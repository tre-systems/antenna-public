import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import type { SessionUser } from '../auth/middleware';
import {
  buildApp,
  OWNER_1,
  OWNER_2,
  seedBaseline,
  seedOtherTenant,
  setup,
  type Drizzle,
} from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/signals scoping', () => {
  let db: Drizzle;
  let env: { DB: D1Database };

  beforeEach(() => {
    const s = setup();
    db = s.db;
    env = s.env;
    seedBaseline(db);
  });

  it('returns only signals owned by the caller', async () => {
    seedOtherTenant(db);

    const a = buildApp(OWNER_1);
    const resA = await a.request('/api/signals', undefined, env);
    const bodyA: Array<{ id: string }> = await resA.json();
    expect(bodyA.map((b) => b.id)).toEqual(['b1']);

    const b = buildApp(OWNER_2);
    const resB = await b.request('/api/signals', undefined, env);
    const bodyB: Array<{ id: string }> = await resB.json();
    expect(bodyB.map((b) => b.id)).toEqual(['b2']);
  });

  it('can scope a listing to one owned collection id', async () => {
    seedOtherTenant(db);
    db.insert(schema.collections)
      .values({
        id: 'collection-extra',
        ownerId: OWNER_1.id,
        title: 'Extra',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.signals)
      .values({
        id: 'b-extra',
        collectionId: 'collection-extra',
        templateId: 'fx-pair',
        title: 'CHF/USD',
        config: JSON.stringify({ base: 'CHF', quote: 'USD' }) as unknown as schema.SignalConfig,
        refreshSeconds: 900,
        position: 0,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals?collection_id=collection-extra', undefined, env);
    expect(res.status).toBe(200);
    const body: Array<{ id: string }> = await res.json();
    expect(body.map((b) => b.id)).toEqual(['b-extra']);
  });

  it('rejects an empty collection id filter', async () => {
    const app = buildApp();
    const res = await app.request('/api/signals?collection_id=', undefined, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_query' });
  });

  it('returns an empty array for a user with no collections', async () => {
    const stranger: SessionUser = { id: 'noone', email: 'noone@test', name: 'No One' };
    const app = buildApp(stranger);
    const res = await app.request('/api/signals', undefined, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
