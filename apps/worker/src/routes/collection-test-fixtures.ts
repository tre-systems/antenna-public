// Shared scaffolding for the collection.*.test.ts files (the single-collection
// route). Not a test file (no .test.ts suffix) so vitest ignores it.

import { Hono } from 'hono';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { collectionRoute } from './collection';
import { OWNER_1, OWNER_2, setupRoutesDb, type Drizzle } from './routes-test-fixtures';

export type { Drizzle } from './routes-test-fixtures';
export type App = Hono<{ Variables: AuthVars }>;

export { OWNER_1, OWNER_2 };

export const setup = setupRoutesDb;

export const buildApp = (user: SessionUser = OWNER_1): App => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/collection', collectionRoute);
  return app;
};

export const seedCollection = (db: Drizzle, owner: SessionUser = OWNER_1): void => {
  db.insert(schema.collections)
    .values({
      id: owner.id === OWNER_1.id ? 'collection-1' : 'collection-2',
      ownerId: owner.id,
      title: owner.id === OWNER_1.id ? 'Antenna' : 'Other Collection',
      description: 'Initial description',
      layout: JSON.stringify({
        version: 1,
        slots: [{ signal_id: 'b1', x: 0, y: 0, w: 4, h: 3 }],
      }) as unknown as schema.CollectionLayout,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

export const seedSignal = (db: Drizzle, id = 'b1', collectionId = 'collection-1'): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId,
      templateId: 'fx-pair',
      title: id,
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};
