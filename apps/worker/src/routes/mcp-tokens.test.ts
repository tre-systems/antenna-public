import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { McpTokenRecord } from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';
import { mcpTokensRoute } from './mcp-tokens';

type Sqlite = ReturnType<typeof Database>;
type Drizzle = BetterSQLite3Database<typeof schema>;

const SCHEMA_DDL = `
  CREATE TABLE mcp_tokens (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    label text,
    created_at integer NOT NULL,
    last_used_at integer,
    revoked_at integer
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
  app.use('/api/mcp-tokens/*', async (c, next) => {
    c.set('user', { id: 'user-1', email: 'user@test.local', name: 'User' });
    await next();
  });
  app.route('/api/mcp-tokens', mcpTokensRoute);
  return { db, env: { DB: { __sqlite: sqlite } as unknown as D1Database }, app };
};

describe('/api/mcp-tokens', () => {
  it('rejects manual token creation', async () => {
    const { db, env, app } = setup();

    const res = await app.request(
      '/api/mcp-tokens',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: 'Claude Code' }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'manual_tokens_disabled' });
    expect(db.select().from(schema.mcpTokens).all()).toEqual([]);
  });

  it('lists active tokens for the current user only', async () => {
    const { db, env, app } = setup();
    db.insert(schema.mcpTokens)
      .values([
        {
          id: 'own',
          userId: 'user-1',
          tokenHash: 'hash-1',
          label: 'Own',
          createdAt: new Date(2_000),
        },
        {
          id: 'other',
          userId: 'user-2',
          tokenHash: 'hash-2',
          label: 'Other',
          createdAt: new Date(3_000),
        },
        {
          id: 'revoked',
          userId: 'user-1',
          tokenHash: 'hash-3',
          label: 'Old',
          createdAt: new Date(1_000),
          revokedAt: new Date(4_000),
        },
      ])
      .run();

    const res = await app.request('/api/mcp-tokens', undefined, env);
    const body: McpTokenRecord[] = await res.json();

    expect(body).toEqual([
      {
        id: 'own',
        label: 'Own',
        created_at: 2_000,
        last_used_at: null,
        revoked_at: null,
      },
    ]);
  });

  it('revokes only current-user tokens', async () => {
    const { db, env, app } = setup();
    db.insert(schema.mcpTokens)
      .values([
        {
          id: 'own',
          userId: 'user-1',
          tokenHash: 'hash-1',
          label: 'Own',
          createdAt: new Date(2_000),
        },
        {
          id: 'other',
          userId: 'user-2',
          tokenHash: 'hash-2',
          label: 'Other',
          createdAt: new Date(3_000),
        },
      ])
      .run();

    const own = await app.request('/api/mcp-tokens/own', { method: 'DELETE' }, env);
    const other = await app.request('/api/mcp-tokens/other', { method: 'DELETE' }, env);

    expect(own.status).toBe(200);
    expect(other.status).toBe(404);
    const [row] = db
      .select()
      .from(schema.mcpTokens)
      .where(schema.sql`id = 'own'`)
      .all();
    expect(row?.revokedAt).toBeInstanceOf(Date);
  });
});
