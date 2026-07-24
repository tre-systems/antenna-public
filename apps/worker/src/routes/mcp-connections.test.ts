import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { McpOAuthConnectionRecord } from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { mcpConnectionsRoute } from './mcp-connections';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const SCHEMA_DDL = `
  CREATE TABLE oauth_application (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    icon text,
    metadata text,
    client_id text NOT NULL UNIQUE,
    client_secret text,
    redirect_urls text NOT NULL,
    type text NOT NULL,
    disabled integer DEFAULT false NOT NULL,
    user_id text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE oauth_access_token (
    id text PRIMARY KEY NOT NULL,
    access_token text NOT NULL UNIQUE,
    refresh_token text NOT NULL UNIQUE,
    access_token_expires_at integer NOT NULL,
    refresh_token_expires_at integer NOT NULL,
    client_id text NOT NULL,
    user_id text,
    scopes text NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE oauth_consent (
    id text PRIMARY KEY NOT NULL,
    client_id text NOT NULL,
    user_id text NOT NULL,
    scopes text NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
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

const setup = (): { db: Drizzle; env: { DB: D1Database }; app: Hono<{ Variables: AuthVars }> } => {
  const sqlite = new Database(':memory:');
  sqlite.exec(SCHEMA_DDL);
  const db = drizzle(sqlite, { schema });
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('/api/mcp-connections/*', async (c, next) => {
    c.set('user', { id: 'user-1', email: 'user@test.local', name: 'User' });
    await next();
  });
  app.route('/api/mcp-connections', mcpConnectionsRoute);
  return { db, env: { DB: { __sqlite: sqlite } as unknown as D1Database }, app };
};

const insertClient = (db: Drizzle, clientId: string, name: string, disabled = false) => {
  db.insert(schema.oauthApplication)
    .values({
      id: `app-${clientId}`,
      name,
      clientId,
      redirectUrls: 'https://client.test/callback',
      type: 'public',
      disabled,
      createdAt: new Date(1_000),
      updatedAt: new Date(1_000),
    })
    .run();
};

const insertGrant = (
  db: Drizzle,
  id: string,
  clientId: string,
  userId: string,
  refreshExpiresAt: number,
  updatedAt: number,
) => {
  db.insert(schema.oauthAccessToken)
    .values({
      id,
      accessToken: `access-${id}`,
      refreshToken: `refresh-${id}`,
      accessTokenExpiresAt: new Date(refreshExpiresAt - 1_000),
      refreshTokenExpiresAt: new Date(refreshExpiresAt),
      clientId,
      userId,
      scopes: id.endsWith('2') ? 'offline_access collection:read' : 'offline_access',
      createdAt: new Date(updatedAt - 500),
      updatedAt: new Date(updatedAt),
    })
    .run();
};

describe('/api/mcp-connections', () => {
  it('lists and groups only live, enabled connections owned by the current user', async () => {
    const { db, env, app } = setup();
    const future = Date.now() + 60_000;
    insertClient(db, 'claude', 'Claude Code');
    insertClient(db, 'disabled', 'Disabled', true);
    insertGrant(db, 'own-1', 'claude', 'user-1', future, 2_000);
    insertGrant(db, 'own-2', 'claude', 'user-1', future + 1_000, 3_000);
    insertGrant(db, 'other', 'claude', 'user-2', future, 4_000);
    insertGrant(db, 'expired', 'claude', 'user-1', Date.now() - 1, 1_000);
    insertGrant(db, 'disabled', 'disabled', 'user-1', future, 5_000);

    const res = await app.request('/api/mcp-connections', undefined, env);
    const body: McpOAuthConnectionRecord[] = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([
      {
        client_id: 'claude',
        name: 'Claude Code',
        created_at: 1_000,
        last_refreshed_at: 3_000,
        access_expires_at: future,
        refresh_expires_at: future + 1_000,
        scopes: ['collection:read', 'offline_access'],
      },
    ]);
  });

  it('disconnects only the current user grant and consent', async () => {
    const { db, env, app } = setup();
    const future = Date.now() + 60_000;
    insertClient(db, 'claude', 'Claude Code');
    insertGrant(db, 'own', 'claude', 'user-1', future, 2_000);
    insertGrant(db, 'other', 'claude', 'user-2', future, 3_000);
    db.insert(schema.oauthConsent)
      .values([
        {
          id: 'consent-own',
          clientId: 'claude',
          userId: 'user-1',
          scopes: 'offline_access',
          createdAt: new Date(1_000),
          updatedAt: new Date(1_000),
          consentGiven: true,
        },
        {
          id: 'consent-other',
          clientId: 'claude',
          userId: 'user-2',
          scopes: 'offline_access',
          createdAt: new Date(1_000),
          updatedAt: new Date(1_000),
          consentGiven: true,
        },
      ])
      .run();

    const res = await app.request('/api/mcp-connections/claude', { method: 'DELETE' }, env);

    expect(res.status).toBe(200);
    expect(
      db
        .select()
        .from(schema.oauthAccessToken)
        .all()
        .map((row) => row.id),
    ).toEqual(['other']);
    expect(
      db
        .select()
        .from(schema.oauthConsent)
        .all()
        .map((row) => row.id),
    ).toEqual(['consent-other']);
  });

  it('does not disclose or revoke another user connection', async () => {
    const { db, env, app } = setup();
    insertClient(db, 'other-client', 'Other');
    insertGrant(db, 'other', 'other-client', 'user-2', Date.now() + 60_000, 2_000);

    const res = await app.request('/api/mcp-connections/other-client', { method: 'DELETE' }, env);

    expect(res.status).toBe(404);
    expect(db.select().from(schema.oauthAccessToken).all()).toHaveLength(1);
  });
});
