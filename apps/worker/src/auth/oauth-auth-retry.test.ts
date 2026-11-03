import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { requireUser, type AuthVars, type MiddlewareEnv } from './middleware';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./index', () => ({ createAuth: () => ({ api: { getSession } }) }));
vi.mock('./oauth-jwt', () => ({
  verifyOAuthJwt: () =>
    Promise.resolve({
      sub: 'owner',
      azp: 'client',
      antenna_grant: 'grant',
      antenna_session: 'session',
      scope: 'antenna',
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
}));
vi.mock('../db/client', () => ({
  db: (env: { DB: { sqlite: ReturnType<typeof Database> } }) => drizzle(env.DB.sqlite, { schema }),
}));

const transient = () =>
  new Error('Drizzle query failed', { cause: new Error('D1_ERROR: internal error') });

function setup() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE user (id text, email text, name text, image text);
    CREATE TABLE oauth2_client (client_id text, disabled integer);
    CREATE TABLE oauth2_consent (id text, user_id text, client_id text, scopes text, resources text);
    CREATE TABLE session (id text, user_id text, expires_at integer);
    INSERT INTO user VALUES ('owner', 'owner@test.local', 'Owner', NULL);
    INSERT INTO oauth2_client VALUES ('client', 0);
    INSERT INTO oauth2_consent VALUES ('grant','owner','client','["antenna"]','["http://localhost:8787/api/mcp"]');
  `);
  sqlite
    .prepare('INSERT INTO session VALUES (?, ?, ?)')
    .run('session', 'owner', Date.now() + 60_000);
  const env: MiddlewareEnv = {
    DB: { sqlite } as unknown as D1Database,
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    BETTER_AUTH_SECRET: 'test',
    ENCRYPTION_KEY: '0'.repeat(64),
    NODE_ENV: 'production',
  };
  const handler = vi.fn(() => new Response('protected'));
  const onError = vi.fn(() => new Response('Internal Server Error', { status: 500 }));
  const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
  app.onError(onError);
  app.use('/api/*', requireUser());
  app.post('/api/mcp', handler);
  const query = vi.spyOn(sqlite, 'prepare');
  const invoke = async () => {
    const response = app.request(
      '/api/mcp',
      {
        method: 'POST',
        headers: { authorization: 'Bearer test-oauth', cookie: 'session=ignored' },
      },
      env,
    );
    await vi.runAllTimersAsync();
    return response;
  };
  return { sqlite, env, query, handler, onError, invoke };
}

describe('OAuth retry authentication boundary', () => {
  let fixture: ReturnType<typeof setup>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'));
    getSession.mockReset();
    fixture = setup();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fixture.sqlite.close();
    vi.useRealTimers();
  });

  it('recovers a transient lookup and invokes the protected handler only once', async () => {
    fixture.query.mockImplementationOnce(() => {
      throw transient();
    });
    const response = await fixture.invoke();
    expect(response.status).toBe(200);
    expect(fixture.query).toHaveBeenCalledTimes(2);
    expect(fixture.handler).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('fails closed after exhausted retries without cookie fallback or handler access', async () => {
    const error = transient();
    fixture.query.mockImplementation(() => {
      throw error;
    });
    expect((await fixture.invoke()).status).toBe(500);
    expect(fixture.query).toHaveBeenCalledTimes(3);
    expect(fixture.onError).toHaveBeenCalledWith(error, expect.anything());
    expect(fixture.handler).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('does not retry non-transient lookup failures', async () => {
    fixture.query.mockImplementation(() => {
      throw new Error('D1_ERROR: no such table');
    });
    expect((await fixture.invoke()).status).toBe(500);
    expect(fixture.query).toHaveBeenCalledTimes(1);
    expect(fixture.handler).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('never replays the protected handler when it throws a transient D1 error', async () => {
    fixture.handler.mockImplementation(() => {
      throw transient();
    });
    expect((await fixture.invoke()).status).toBe(500);
    expect(fixture.query).toHaveBeenCalledTimes(1);
    expect(fixture.handler).toHaveBeenCalledTimes(1);
  });

  it.each([
    'DELETE FROM oauth2_consent',
    'DELETE FROM user',
    'UPDATE oauth2_client SET disabled = 1',
    'UPDATE session SET expires_at = 0',
  ])('still denies after recovery: %s', async (sql) => {
    fixture.sqlite.exec(sql);
    fixture.query.mockImplementationOnce(() => {
      throw transient();
    });
    const response = await fixture.invoke();
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('oauth-protected-resource');
    expect(fixture.query).toHaveBeenCalledTimes(2);
    expect(fixture.handler).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('does not retry a missing credential', async () => {
    fixture.sqlite.exec('DELETE FROM oauth2_consent');
    expect((await fixture.invoke()).status).toBe(401);
    expect(fixture.query).toHaveBeenCalledTimes(1);
  });

  it('checks expiry after the backoff rather than at request start', async () => {
    fixture.sqlite.prepare('UPDATE session SET expires_at = ?').run(Date.now() + 50);
    fixture.query.mockClear().mockImplementationOnce(() => {
      throw transient();
    });
    expect((await fixture.invoke()).status).toBe(401);
    expect(fixture.handler).not.toHaveBeenCalled();
  });

  it('re-reads revocation state if the grant disappears during backoff', async () => {
    fixture.query.mockImplementationOnce(() => {
      throw transient();
    });
    setTimeout(() => fixture.sqlite.exec('DELETE FROM oauth2_consent'), 50);
    expect((await fixture.invoke()).status).toBe(401);
    expect(fixture.handler).not.toHaveBeenCalled();
  });

  it('applies account policy after a recovered read', async () => {
    Object.assign(fixture.env, { BLOCKED_EMAILS: 'owner@test.local' });
    fixture.query.mockImplementationOnce(() => {
      throw transient();
    });
    expect((await fixture.invoke()).status).toBe(401);
    expect(fixture.handler).not.toHaveBeenCalled();
  });
});
