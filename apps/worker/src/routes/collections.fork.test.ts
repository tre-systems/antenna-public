import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CollectionRecord } from '@antenna/shared';
import * as schema from '../db/schema';
import type { Visibility } from '../policy/source-access';
import { buildApp, setup, type Drizzle } from './collections-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

const seedSourceCollection = (
  db: Drizzle,
  opts: { readonly layoutSignalIds?: ReadonlyArray<string> } = {},
): void => {
  db.insert(schema.collections)
    .values({
      id: 'source-dash',
      ownerId: 'source-owner',
      title: 'Founder Morning',
      description: 'A public collection to fork',
      visibility: 'public',
      slug: 'source-slug',
      layout: JSON.stringify({
        version: 1,
        slots: (opts.layoutSignalIds ?? []).map((signalId, index) => ({
          signal_id: signalId,
          x: 0,
          y: index,
          w: 4,
          h: 3,
        })),
      }) as unknown as schema.CollectionLayout,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSourceSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly templateId: string;
    readonly visibility: Visibility;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: 'source-dash',
      templateId: opts.templateId,
      title: opts.id,
      config:
        opts.templateId === 'fx-pair'
          ? (JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig)
          : (JSON.stringify({ symbol: 'BA.L' }) as unknown as schema.SignalConfig),
      refreshSeconds: 900,
      position: opts.position,
      visibility: opts.visibility,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

describe('POST /api/collections from a community template', () => {
  it('creates a collection from a published community collection template by forking safe signals', async () => {
    const { db, env } = setup();
    seedSourceCollection(db, { layoutSignalIds: ['public-fx', 'blocked-market'] });
    seedSourceSignal(db, {
      id: 'public-fx',
      templateId: 'fx-pair',
      visibility: 'public',
      position: 0,
    });
    seedSourceSignal(db, {
      id: 'blocked-market',
      templateId: 'market-history',
      visibility: 'public',
      position: 1,
    });
    db.insert(schema.collectionTemplatePublications)
      .values({
        collectionId: 'source-dash',
        label: 'Published signals',
        description: 'A public template',
        summary: 'Forkable public signals',
        publishedBy: 'source-owner',
        publishedAt: new Date(2_000),
        updatedAt: new Date(2_000),
      })
      .run();

    const res = await buildApp().request(
      '/api/collections?templateId=collection:source-slug',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'My community copy' }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body: CollectionRecord = await res.json();
    expect(body).toMatchObject({
      title: 'My community copy',
      description: 'A public collection to fork',
      visibility: 'private',
      slug: null,
    });

    const [collection] = db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, body.id))
      .all();
    expect(collection?.forkedFromCollectionId).toBe('source-dash');

    const signals = db
      .select()
      .from(schema.signals)
      .where(eq(schema.signals.collectionId, body.id))
      .all();
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      templateId: 'fx-pair',
      title: 'public-fx',
      visibility: 'private',
    });
    expect(body.layout?.slots).toHaveLength(1);
    expect(body.layout?.slots[0]?.signal_id).toBe(signals[0]?.id);
  });
});
