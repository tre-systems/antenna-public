import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AuthVars, MiddlewareEnv } from './middleware';

// `./index` and `./ensure-user-collection` are stubbed so the middleware test
// needs neither Better Auth's runtime initialisation nor a database.
const mockGetSession = vi.fn();
const mockEnsureUserCollection = vi.fn();
const mockAuthenticateBearer = vi.fn();
vi.mock('./index', () => ({
  createAuth: (_env: unknown) => ({
    api: { getSession: mockGetSession },
  }),
}));
vi.mock('./ensure-user-collection', () => ({
  ensureUserCollection: mockEnsureUserCollection,
}));
vi.mock('./mcp-token', () => ({
  authenticateBearer: mockAuthenticateBearer,
  extractBearerToken: (value: string | null) => {
    const match = /^Bearer\s+(.+)$/i.exec(value?.trim() ?? '');
    return match?.[1]?.trim() || null;
  },
}));

// Import the middleware *after* the mock is registered so that the bound
// reference inside the module uses our mocked createAuth.
const { requireUser } = await import('./middleware');

type TestEnv = MiddlewareEnv;

const baseEnv: TestEnv = {
  DB: {} as D1Database,
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'x',
  BETTER_AUTH_SECRET: 'x',
  ENCRYPTION_KEY: '0'.repeat(64),
};

const buildApp = () => {
  const app = new Hono<{ Bindings: TestEnv; Variables: AuthVars }>();
  app.use('/api/*', requireUser());
  app.get('/api/me', (c) => c.json(c.get('user')));
  return app;
};

const invoke = async (env: TestEnv, headers?: Record<string, string>, path = '/api/me') => {
  const app = buildApp();
  return app.request(path, { headers: headers ?? {} }, env);
};

describe('auth/middleware', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockEnsureUserCollection.mockReset();
    mockAuthenticateBearer.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when there is no session', async () => {
    const res = await invoke(baseEnv);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('returns 401 when the session cookie is invalid', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await invoke(baseEnv, { cookie: 'better-auth.session=bad' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('passes through and sets c.var.user when a session exists', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1', email: 'member@example.com', name: 'team member' },
      session: { id: 's1' },
    });
    const res = await invoke(baseEnv, { cookie: 'better-auth.session=abc' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'u1',
      email: 'member@example.com',
      name: 'team member',
      image: null,
    });
  });

  // Blocking is enforced per request, so it cuts off a live cookie session
  // rather than waiting for the next sign-in.
  it('revokes an existing session when its email is blocked', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1', email: 'blocked@example.com', name: 'Blocked' },
      session: { id: 's1' },
    });

    const res = await invoke(
      { ...baseEnv, BLOCKED_EMAILS: 'blocked@example.com' },
      { cookie: 'better-auth.session=abc' },
    );

    expect(res.status).toBe(401);
  });

  it('revokes bearer access when its user is blocked', async () => {
    mockAuthenticateBearer.mockResolvedValueOnce({
      user: { id: 'u1', email: 'blocked@example.com', name: 'Blocked', image: null },
    });

    const res = await invoke(
      { ...baseEnv, BLOCKED_EMAILS: 'blocked@example.com' },
      { authorization: 'Bearer pbk_live' },
    );

    expect(res.status).toBe(401);
  });

  it('revokes an existing session when a configured allowlist no longer covers it', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u1', email: 'ex-member@example.com', name: 'Ex' },
      session: { id: 's1' },
    });

    const res = await invoke(
      { ...baseEnv, ALLOWED_EMAILS: 'someone-else@example.com' },
      { cookie: 'better-auth.session=abc' },
    );

    expect(res.status).toBe(401);
  });

  it('admits a brand-new account that nobody has heard of before', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u9', email: 'stranger@example.com', name: 'Stranger' },
      session: { id: 's9' },
    });

    const res = await invoke(baseEnv, { cookie: 'better-auth.session=abc' });

    expect(res.status).toBe(200);
  });

  it('accepts bearer access for a user who is not blocked', async () => {
    mockAuthenticateBearer.mockResolvedValueOnce({
      user: { id: 'u1', email: 'user@test.local', name: 'User', image: null },
    });

    const res = await invoke(baseEnv, { authorization: 'Bearer pbk_live' });

    expect(res.status).toBe(200);
  });

  it('advertises OAuth metadata when MCP authentication fails', async () => {
    const app = new Hono<{ Bindings: TestEnv; Variables: AuthVars }>();
    app.use('/api/*', requireUser());
    app.post('/api/mcp', (c) => c.json({ ok: true }));

    const res = await app.request('/api/mcp', { method: 'POST' }, baseEnv);

    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="http://localhost/.well-known/oauth-protected-resource"',
    );
  });

  it('falls back to email when BA returns an empty `name`', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'u2', email: 'anon@example.com', name: '' },
      session: { id: 's2' },
    });
    const res = await invoke(baseEnv, { cookie: 'better-auth.session=abc' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'u2',
      email: 'anon@example.com',
      name: 'anon@example.com',
      image: null,
    });
  });

  it('honours BYPASS_AUTH=1 when NODE_ENV is not production', async () => {
    const env: TestEnv = { ...baseEnv, BYPASS_AUTH: '1', NODE_ENV: 'development' };
    const res = await invoke(env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'e2e-user',
      email: 'e2e@test.local',
      name: 'E2E Test User',
      image: null,
    });
    // getSession must NOT have been called — the whole point of bypass.
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockEnsureUserCollection).toHaveBeenCalledTimes(1);
  });

  it('ignores BYPASS_AUTH=1 when NODE_ENV is production', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const env: TestEnv = { ...baseEnv, BYPASS_AUTH: '1', NODE_ENV: 'production' };
    const res = await invoke(env, { cookie: 'better-auth.session=abc' });
    expect(res.status).toBe(401);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('ignores BYPASS_AUTH=1 when NODE_ENV is missing', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const env: TestEnv = { ...baseEnv, BYPASS_AUTH: '1' };
    const res = await invoke(env, { cookie: 'better-auth.session=abc' });
    expect(res.status).toBe(401);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockEnsureUserCollection).not.toHaveBeenCalled();
  });
});
