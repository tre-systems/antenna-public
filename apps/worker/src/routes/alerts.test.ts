import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { SignalAlertListResponse } from '@antenna/shared';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { alertsRoute } from './alerts';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const USER: SessionUser = { id: 'user-1', email: 'user@test.local', name: 'User' };

const SCHEMA_DDL = `
  CREATE TABLE collections (
    id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL,
    title text NOT NULL,
    description text,
    visibility text DEFAULT 'private' NOT NULL,
    refresh_mode text DEFAULT 'scheduled' NOT NULL,
    slug text UNIQUE,
    forked_from_collection_id text,
    layout text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE signals (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    template_id text NOT NULL,
    title text NOT NULL,
    config text NOT NULL,
    refresh_seconds integer NOT NULL,
    position integer NOT NULL,
    visibility text DEFAULT 'private' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE signal_alerts (
    id text PRIMARY KEY NOT NULL,
    collection_id text NOT NULL REFERENCES collections(id),
    signal_id text NOT NULL REFERENCES signals(id),
    rule_id text NOT NULL,
    rule_label text NOT NULL,
    metric_key text NOT NULL,
    observed_at integer NOT NULL,
    triggered_at integer NOT NULL,
    value real NOT NULL,
    previous_value real NOT NULL,
    unit text,
    source_url text
  );
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const setup = (): { db: Drizzle; env: { DB: D1Database } } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  return {
    db,
    env: { DB: { __sqlite: sqlite } as unknown as D1Database },
  };
};

const buildApp = (user: SessionUser = USER): Hono<{ Variables: AuthVars }> => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/alerts', alertsRoute);
  return app;
};

const seedCollection = (db: Drizzle, id: string, ownerId = USER.id): void => {
  db.insert(schema.collections)
    .values({
      id,
      ownerId,
      title: id,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedSignal = (db: Drizzle, id: string, collectionId: string): void => {
  db.insert(schema.signals)
    .values({
      id,
      collectionId,
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

const seedAlert = (
  db: Drizzle,
  opts: {
    readonly id: string;
    readonly collectionId: string;
    readonly signalId: string;
    readonly triggeredAt: number;
  },
): void => {
  db.insert(schema.signalAlerts)
    .values({
      id: opts.id,
      collectionId: opts.collectionId,
      signalId: opts.signalId,
      ruleId: 'large_move',
      ruleLabel: 'FX moved more than 0.5%',
      metricKey: 'value',
      observedAt: new Date(opts.triggeredAt - 1_000),
      triggeredAt: new Date(opts.triggeredAt),
      value: 1.09,
      previousValue: 1.08,
      unit: 'USD',
      sourceUrl: 'https://frankfurter.dev/',
    })
    .run();
};

describe('GET /api/alerts', () => {
  it('lists owner-scoped alerts with optional collection and since filters', async () => {
    const { db, env } = setup();
    seedCollection(db, 'collection-1');
    seedCollection(db, 'collection-2');
    seedCollection(db, 'other-dash', 'other-user');
    seedSignal(db, 'signal-1', 'collection-1');
    seedSignal(db, 'signal-2', 'collection-2');
    seedSignal(db, 'other', 'other-dash');
    seedAlert(db, {
      id: 'old',
      collectionId: 'collection-1',
      signalId: 'signal-1',
      triggeredAt: 1_000,
    });
    seedAlert(db, {
      id: 'new',
      collectionId: 'collection-2',
      signalId: 'signal-2',
      triggeredAt: 3_000,
    });
    seedAlert(db, {
      id: 'other',
      collectionId: 'other-dash',
      signalId: 'other',
      triggeredAt: 4_000,
    });

    const all = await buildApp().request('/api/alerts', undefined, env);
    const filtered = await buildApp().request(
      '/api/alerts?collection_id=collection-2&since=2000',
      undefined,
      env,
    );

    expect(all.status).toBe(200);
    const allBody: SignalAlertListResponse = await all.json();
    expect(allBody.alerts.map((alert) => alert.id)).toEqual(['new', 'old']);
    expect(allBody.alerts[0]).toMatchObject({
      collection_id: 'collection-2',
      signal_id: 'signal-2',
      template_id: 'fx-pair',
      title: 'EUR/USD',
      rule_id: 'large_move',
      value: 1.09,
      previous_value: 1.08,
      unit: 'USD',
      source_url: 'https://frankfurter.dev/',
    });

    expect(filtered.status).toBe(200);
    const filteredBody: SignalAlertListResponse = await filtered.json();
    expect(filteredBody.alerts.map((alert) => alert.id)).toEqual(['new']);
  });

  it('rejects invalid query strings', async () => {
    const { env } = setup();

    const res = await buildApp().request('/api/alerts?limit=1000', undefined, env);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_query' });
  });
});
