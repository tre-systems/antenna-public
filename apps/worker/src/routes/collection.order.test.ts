import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_2, seedCollection, seedSignal, setup } from './collection-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/collection/signals/order', () => {
  it('reorders all signals owned by the caller collection', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, 'b1', 'collection-1');
    seedSignal(db, 'b2', 'collection-1');
    seedSignal(db, 'b3', 'collection-1');
    const app = buildApp();

    const res = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b3', 'b1', 'b2'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      updated: true,
      ordered_signal_ids: ['b3', 'b1', 'b2'],
    });
    const rows = db
      .select({ id: schema.signals.id, position: schema.signals.position })
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'collection-1'))
      .orderBy(schema.signals.position)
      .all();
    expect(rows).toEqual([
      { id: 'b3', position: 0 },
      { id: 'b1', position: 1 },
      { id: 'b2', position: 2 },
    ]);
  });

  it('rejects missing, duplicate, unknown, and cross-owner signal ids without changing positions', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedSignal(db, 'b1', 'collection-1');
    seedSignal(db, 'b2', 'collection-1');
    seedCollection(db, OWNER_2);
    seedSignal(db, 'b3', 'collection-2');
    const app = buildApp();

    const missing = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b2'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const duplicate = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b1'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );
    const otherTenant = await app.request(
      '/api/collection/signals/order',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b3'] }),
        headers: { 'content-type': 'application/json' },
      },
      env,
    );

    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'invalid_order_signals' });
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ error: 'invalid_body' });
    expect(otherTenant.status).toBe(400);
    expect(await otherTenant.json()).toEqual({ error: 'invalid_order_signals' });

    const rows = db
      .select({ id: schema.signals.id, position: schema.signals.position })
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'collection-1'))
      .orderBy(schema.signals.id)
      .all();
    expect(rows).toEqual([
      { id: 'b1', position: 0 },
      { id: 'b2', position: 0 },
    ]);
  });
});
