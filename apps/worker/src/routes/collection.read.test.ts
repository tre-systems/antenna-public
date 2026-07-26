import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { buildApp, OWNER_1, OWNER_2, seedCollection, setup } from './collection-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/collection', () => {
  it('returns the caller collection metadata and layout', async () => {
    const { db, env } = setup();
    seedCollection(db);
    seedCollection(db, OWNER_2);

    const res = await buildApp().request('/api/collection', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'collection-1',
      title: 'Antenna',
      description: 'Initial description',
      visibility: 'private',
      slug: null,
      layout: { version: 1, slots: [{ signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 }] },
      updated_at: 0,
      last_seen_at: null,
    });
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.userId).toBe(OWNER_1.id);
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(0);
  });

  it('returns the previous last seen timestamp before updating the visit marker', async () => {
    const { db, env } = setup();
    seedCollection(db);
    db.insert(schema.userCollectionVisits)
      .values({
        userId: OWNER_1.id,
        collectionId: 'collection-1',
        lastSeenAt: new Date(1_234),
      })
      .run();

    const res = await buildApp().request('/api/collection', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'collection-1', last_seen_at: 1_234 });
    const [visit] = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(visit?.lastSeenAt.getTime()).toBeGreaterThan(1_234);
  });

  it('handles concurrent first visits to the same collection', async () => {
    const { db, env } = setup();
    seedCollection(db);
    const app = buildApp();

    const responses = await Promise.all([
      app.request('/api/collection', undefined, env),
      app.request('/api/collection', undefined, env),
    ]);

    const visits = db
      .select()
      .from(schema.userCollectionVisits)
      .where(eq(schema.userCollectionVisits.collectionId, 'collection-1'))
      .all();
    expect(responses.map((res) => res.status)).toEqual([200, 200]);
    expect(visits).toHaveLength(1);
    expect(visits[0]?.lastSeenAt.getTime()).toBeGreaterThan(0);
  });

  it('provisions a collection when the auth hook has not already done so', async () => {
    const { db, env } = setup();

    const res = await buildApp().request('/api/collection', undefined, env);

    expect(res.status).toBe(200);
    const body: { id: string; title: string } = await res.json();
    expect(body.title).toBe('Antenna');
    const rows = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, OWNER_1.id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(body.id);
  });
});
