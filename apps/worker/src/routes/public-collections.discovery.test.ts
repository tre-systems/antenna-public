import { describe, expect, it, vi } from 'vitest';
import {
  buildApp,
  seedCollection,
  seedSignal,
  seedUser,
  setup,
} from './public-collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('GET /api/public/collections', () => {
  it('keeps public discovery hidden even when public collections exist', async () => {
    const { db, env } = setup();
    seedUser(db, { name: 'Test User' });
    seedCollection(db, {
      id: 'public',
      title: 'Hidden public collection',
      slug: 'hidden-public',
    });
    seedSignal(db, {
      id: 'public-fx',
      collectionId: 'public',
      templateId: 'fx-pair',
      visibility: 'public',
      position: 0,
    });

    const res = await buildApp().request('/api/public/collections?limit=100', undefined, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ collections: [], next_offset: null });
  });
});
