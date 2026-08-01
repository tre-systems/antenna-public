// Provide shared scaffolding for signal route tests.

import { Hono } from 'hono';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { signalsRoute } from './signals';
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
  app.route('/api/signals', signalsRoute);
  return app;
};

export const seedBaseline = (db: Drizzle): void => {
  db.insert(schema.collections)
    .values({
      id: 'collection-1',
      ownerId: OWNER_1.id,
      title: 'Test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  db.insert(schema.signals)
    .values({
      id: 'b1',
      collectionId: 'collection-1',
      templateId: 'fx-pair',
      title: 'EUR/USD',
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

export const seedOtherTenant = (db: Drizzle): void => {
  db.insert(schema.collections)
    .values({
      id: 'collection-2',
      ownerId: OWNER_2.id,
      title: 'Other tenant',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  db.insert(schema.signals)
    .values({
      id: 'b2',
      collectionId: 'collection-2',
      templateId: 'fx-pair',
      title: 'GBP/USD',
      config: JSON.stringify({ base: 'GBP', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};
