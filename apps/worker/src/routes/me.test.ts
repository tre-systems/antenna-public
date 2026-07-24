import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@antenna/shared';
import type { AuthVars, SessionUser } from '../auth/middleware';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { meRoute } from './me';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const SCHEMA_DDL = `
  CREATE TABLE user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified integer DEFAULT false NOT NULL,
    image text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    first_seen_at integer,
    onboarded_at integer
  );
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
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const USER: SessionUser = { id: 'user-1', email: 'user@test.local', name: 'User' };

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
  app.route('/api/me', meRoute);
  return app;
};

const seedCollection = (db: Drizzle, id: string, ownerId = USER.id): void => {
  db.insert(schema.collections)
    .values({
      id,
      ownerId,
      title: id,
      description: null,
      visibility: 'private',
      slug: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
};

const seedUser = (db: Drizzle, overrides: Partial<typeof schema.user.$inferInsert> = {}): void => {
  db.insert(schema.user)
    .values({
      id: USER.id,
      name: USER.name,
      email: USER.email,
      emailVerified: true,
      image: null,
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
      firstSeenAt: new Date(1000),
      onboardedAt: null,
      ...overrides,
    })
    .run();
};

describe('GET /api/me', () => {
  it('returns the signed-in user and collection quota', async () => {
    const { db, env } = setup();
    seedUser(db);
    seedCollection(db, 'own-1');
    seedCollection(db, 'own-2');
    seedCollection(db, 'other-1', 'other-user');

    const res = await buildApp().request('/api/me', undefined, env);

    expect(res.status).toBe(200);
    const body: MeResponse = await res.json();
    expect(body).toEqual({
      id: USER.id,
      email: USER.email,
      name: USER.name,
      image_url: null,
      first_seen_at: 1000,
      onboarded_at: null,
      collection_quota: {
        used: 2,
        limit: 10,
        remaining: 8,
        can_create: true,
      },
    });
  });

  it('backfills first_seen_at from created_at for existing users', async () => {
    const { db, env } = setup();
    seedUser(db, { createdAt: new Date(2000), firstSeenAt: null });

    const res = await buildApp().request('/api/me', undefined, env);

    expect(res.status).toBe(200);
    const body: MeResponse = await res.json();
    expect(body.first_seen_at).toBe(2000);
    const [row] = db.select().from(schema.user).where(eq(schema.user.id, USER.id)).all();
    if (!row) throw new Error('expected user row');
    expect(row.firstSeenAt?.getTime()).toBe(2000);
  });

  it('heals missing local auth rows for non-production bypass sessions', async () => {
    const { db, env } = setup();

    const res = await buildApp().request('/api/me', undefined, env);

    expect(res.status).toBe(200);
    const body: MeResponse = await res.json();
    expect(body.first_seen_at).toEqual(expect.any(Number));
    expect(body.onboarded_at).toBeNull();
    const rows = db.select().from(schema.user).where(eq(schema.user.id, USER.id)).all();
    expect(rows).toHaveLength(1);
  });

  it('returns the stored profile image when one is available', async () => {
    const { db, env } = setup();
    seedUser(db, { image: 'https://lh3.googleusercontent.com/a/test-avatar' });

    const res = await buildApp().request('/api/me', undefined, env);

    expect(res.status).toBe(200);
    const body: MeResponse = await res.json();
    expect(body.image_url).toBe('https://lh3.googleusercontent.com/a/test-avatar');
  });
});

describe('PATCH /api/me/onboarding', () => {
  it('marks the user as onboarded and keeps the original first_seen_at', async () => {
    const { db, env } = setup();
    seedUser(db, { firstSeenAt: new Date(3000), onboardedAt: null });

    const res = await buildApp().request(
      '/api/me/onboarding',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body: MeResponse = await res.json();
    expect(body.first_seen_at).toBe(3000);
    expect(body.onboarded_at).toEqual(expect.any(Number));
    const [row] = db.select().from(schema.user).where(eq(schema.user.id, USER.id)).all();
    if (!row) throw new Error('expected user row');
    expect(row.onboardedAt).not.toBeNull();
  });

  it('rejects invalid onboarding bodies', async () => {
    const { env } = setup();

    const res = await buildApp().request(
      '/api/me/onboarding',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ completed: false }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
  });
});
