// Shared scaffolding for the collections.*.test.ts files.
// Not a test file (no .test.ts suffix) so vitest ignores it.

import { Hono } from 'hono';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import type { Visibility } from '../policy/source-access';
import { collectionsRoute } from './collections';
import { setupRoutesDb, type Drizzle } from './routes-test-fixtures';

export type { Drizzle } from './routes-test-fixtures';

export const USER: SessionUser = { id: 'user-1', email: 'user@test.local', name: 'User' };

export const setup = setupRoutesDb;

export const buildApp = (user: SessionUser = USER): Hono<{ Variables: AuthVars }> => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/collections', collectionsRoute);
  return app;
};

export const seedOwnedCollection = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly ownerId?: string;
    readonly title: string;
    readonly description?: string | null;
    readonly visibility?: Visibility;
    readonly slug?: string | null;
    readonly updatedAt: number;
  },
): void => {
  db.insert(schema.collections)
    .values({
      id: opts.id,
      ownerId: opts.ownerId ?? USER.id,
      title: opts.title,
      description: opts.description ?? null,
      visibility: opts.visibility ?? 'private',
      slug: opts.slug ?? null,
      createdAt: new Date(0),
      updatedAt: new Date(opts.updatedAt),
    })
    .run();
};

export const seedOwnedSignal = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly collectionId: string;
    readonly position: number;
  },
): void => {
  db.insert(schema.signals)
    .values({
      id: opts.id,
      collectionId: opts.collectionId,
      templateId: 'fx-pair',
      title: opts.id,
      config: JSON.stringify({ base: 'EUR', quote: 'USD' }) as unknown as schema.SignalConfig,
      refreshSeconds: 900,
      position: opts.position,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

// Every dependent row the delete route is expected to sweep up with a
// collection, so the delete test can assert each table ends up empty.
export const seedSignalChildren = (db: Drizzle, collectionId: string, signalId: string): void => {
  db.insert(schema.signalPoints)
    .values({
      signalId,
      fetchedAt: new Date(1_000),
      observedAt: new Date(1_000),
      metricKey: 'latest',
      value: 12,
    })
    .run();
  db.insert(schema.signalStatus)
    .values({
      signalId,
      status: 'live',
      lastOkAt: new Date(1_000),
      updatedAt: new Date(1_000),
    })
    .run();
  db.insert(schema.signalAlerts)
    .values({
      id: `alert-${collectionId}`,
      collectionId,
      signalId,
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'value',
      observedAt: new Date(1_000),
      triggeredAt: new Date(1_000),
      value: 1.09,
      previousValue: 1.08,
    })
    .run();
  db.insert(schema.notificationPrefs)
    .values({
      userId: USER.id,
      scope: `collection:${collectionId}`,
      collectionId,
      channel: 'daily_digest',
      enabled: true,
      frequency: 'daily',
      updatedAt: new Date(1_000),
    })
    .run();
  db.insert(schema.notificationDeliveries)
    .values({
      id: `delivery-${collectionId}`,
      userId: USER.id,
      collectionId,
      channel: 'daily_digest',
      periodStart: new Date(0),
      periodEnd: new Date(1_000),
      sentAt: new Date(1_000),
      status: 'sent',
    })
    .run();
  db.insert(schema.dismissedStarterSignals)
    .values({
      collectionId,
      signalSignature: 'fx-pair:EUR/USD',
      dismissedAt: new Date(1_000),
    })
    .run();
  db.insert(schema.collectionPlans)
    .values({
      id: `plan-${collectionId}`,
      collectionId,
      prompt: 'add weather',
      proposed: JSON.stringify([]) as unknown as schema.ProposedPlan,
      status: 'proposed',
      createdAt: new Date(1_000),
    })
    .run();
  db.insert(schema.connectorRequests)
    .values({
      id: `request-${collectionId}`,
      collectionId,
      prompt: 'unsupported',
      requestedBy: USER.id,
      createdAt: new Date(1_000),
    })
    .run();
  db.insert(schema.publicCollectionReports)
    .values({
      id: `report-${collectionId}`,
      collectionId,
      category: 'broken',
      requesterHash: 'hash',
      createdAt: new Date(1_000),
    })
    .run();
  db.insert(schema.userCollectionVisits)
    .values({
      userId: USER.id,
      collectionId,
      lastSeenAt: new Date(1_000),
    })
    .run();
  db.insert(schema.collectionTemplatePublications)
    .values({
      collectionId,
      label: 'Delete template',
      description: 'Will be removed',
      summary: 'Delete me',
      publishedBy: USER.id,
      publishedAt: new Date(1_000),
      updatedAt: new Date(1_000),
    })
    .run();
};
