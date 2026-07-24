import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { refreshTokenBeingRotated, retireRotatedOAuthGrant } from './oauth-rotation';

type Sqlite = ReturnType<typeof Database>;

vi.mock('../db/client', async () => {
  const actual = await vi.importActual<typeof DbClientModule>('../db/client');
  return {
    ...actual,
    db: (env: { DB: { __sqlite: Sqlite } }) => drizzle(env.DB.__sqlite, { schema }),
  };
});

describe('OAuth refresh rotation', () => {
  it('recognises refresh grants without accepting unrelated token requests', async () => {
    const form = new Request('https://antenna.test/api/auth/mcp/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=old-secret',
    });
    const authorizationCode = new Request('https://antenna.test/api/auth/mcp/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', refresh_token: 'not-consumed' }),
    });

    await expect(refreshTokenBeingRotated(form)).resolves.toBe('old-secret');
    await expect(refreshTokenBeingRotated(authorizationCode)).resolves.toBeNull();
  });

  it('retires only the consumed refresh grant', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE oauth_access_token (
        id text PRIMARY KEY NOT NULL, access_token text NOT NULL UNIQUE,
        refresh_token text NOT NULL UNIQUE, access_token_expires_at integer NOT NULL,
        refresh_token_expires_at integer NOT NULL, client_id text NOT NULL, user_id text,
        scopes text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL
      );
      INSERT INTO oauth_access_token VALUES
        ('old', 'access-old', 'refresh-old', 1, 2, 'client', 'user', '', 0, 0),
        ('new', 'access-new', 'refresh-new', 3, 4, 'client', 'user', '', 0, 0);
    `);
    const env = { DB: { __sqlite: sqlite } as unknown as D1Database };

    await retireRotatedOAuthGrant(env, 'refresh-old');

    expect(sqlite.prepare('SELECT id FROM oauth_access_token ORDER BY id').pluck().all()).toEqual([
      'new',
    ]);
  });
});
