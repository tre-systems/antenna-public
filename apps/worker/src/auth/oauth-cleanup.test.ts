import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { cleanupExpiredOAuthState, shouldRunOAuthCleanup } from './oauth-cleanup';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const SCHEMA_DDL = `
  CREATE TABLE oauth_application (
    id text PRIMARY KEY NOT NULL, name text NOT NULL, icon text, metadata text,
    client_id text NOT NULL UNIQUE, client_secret text, redirect_urls text NOT NULL,
    type text NOT NULL, disabled integer DEFAULT false NOT NULL, user_id text,
    created_at integer NOT NULL, updated_at integer NOT NULL
  );
  CREATE TABLE oauth_access_token (
    id text PRIMARY KEY NOT NULL, access_token text NOT NULL UNIQUE,
    refresh_token text NOT NULL UNIQUE, access_token_expires_at integer NOT NULL,
    refresh_token_expires_at integer NOT NULL, client_id text NOT NULL, user_id text,
    scopes text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL
  );
  CREATE TABLE oauth_consent (
    id text PRIMARY KEY NOT NULL, client_id text NOT NULL, user_id text NOT NULL,
    scopes text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL,
    consent_given integer NOT NULL
  );
`;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

const insertClient = (db: Drizzle, clientId: string, createdAt: number) => {
  db.insert(schema.oauthApplication)
    .values({
      id: `app-${clientId}`,
      name: clientId,
      clientId,
      redirectUrls: 'https://client.test/callback',
      type: 'public',
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
    })
    .run();
};

describe('OAuth state cleanup', () => {
  it('runs once per hour at a stable minute', () => {
    expect(shouldRunOAuthCleanup(Date.parse('2026-07-11T12:17:00Z'))).toBe(true);
    expect(shouldRunOAuthCleanup(Date.parse('2026-07-11T12:18:00Z'))).toBe(false);
  });

  it('purges expired grants and old orphaned registrations without touching live state', async () => {
    const now = Date.parse('2026-07-11T12:17:00Z');
    const sqlite = new Database(':memory:');
    sqlite.exec(SCHEMA_DDL);
    const db = drizzle(sqlite, { schema });
    const old = now - 31 * 24 * 60 * 60 * 1_000;
    insertClient(db, 'expired-orphan', old);
    insertClient(db, 'live', old);
    insertClient(db, 'recent-orphan', now - 1_000);
    db.insert(schema.oauthAccessToken)
      .values([
        {
          id: 'expired',
          accessToken: 'access-expired',
          refreshToken: 'refresh-expired',
          accessTokenExpiresAt: new Date(now - 2_000),
          refreshTokenExpiresAt: new Date(now - 1_000),
          clientId: 'expired-orphan',
          userId: 'user-1',
          scopes: 'offline_access',
          createdAt: new Date(old),
          updatedAt: new Date(old),
        },
        {
          id: 'live',
          accessToken: 'access-live',
          refreshToken: 'refresh-live',
          accessTokenExpiresAt: new Date(now + 1_000),
          refreshTokenExpiresAt: new Date(now + 2_000),
          clientId: 'live',
          userId: 'user-1',
          scopes: 'offline_access',
          createdAt: new Date(old),
          updatedAt: new Date(old),
        },
      ])
      .run();

    await cleanupExpiredOAuthState({ DB: { __sqlite: sqlite } as unknown as D1Database }, now);

    expect(
      db
        .select()
        .from(schema.oauthAccessToken)
        .all()
        .map((row) => row.id),
    ).toEqual(['live']);
    expect(
      db
        .select()
        .from(schema.oauthApplication)
        .all()
        .map((row) => row.clientId)
        .sort(),
    ).toEqual(['live', 'recent-orphan']);
  });
});
