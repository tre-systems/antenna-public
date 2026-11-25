import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { requireUser, type AuthVars, type MiddlewareEnv } from './middleware';
import { setupOAuth } from './oauth-provider-test-fixtures';

vi.mock('../db/client', () => ({
  db: (env: { DB: { __sqlite: ReturnType<typeof Database> } }) =>
    drizzle(env.DB.__sqlite, { schema }),
}));

const setup = async () => {
  const { sqlite, env, cookie } = await setupOAuth();
  const reached = vi.fn();
  const failed = vi.fn();
  const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>();
  app.onError((e, c) => {
    failed(e);
    return c.body(null, 500);
  });
  app.use('/api/*', requireUser());
  app.get('/api/signals', (c) => {
    reached(c.get('user').id);
    return c.body(null, 200);
  });
  const request = (extra: Partial<MiddlewareEnv> = {}) =>
    app.request('/api/signals', { headers: { cookie } }, { ...env, ...extra });
  return { sqlite, request, reached, failed };
};

const sessionRead = /^select\b.*\bfrom "session"/i;
const sessionWrite = /^update "session"/i;
const internal = () => new Error('D1_ERROR: internal error');

// Inject failures below the real Better Auth adapter, using a synthetic session in memory.
function intercept(sqlite: ReturnType<typeof Database>, match: RegExp, effect: () => void) {
  const prepare = sqlite.prepare.bind(sqlite);
  vi.spyOn(sqlite, 'prepare').mockImplementation((sql) => {
    if (match.test(sql)) effect();
    return prepare(sql);
  });
}

describe('cookie authentication on a protected route', () => {
  it('recovers a transient session SELECT and invokes the handler once', async () => {
    const f = await setup();
    const reads = vi.fn().mockImplementationOnce(() => {
      throw internal();
    });
    intercept(f.sqlite, sessionRead, reads);
    expect((await f.request()).status).toBe(200);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(f.reached.mock.calls).toEqual([['owner']]);
    expect(f.failed).not.toHaveBeenCalled();
  });

  it.each(['removed', 'expired', 'blocked'] as const)(
    'keeps access denied after recovery: %s',
    async (state) => {
      const f = await setup();
      const reads = vi.fn().mockImplementationOnce(() => {
        if (state === 'removed') f.sqlite.exec('DELETE FROM session');
        if (state === 'expired') f.sqlite.exec('UPDATE session SET expires_at = 0');
        throw internal();
      });
      intercept(f.sqlite, sessionRead, reads);
      expect(
        (await f.request(state === 'blocked' ? { BLOCKED_EMAILS: 'owner@test.local' } : {})).status,
      ).toBe(401);
      // Better Auth can also read the expired record while cleaning it up.
      expect(reads.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(f.reached).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['persistent session read', sessionRead, internal, 3],
    ['schema', sessionRead, () => new Error('D1_ERROR: no such table'), 1],
    ['session renewal write', sessionWrite, internal, 1],
  ] as const)(
    'propagates a %s failure without admitting the request',
    async (_, match, cause, attempts) => {
      const f = await setup();
      const failures = vi.fn(() => {
        throw cause();
      });
      intercept(f.sqlite, match, failures);
      expect((await f.request()).status).toBe(500);
      expect(failures).toHaveBeenCalledTimes(attempts);
      expect(f.failed).toHaveBeenCalledOnce();
      expect(f.reached).not.toHaveBeenCalled();
    },
  );
});
