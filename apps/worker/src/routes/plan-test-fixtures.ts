// Shared scaffolding for the plan.*.test.ts files in this directory.
// Not a test file (no .test.ts suffix) so vitest ignores it.

import { Hono } from 'hono';
import type { CollectionPlan } from '@antenna/shared';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { planRoute } from './plan';
import { setupRoutesDb, type Drizzle } from './routes-test-fixtures';

export type { Drizzle } from './routes-test-fixtures';
export type App = Hono<{ Variables: AuthVars }>;

export const TEST_USER: SessionUser = {
  id: 'user-1',
  email: 'rob@example.test',
  name: 'Rob',
};

export const setup = (
  collection: { readonly id?: string; readonly ownerId?: string } = {},
): { db: Drizzle; env: { DB: D1Database }; app: App } => {
  const { db, env } = setupRoutesDb();
  db.insert(schema.collections)
    .values({
      id: collection.id ?? 'collection-1',
      ownerId: collection.ownerId ?? 'user-1',
      title: 'Test',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();

  const app = new Hono<{ Variables: AuthVars }>();
  // Stub `requireUser` so the route layer sees a session without booting BA.
  app.use('/api/*', async (c, next) => {
    c.set('user', TEST_USER);
    await next();
  });
  app.route('/api/plan', planRoute);
  return { db, env, app };
};

export const post = (app: App, path: string, body: unknown, env: { DB: D1Database }) =>
  app.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );

export const get = (app: App, path: string, env: { DB: D1Database }) =>
  app.request(path, { method: 'GET' }, env);

export const readJson = async <T>(res: Response): Promise<T> => await res.json();

export const insertPlan = (
  db: Drizzle,
  args: {
    readonly id: string;
    readonly collectionId: string;
    readonly plan?: CollectionPlan;
  },
): void => {
  db.insert(schema.collectionPlans)
    .values({
      id: args.id,
      collectionId: args.collectionId,
      prompt: args.plan?.prompt ?? 'track CHF/USD',
      proposed: JSON.stringify(
        args.plan ?? {
          prompt: 'track CHF/USD',
          signals: [
            {
              template_id: 'fx-pair',
              display_name: 'FX pair',
              config: { base: 'CHF', quote: 'USD' },
              missing: [],
              refresh_seconds: 900,
              rights_status: 'public',
              source_label: 'Frankfurter (ECB)',
            },
          ],
          unmatched: [],
        },
      ) as unknown as schema.ProposedPlan,
      status: 'proposed',
      createdAt: new Date(0),
    })
    .run();
};

export const insertCollection = (
  db: Drizzle,
  args: {
    readonly id: string;
    readonly ownerId?: string;
    readonly title?: string;
  },
): void => {
  db.insert(schema.collections)
    .values({
      id: args.id,
      ownerId: args.ownerId ?? TEST_USER.id,
      title: args.title ?? args.id,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

export const insertOtherTenantCollection = (db: Drizzle): void => {
  db.insert(schema.collections)
    .values({
      id: 'someone-elses-dash',
      ownerId: 'someone-else',
      title: 'Other',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};
