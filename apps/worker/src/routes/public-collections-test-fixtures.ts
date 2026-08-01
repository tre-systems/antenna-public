import { Hono } from 'hono';
import * as schema from '../db/schema';
import type { Visibility } from '../policy/source-access';
import { publicCollectionsRoute } from './public-collections';
import { setupRoutesDb, type Drizzle } from './routes-test-fixtures';

export type { Drizzle } from './routes-test-fixtures';

export type PublicEnv = { DB: D1Database };

export const setup = (): { db: Drizzle; env: PublicEnv } => {
  const { db, env } = setupRoutesDb();
  return { db, env };
};

export const buildApp = (): Hono => {
  const app = new Hono();
  app.route('/api/public/collections', publicCollectionsRoute);
  return app;
};

export const seedCollection = (
  db: Drizzle,
  opts: {
    readonly id?: string;
    readonly ownerId?: string;
    readonly title?: string;
    readonly description?: string | null;
    readonly visibility?: Visibility;
    readonly slug?: string | null;
    readonly layoutSignalIds?: ReadonlyArray<string>;
    readonly updatedAt?: Date;
  } = {},
): void => {
  db.insert(schema.collections)
    .values({
      id: opts.id ?? 'collection-1',
      ownerId: opts.ownerId ?? 'owner-1',
      title: opts.title ?? 'Public collection',
      description: opts.description === undefined ? 'External collection' : opts.description,
      visibility: opts.visibility ?? 'public',
      slug: opts.slug ?? 'public-slug',
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
      updatedAt: opts.updatedAt ?? new Date(0),
    })
    .run();
};

export const seedUser = (
  db: Drizzle,
  opts: {
    readonly id?: string;
    readonly name?: string;
    readonly email?: string;
  } = {},
): void => {
  const id = opts.id ?? 'owner-1';
  db.insert(schema.user)
    .values({
      id,
      name: opts.name ?? 'Rob',
      email: opts.email ?? `${id}@example.test`,
      emailVerified: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

export const seedSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly collectionId?: string;
    readonly templateId: string;
    readonly visibility: Visibility;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: opts.collectionId ?? 'collection-1',
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
