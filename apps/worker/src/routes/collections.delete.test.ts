import { describe, expect, it, vi } from 'vitest';
import type { CollectionDeleteResponse } from '@antenna/shared';
import * as schema from '../db/schema';
import {
  buildApp,
  seedOwnedCollection,
  seedOwnedSignal,
  seedSignalChildren,
  setup,
} from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('DELETE /api/collections/:id', () => {
  it('deletes an owned collection and its dependent rows', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'keep', title: 'Keep', updatedAt: 2_000 });
    seedOwnedCollection(db, { id: 'delete-me', title: 'Delete', updatedAt: 1_000 });
    seedOwnedSignal(db, { id: 'keep', collectionId: 'keep', position: 0 });
    seedOwnedSignal(db, { id: 'delete', collectionId: 'delete-me', position: 0 });
    seedSignalChildren(db, 'delete-me', 'delete');

    const res = await buildApp().request('/api/collections/delete-me', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    const body: CollectionDeleteResponse = await res.json();
    expect(body).toEqual({ deleted: true, id: 'delete-me' });
    expect(
      db
        .select()
        .from(schema.collections)
        .all()
        .map((row) => row.id),
    ).toEqual(['keep']);
    expect(
      db
        .select()
        .from(schema.signals)
        .all()
        .map((row) => row.id),
    ).toEqual(['keep']);
    expect(db.select().from(schema.signalPoints).all()).toEqual([]);
    expect(db.select().from(schema.signalStatus).all()).toEqual([]);
    expect(db.select().from(schema.signalAlerts).all()).toEqual([]);
    expect(db.select().from(schema.notificationPrefs).all()).toEqual([]);
    expect(db.select().from(schema.notificationDeliveries).all()).toEqual([]);
    expect(db.select().from(schema.dismissedStarterSignals).all()).toEqual([]);
    expect(db.select().from(schema.collectionPlans).all()).toEqual([]);
    expect(db.select().from(schema.connectorRequests).all()).toEqual([]);
    expect(db.select().from(schema.publicCollectionReports).all()).toEqual([]);
    expect(db.select().from(schema.userCollectionVisits).all()).toEqual([]);
    expect(db.select().from(schema.collectionTemplatePublications).all()).toEqual([]);
  });

  it('refuses to delete the users final collection', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'only', title: 'Only', updatedAt: 1_000 });

    const res = await buildApp().request('/api/collections/only', { method: 'DELETE' }, env);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'last_collection' });
    expect(db.select().from(schema.collections).all()).toHaveLength(1);
  });

  it('returns 404 for missing or cross-owner collections', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });

    const missing = await buildApp().request('/api/collections/missing', { method: 'DELETE' }, env);
    const other = await buildApp().request('/api/collections/other', { method: 'DELETE' }, env);

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
  });
});
