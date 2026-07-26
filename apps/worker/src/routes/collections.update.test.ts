import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import { buildApp, seedOwnedCollection, seedOwnedSignal, setup } from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('PATCH /api/collections/:id', () => {
  it('updates an owned collection and validates layout signal ownership', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'collection-1',
      title: 'Main',
      description: null,
      updatedAt: 1_000,
    });
    seedOwnedSignal(db, { id: 'b1', collectionId: 'collection-1', position: 0 });
    seedOwnedSignal(db, { id: 'b2', collectionId: 'collection-1', position: 1 });

    const res = await buildApp().request(
      '/api/collections/collection-1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Renamed',
          description: 'Updated description',
          visibility: 'public',
          layout: {
            version: 1,
            slots: [
              { signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 },
              { signal_id: 'b2', x: 4, y: 0, w: 4, h: 3 },
            ],
          },
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      id: 'collection-1',
      title: 'Renamed',
      description: 'Updated description',
      visibility: 'public',
    });
    expect(body.slug).toMatch(/^[a-f0-9]{32}$/);
    expect(body.layout?.slots.map((slot) => slot.signal_id)).toEqual(['b1', 'b2']);

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, 'collection-1'))
      .all();
    expect(row).toMatchObject({
      title: 'Renamed',
      description: 'Updated description',
      visibility: 'public',
      slug: body.slug,
    });
  });

  it('rejects missing, cross-owner, and invalid layout updates', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'own', title: 'Own', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 2_000,
    });

    const missing = await buildApp().request(
      '/api/collections/missing',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Nope' }),
      },
      env,
    );
    const other = await buildApp().request(
      '/api/collections/other',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Nope' }),
      },
      env,
    );
    const invalidLayout = await buildApp().request(
      '/api/collections/own',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          layout: { version: 1, slots: [{ signal_id: 'missing', x: 0, y: 0, w: 4, h: 3 }] },
        }),
      },
      env,
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(other.status).toBe(404);
    expect(await other.json()).toEqual({ error: 'not_found' });
    expect(invalidLayout.status).toBe(400);
    expect(await invalidLayout.json()).toEqual({ error: 'invalid_layout_signals' });
  });
});
