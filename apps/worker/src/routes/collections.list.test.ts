import { describe, expect, it, vi } from 'vitest';
import type { CollectionListResponse } from '@antenna/shared';
import { buildApp, seedOwnedCollection, seedOwnedSignal, setup } from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/collections', () => {
  it('lists the current users collections in updated order with signal counts', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'older',
      title: 'Older collection',
      description: null,
      updatedAt: 1_000,
    });
    seedOwnedCollection(db, {
      id: 'newer',
      title: 'Newer collection',
      description: 'Daily view',
      visibility: 'shared',
      slug: 'newer-slug',
      updatedAt: 3_000,
    });
    seedOwnedCollection(db, {
      id: 'other',
      ownerId: 'other-user',
      title: 'Other user',
      updatedAt: 4_000,
    });
    seedOwnedSignal(db, { id: 'newer-a', collectionId: 'newer', position: 0 });
    seedOwnedSignal(db, { id: 'newer-b', collectionId: 'newer', position: 1 });
    seedOwnedSignal(db, { id: 'older-a', collectionId: 'older', position: 0 });
    seedOwnedSignal(db, { id: 'other-a', collectionId: 'other', position: 0 });

    const res = await buildApp().request('/api/collections', undefined, env);

    expect(res.status).toBe(200);
    const body: CollectionListResponse = await res.json();
    expect(body).toEqual({
      collections: [
        {
          id: 'newer',
          title: 'Newer collection',
          description: 'Daily view',
          visibility: 'shared',
          slug: 'newer-slug',
          updated_at: 3_000,
          signal_count: 2,
        },
        {
          id: 'older',
          title: 'Older collection',
          description: null,
          visibility: 'private',
          slug: null,
          updated_at: 1_000,
          signal_count: 1,
        },
      ],
    });
  });

  it('returns an empty list when the user has no collections', async () => {
    const { env } = setup();

    const res = await buildApp().request('/api/collections', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ collections: [] });
  });
});
