import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionTemplatePublishRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import {
  buildApp,
  seedOwnedCollection,
  seedOwnedSignal,
  setup,
  USER,
} from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('POST /api/collections/:id/template', () => {
  it('publishes an owned public collection as a community template using public-safe signals only', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, {
      id: 'own-public',
      title: 'My public collection',
      description: 'Public source collection',
      visibility: 'public',
      slug: 'own-public-slug',
      updatedAt: 1_000,
    });
    seedOwnedSignal(db, { id: 'public-fx', collectionId: 'own-public', position: 0 });
    db.update(schema.signals)
      .set({ visibility: 'public' })
      .where(eq(schema.signals.id, 'public-fx'))
      .run();
    db.insert(schema.signals)
      .values({
        id: 'blocked-market',
        collectionId: 'own-public',
        templateId: 'market-history',
        title: 'Signaled market chart',
        config: JSON.stringify({ symbol: 'BA.L' }) as unknown as schema.SignalConfig,
        refreshSeconds: 3_600,
        position: 1,
        visibility: 'public',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const res = await buildApp().request(
      '/api/collections/own-public/template',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: 'Useful public signals',
          summary: 'One safe public card',
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: CollectionTemplatePublishRecord = await res.json();
    expect(body.template).toMatchObject({
      id: 'collection:own-public-slug',
      kind: 'community',
      label: 'Useful public signals',
      description: 'Public source collection',
      summary: 'One safe public card',
      source_collection_id: 'own-public',
      fork_source_slug: 'own-public-slug',
      owner_display_name: USER.name,
    });
    expect(body.template.signals).toEqual([
      {
        template_id: 'fx-pair',
        display_name: 'FX pair',
        title: 'public-fx',
      },
    ]);
    expect(body.skipped_signals).toEqual([
      {
        id: 'blocked-market',
        title: 'Signaled market chart',
        template_id: 'market-history',
        reason: 'source_not_public_display_eligible',
      },
    ]);

    const [publication] = db
      .select()
      .from(schema.collectionTemplatePublications)
      .where(eq(schema.collectionTemplatePublications.collectionId, 'own-public'))
      .all();
    expect(publication).toMatchObject({
      label: 'Useful public signals',
      summary: 'One safe public card',
      publishedBy: USER.id,
    });
  });

  it('rejects missing, non-public, and empty public collections', async () => {
    const { db, env } = setup();
    seedOwnedCollection(db, { id: 'private', title: 'Private', updatedAt: 1_000 });
    seedOwnedCollection(db, {
      id: 'empty-public',
      title: 'Empty',
      visibility: 'public',
      slug: 'empty-public',
      updatedAt: 2_000,
    });
    const app = buildApp();

    const missing = await app.request('/api/collections/missing/template', { method: 'POST' }, env);
    const privateCollection = await app.request(
      '/api/collections/private/template',
      { method: 'POST' },
      env,
    );
    const empty = await app.request(
      '/api/collections/empty-public/template',
      { method: 'POST' },
      env,
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
    expect(privateCollection.status).toBe(409);
    expect(await privateCollection.json()).toEqual({ error: 'collection_not_public' });
    expect(empty.status).toBe(409);
    expect(await empty.json()).toEqual({ error: 'no_template_signals', skipped_signals: [] });
  });
});
