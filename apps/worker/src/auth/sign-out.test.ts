import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type * as DbClientModule from '../db/client';
import * as schema from '../db/schema';

type Sqlite = ReturnType<typeof Database>;

// Sign-out resolves cookies against Better Auth's schema.
const BA_SCHEMA_DDL = `
  CREATE TABLE user (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified integer DEFAULT 0 NOT NULL,
    image text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    first_seen_at integer,
    onboarded_at integer
  );
  CREATE TABLE session (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    token text NOT NULL,
    expires_at integer NOT NULL,
    ip_address text,
    user_agent text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE account (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at integer,
    refresh_token_expires_at integer,
    scope text,
    password text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE TABLE verification (
    id text PRIMARY KEY NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at integer NOT NULL,
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

// Import after mocking so createAuth binds the in-memory client.
const { createAuth } = await import('./index');

type TestEnv = Parameters<typeof createAuth>[0];

const buildEnv = (): TestEnv => {
  const sqlite = new Database(':memory:');
  sqlite.exec(BA_SCHEMA_DDL);
  return {
    DB: { __sqlite: sqlite } as unknown as D1Database,
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    BETTER_AUTH_SECRET: 'test-better-auth-secret-please-ignore',
    ENCRYPTION_KEY: '0'.repeat(64),
  };
};

const buildApp = () => {
  // Mirror the production mount to exercise the real Better Auth router.
  const app = new Hono<{ Bindings: TestEnv }>();
  app.all('/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));
  return app;
};

const signOutRequest = (env: TestEnv, init: RequestInit) =>
  buildApp().request('https://antenna.example/api/auth/sign-out', init, env);

describe('POST /api/auth/sign-out', () => {
  // Sign-out requires an empty JSON request rather than a content-type-free POST.
  it('accepts the SPA sign-out request (JSON content-type + empty body)', async () => {
    const env = buildEnv();
    const res = await signOutRequest(env, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it('rejects a body sent with a non-JSON content-type (415)', async () => {
    const env = buildEnv();
    const res = await signOutRequest(env, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    expect(res.status).toBe(415);
  });
});
