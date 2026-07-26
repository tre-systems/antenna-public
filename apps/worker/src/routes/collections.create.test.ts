import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import { buildApp, seedOwnedCollection, setup, USER } from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('POST /api/collections', () => {
  it('creates a private blank collection for the current user', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Product signals', description: 'Daily product collection' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      title: 'Product signals',
      description: 'Daily product collection',
      visibility: 'private',
      slug: null,
      layout: null,
    });
    expect(body.updated_at).toBeGreaterThan(0);

    const [row] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, body.id))
      .all();
    expect(row).toMatchObject({
      ownerId: USER.id,
      title: 'Product signals',
      description: 'Daily product collection',
      visibility: 'private',
      slug: null,
      forkedFromCollectionId: null,
    });
  });

  it('creates a slug when the new collection is externally visible', async () => {
    const { db, env } = setup();

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Shared signals', visibility: 'shared' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body.visibility).toBe('shared');
    expect(body.slug).toMatch(/^[a-f0-9]{32}$/);
    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all();
    expect(signals).toEqual([]);
  });

  it('rejects invalid create bodies', async () => {
    const { env } = setup();

    const emptyTitle = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      },
      env,
    );
    const templateId = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'With template', templateId: 'founder-morning' }),
      },
      env,
    );

    expect(emptyTitle.status).toBe(400);
    expect(await emptyTitle.json()).toEqual({ error: 'invalid_body' });
    expect(templateId.status).toBe(400);
    expect(await templateId.json()).toEqual({ error: 'invalid_body' });
  });

  it('rejects new collections when the user is at the free quota', async () => {
    const { db, env } = setup();
    for (let i = 0; i < 10; i += 1) {
      seedOwnedCollection(db, {
        id: `collection-${String(i)}`,
        title: `Dash ${String(i)}`,
        updatedAt: i,
      });
    }
    seedOwnedCollection(db, {
      id: 'other-user-dash',
      ownerId: 'other-user',
      title: 'Other',
      updatedAt: 11,
    });

    const res = await buildApp().request(
      '/api/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'One too many' }),
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'collection_quota_exceeded',
      quota: { used: 10, limit: 10, remaining: 0, can_create: false },
    });
  });
});
