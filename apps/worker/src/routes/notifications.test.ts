import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type {
  NotificationPreferenceResponse,
  NotificationPreferencesResponse,
} from '@antenna/shared';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import type { AuthVars, SessionUser } from '../auth/middleware';
import { notificationsRoute } from './notifications';

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
  CREATE TABLE notification_prefs (
    user_id text NOT NULL,
    scope text NOT NULL,
    collection_id text REFERENCES collections(id),
    channel text NOT NULL,
    enabled integer DEFAULT false NOT NULL,
    frequency text DEFAULT 'daily' NOT NULL,
    quiet_hours_start text,
    quiet_hours_end text,
    updated_at integer NOT NULL,
    PRIMARY KEY (user_id, scope, channel)
  );
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const setup = (
  user: SessionUser = USER,
): { db: Drizzle; env: { DB: D1Database }; app: Hono<{ Variables: AuthVars }> } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/notifications/*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/api/notifications', notificationsRoute);
  return { db, env: { DB: { __sqlite: sqlite } as unknown as D1Database }, app };
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

describe('/api/notifications/preferences', () => {
  it('returns default global preferences before a user saves settings', async () => {
    const { env, app } = setup();

    const res = await app.request('/api/notifications/preferences', undefined, env);

    expect(res.status).toBe(200);
    const body: NotificationPreferencesResponse = await res.json();
    expect(body.preferences).toEqual([
      {
        collection_id: null,
        channel: 'daily_digest',
        enabled: false,
        frequency: 'daily',
        quiet_hours_start: null,
        quiet_hours_end: null,
        updated_at: null,
      },
    ]);
  });

  it('creates and updates global preferences while preserving omitted fields', async () => {
    const { db, env, app } = setup();

    const created = await app.request(
      '/api/notifications/preferences/daily_digest',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          frequency: 'weekly',
          quiet_hours_start: '22:00',
          quiet_hours_end: '07:00',
        }),
      },
      env,
    );
    const updated = await app.request(
      '/api/notifications/preferences/daily_digest',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      },
      env,
    );

    expect(created.status).toBe(200);
    const createdBody: NotificationPreferenceResponse = await created.json();
    expect(createdBody.preference).toMatchObject({
      collection_id: null,
      channel: 'daily_digest',
      enabled: true,
      frequency: 'weekly',
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    });

    expect(updated.status).toBe(200);
    const updatedBody: NotificationPreferenceResponse = await updated.json();
    expect(updatedBody.preference).toMatchObject({
      enabled: false,
      frequency: 'weekly',
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    });

    const rows = db.select().from(schema.notificationPrefs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: USER.id,
      scope: 'global',
      collectionId: null,
      channel: 'daily_digest',
      enabled: false,
    });
  });

  it('supports collection-scoped preferences for owned collections only', async () => {
    const { db, env, app } = setup();
    seedCollection(db, 'collection-1');
    seedCollection(db, 'other-dash', 'other-user');

    const own = await app.request(
      '/api/notifications/preferences/daily_digest',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ collection_id: 'collection-1', enabled: true }),
      },
      env,
    );
    const other = await app.request(
      '/api/notifications/preferences/daily_digest',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ collection_id: 'other-dash', enabled: true }),
      },
      env,
    );
    const scoped = await app.request(
      '/api/notifications/preferences?collection_id=collection-1',
      undefined,
      env,
    );

    expect(own.status).toBe(200);
    expect(other.status).toBe(404);
    const scopedBody: NotificationPreferencesResponse = await scoped.json();
    expect(scopedBody.preferences[0]).toMatchObject({
      collection_id: 'collection-1',
      enabled: true,
    });
    expect(db.select().from(schema.notificationPrefs).all()).toHaveLength(1);
  });

  it('rejects invalid channels and preference bodies', async () => {
    const { env, app } = setup();

    const channel = await app.request(
      '/api/notifications/preferences/slack',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      },
      env,
    );
    const body = await app.request(
      '/api/notifications/preferences/daily_digest',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quiet_hours_start: '25:00' }),
      },
      env,
    );

    expect(channel.status).toBe(400);
    expect(await channel.json()).toEqual({ error: 'invalid_channel' });
    expect(body.status).toBe(400);
    expect(await body.json()).toEqual({ error: 'invalid_body' });
  });
});
