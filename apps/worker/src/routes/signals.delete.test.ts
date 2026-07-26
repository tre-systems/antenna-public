import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, seedBaseline, seedOtherTenant, setup } from './signals-test-fixtures';
import { SEED_TEMPLATE_COLLECTION_ID } from '../auth/ensure-user-collection';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('DELETE /api/signals/:id', () => {
  it('deletes an owned signal and its child rows', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    db.insert(schema.signalPoints)
      .values({
        signalId: 'b1',
        fetchedAt: new Date(1_700_000_000_000),
        observedAt: new Date(1_700_000_000_000),
        metricKey: 'pair=EUR/USD',
        dimensions: JSON.stringify({ pair: 'EUR/USD' }) as unknown as schema.DataPointDimensions,
        value: 1.09,
        unit: 'USD',
      })
      .run();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'live',
        lastOkAt: new Date(1_000),
        updatedAt: new Date(1_000),
      })
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b1', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(db.select().from(schema.signals).where(eq(schema.signals.id, 'b1')).all()).toEqual([]);
    expect(
      db.select().from(schema.signalPoints).where(eq(schema.signalPoints.signalId, 'b1')).all(),
    ).toEqual([]);
    expect(
      db.select().from(schema.signalStatus).where(eq(schema.signalStatus.signalId, 'b1')).all(),
    ).toEqual([]);
  });

  it('records dismissed starter signals so seed sync does not resurrect them', async () => {
    const { db, env } = setup();
    db.insert(schema.collections)
      .values([
        {
          id: SEED_TEMPLATE_COLLECTION_ID,
          ownerId: 'seed-owner',
          title: 'Seed',
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        {
          id: 'collection-1',
          ownerId: OWNER_1.id,
          title: 'Test',
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ])
      .run();
    const config = JSON.stringify({ base: 'EUR', quote: 'USD' });
    db.insert(schema.signals)
      .values([
        {
          id: 'seed-fx',
          collectionId: SEED_TEMPLATE_COLLECTION_ID,
          templateId: 'fx-pair',
          title: 'EUR/USD',
          config: config as unknown as schema.SignalConfig,
          refreshSeconds: 900,
          position: 0,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        {
          id: 'b1',
          collectionId: 'collection-1',
          templateId: 'fx-pair',
          title: 'EUR/USD',
          config: config as unknown as schema.SignalConfig,
          refreshSeconds: 900,
          position: 0,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ])
      .run();

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b1', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    expect(db.select().from(schema.dismissedStarterSignals).all()).toMatchObject([
      {
        collectionId: 'collection-1',
        signalSignature: `fx-pair|${config}`,
      },
    ]);
  });

  it('returns 404 and deletes nothing when the signal belongs to another user', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    seedOtherTenant(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/b2', { method: 'DELETE' }, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(db.select().from(schema.signals).where(eq(schema.signals.id, 'b2')).all()).toHaveLength(
      1,
    );
  });

  it('returns 404 for an unknown signal id', async () => {
    const { db, env } = setup();
    seedBaseline(db);

    const app = buildApp(OWNER_1);
    const res = await app.request('/api/signals/does-not-exist', { method: 'DELETE' }, env);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
