import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionDetailResponse } from '@antenna/shared';
import * as schema from '../db/schema';
import {
  buildApp,
  seedOwnedCollection,
  seedOwnedSignal,
  setup,
  USER,
  type Drizzle,
} from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

const seedSignalSnapshot = (db: Drizzle, signalId: string): void => {
  db.insert(schema.signalPoints)
    .values({
      signalId,
      fetchedAt: new Date(2_000),
      observedAt: new Date(2_000),
      metricKey: 'latest',
      value: 1.08,
      unit: 'USD',
      sourceUrl: 'https://example.com/fx',
    })
    .run();
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: new Date(2_000),
      updatedAt: new Date(3_000),
    })
    .run();
};

describe('GET /api/collections/:id', () => {
  it('returns an owned collection with signals in position order', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'collection-1',
      title: 'Main',
      description: 'Primary collection',
      updatedAt: 5_000,
    });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'collection-1', position: 1 });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'collection-1', position: 0 });
    seedSignalSnapshot(db, 'b1');

    const res = await buildApp().request('/api/collections/collection-1', undefined, env);

    expect(res.status).toBe(200);
    const body: CollectionDetailResponse = await res.json();
    expect(body.collection).toMatchObject({
      id: 'collection-1',
      title: 'Main',
      description: 'Primary collection',
      visibility: 'private',
      slug: null,
      layout: null,
      updated_at: 5_000,
      last_seen_at: null,
    });
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.userId).toBe(USER.id);
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(0);
    expect(body.signals.map((signal) => signal.id)).toEqual(['b1', 'b2']);
    expect(body.signals[0]).toMatchObject({
      id: 'b1',
      template_id: 'fx-pair',
      config: { base: 'EUR', quote: 'USD' },
      refresh_seconds: 900,
      status: {
        status: 'live',
        last_ok_at: 2_000,
        last_attempt_at: 3_000,
      },
    });
    expect(body.signals[0]?.points[0]).toMatchObject({
      value: 1.08,
      unit: 'USD',
      source_url: 'https://example.com/fx',
    });
    expect(body.signals[1]?.points).toEqual([]);
  });

  it('returns the previous visit marker before updating collection detail visits', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'collection-1',
      title: 'Main',
      updatedAt: 5_000,
    });
    db.insert(schema.userCollectionVisits)
      .values({
        userId: USER.id,
        collectionId: 'collection-1',
        lastSeenAt: new Date(2_468),
      })
      .run();

    const res = await buildApp().request('/api/collections/collection-1', undefined, env);

    expect(res.status).toBe(200);
    const body: CollectionDetailResponse = await res.json();
    expect(body.collection.last_seen_at).toBe(2_468);
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(2_468);
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

    const missing = await buildApp().request('/api/collections/missing', undefined, env);
    const other = await buildApp().request('/api/collections/other', undefined, env);

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
  });
});
