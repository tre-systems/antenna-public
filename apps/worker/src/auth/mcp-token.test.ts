import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import {
  authenticateBearer,
  authenticateMcpToken,
  authenticateOAuthToken,
  extractBearerToken,
  hashMcpToken,
} from './mcp-token';

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
  CREATE TABLE mcp_tokens (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
    token_hash text NOT NULL UNIQUE,
    label text,
    created_at integer NOT NULL,
    last_used_at integer,
    revoked_at integer
  );
  CREATE TABLE oauth_access_token (
    id text PRIMARY KEY NOT NULL,
    access_token text NOT NULL UNIQUE,
    refresh_token text NOT NULL UNIQUE,
    access_token_expires_at integer NOT NULL,
    refresh_token_expires_at integer NOT NULL,
    client_id text NOT NULL,
    user_id text REFERENCES user(id) ON DELETE cascade,
    scopes text NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
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
    user_id text REFERENCES user(id) ON DELETE cascade,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
`;

const seedUser = (db: BetterSQLite3Database<typeof schema>) =>
  db
    .insert(schema.user)
    .values({
      id: 'user-1',
      email: 'user@test.local',
      name: 'User',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();

const EXPECTED_USER = { id: 'user-1', email: 'user@test.local', name: 'User', image: null };

const seedOAuthApplication = (db: BetterSQLite3Database<typeof schema>, disabled = false) =>
  db
    .insert(schema.oauthApplication)
    .values({
      id: 'app-1',
      name: 'Test client',
      clientId: 'client-1',
      redirectUrls: 'https://client.example/callback',
      type: 'public',
      disabled,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();

describe('MCP token auth', () => {
  it('authenticates active tokens and records last use', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SCHEMA_DDL);
    const db = drizzle(sqlite, { schema });
    const token = 'pbk_test';

    db.insert(schema.user)
      .values({
        id: 'user-1',
        email: 'user@test.local',
        name: 'User',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.mcpTokens)
      .values({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: await hashMcpToken(token),
        label: 'Local',
        createdAt: new Date(0),
      })
      .run();

    const result = await authenticateMcpToken(
      db as unknown as Parameters<typeof authenticateMcpToken>[0],
      token,
    );

    expect(result).toEqual({
      tokenId: 'token-1',
      user: { id: 'user-1', email: 'user@test.local', name: 'User', image: null },
    });
    const [row] = db.select().from(schema.mcpTokens).all();
    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });

  it('rejects revoked tokens', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SCHEMA_DDL);
    const db = drizzle(sqlite, { schema });
    const token = 'pbk_revoked';

    db.insert(schema.user)
      .values({
        id: 'user-1',
        email: 'user@test.local',
        name: 'User',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();
    db.insert(schema.mcpTokens)
      .values({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: await hashMcpToken(token),
        label: 'Local',
        createdAt: new Date(0),
        revokedAt: new Date(1),
      })
      .run();

    await expect(
      authenticateMcpToken(db as unknown as Parameters<typeof authenticateMcpToken>[0], token),
    ).resolves.toBeNull();
  });

  it('extracts any bearer value (not just pbk_) for OAuth access tokens', () => {
    expect(extractBearerToken('Bearer pbk_abc')).toBe('pbk_abc');
    expect(extractBearerToken('Bearer randomOAuthValue123')).toBe('randomOAuthValue123');
    expect(extractBearerToken('bearer   spaced')).toBe('spaced');
    expect(extractBearerToken('Basic x')).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it('authenticates a live OAuth access token and rejects expired or unknown', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SCHEMA_DDL);
    const db = drizzle(sqlite, { schema });
    seedUser(db);
    seedOAuthApplication(db);
    const common = {
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      clientId: 'client-1',
      userId: 'user-1',
      scopes: 'openid',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    db.insert(schema.oauthAccessToken)
      .values({
        id: 'tok-live',
        accessToken: 'live-token',
        refreshToken: 'refresh-live',
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        ...common,
      })
      .run();
    db.insert(schema.oauthAccessToken)
      .values({
        id: 'tok-exp',
        accessToken: 'expired-token',
        refreshToken: 'refresh-exp',
        accessTokenExpiresAt: new Date(Date.now() - 1_000),
        ...common,
      })
      .run();

    const client = db as unknown as Parameters<typeof authenticateOAuthToken>[0];
    await expect(authenticateOAuthToken(client, 'live-token')).resolves.toEqual({
      user: EXPECTED_USER,
    });
    await expect(authenticateOAuthToken(client, 'expired-token')).resolves.toBeNull();
    await expect(authenticateOAuthToken(client, 'no-such-token')).resolves.toBeNull();
  });

  it('rejects access tokens issued to a disabled OAuth client', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SCHEMA_DDL);
    const db = drizzle(sqlite, { schema });
    seedUser(db);
    seedOAuthApplication(db, true);
    db.insert(schema.oauthAccessToken)
      .values({
        id: 'tok-disabled',
        accessToken: 'disabled-token',
        refreshToken: 'refresh-disabled',
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000),
        clientId: 'client-1',
        userId: 'user-1',
        scopes: 'openid',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const client = db as unknown as Parameters<typeof authenticateOAuthToken>[0];
    await expect(authenticateOAuthToken(client, 'disabled-token')).resolves.toBeNull();
  });

  it('routes bearers by prefix: pbk_ to MCP tokens, others to OAuth', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(SCHEMA_DDL);
    const db = drizzle(sqlite, { schema });
    seedUser(db);
    seedOAuthApplication(db);
    db.insert(schema.mcpTokens)
      .values({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: await hashMcpToken('pbk_live'),
        label: 'Local',
        createdAt: new Date(0),
      })
      .run();
    db.insert(schema.oauthAccessToken)
      .values({
        id: 'tok-live',
        accessToken: 'oauth-live',
        refreshToken: 'refresh-live',
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000),
        clientId: 'client-1',
        userId: 'user-1',
        scopes: 'openid',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      })
      .run();

    const client = db as unknown as Parameters<typeof authenticateBearer>[0];
    await expect(authenticateBearer(client, 'pbk_live')).resolves.toEqual({ user: EXPECTED_USER });
    await expect(authenticateBearer(client, 'oauth-live')).resolves.toEqual({
      user: EXPECTED_USER,
    });
    await expect(authenticateBearer(client, 'pbk_nope')).resolves.toBeNull();
  });
});
