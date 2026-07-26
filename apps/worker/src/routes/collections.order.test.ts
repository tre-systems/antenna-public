import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionSignalOrderRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import { buildApp, seedOwnedCollection, seedOwnedSignal, setup } from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/collections/:id/signals/order', () => {
  it('reorders signals on the requested owned collection', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'collection-1', title: 'Main', updatedAt: 1_000 });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'collection-1', position: 0 });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'collection-1', position: 1 });
    seedOwnedSignal(db, { id: 'b3', collectionId: 'collection-1', position: 2 });

    const res = await buildApp().request(
      '/api/collections/collection-1/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b3', 'b1', 'b2'] }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: CollectionSignalOrderRecord = await res.json();
    expect(body).toEqual({ updated: true, ordered_signal_ids: ['b3', 'b1', 'b2'] });

    const rows = db
      .select({ id: schema.signals.id, position: schema.signals.position })
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, 'collection-1'))
      .all()
      .sort((a, b) => a.position - b.position);
    expect(rows.map((row) => row.id)).toEqual(['b3', 'b1', 'b2']);
  });

  it('rejects missing, cross-owner, and invalid signal order requests', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'own', position: 0 });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'own', position: 1 });
    seedOwnedSignal(db, { id: 'other-b1', collectionId: 'other', position: 0 });

    const missing = await buildApp().request(
      '/api/collections/missing/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b2'] }),
      },
      env,
    );
    const other = await buildApp().request(
      '/api/collections/other/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['other-b1'] }),
      },
      env,
    );
    const invalidOrder = await buildApp().request(
      '/api/collections/own/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'other-b1'] }),
      },
      env,
    );
    const duplicate = await buildApp().request(
      '/api/collections/own/signals/order',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ordered_signal_ids: ['b1', 'b1'] }),
      },
      env,
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
    expect(invalidOrder.status).toBe(400);
    expect(await invalidOrder.json()).toEqual({ error: 'invalid_order_signals' });
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ error: 'invalid_body' });
  });
});
