import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AuthVars } from '../auth/middleware';
import { RateLimiter } from '../do/rate-limiter';
import {
  createAuthOAuthCallbackRateLimit,
  createAuthOAuthStartRateLimit,
  createMcpRegisterRateLimit,
  createPlanCreateRateLimit,
  createPublicReadRateLimit,
  createPublicReportRateLimit,
} from './public-read-rate-limit';

const buildApp = (opts: Parameters<typeof createPublicReadRateLimit>[0]): Hono => {
  const app = new Hono();
  app.use('*', createPublicReadRateLimit(opts));
  app.get('/api/public/collections/:slug', (c) => c.json({ ok: true }));
  return app;
};

// Minimal in-process DurableObjectNamespace: maps each id name to a single
// RateLimiter instance, so two "isolates" sharing this namespace funnel a key's
// requests through one authoritative counter — what the real DO does globally.
const fakeRateLimiterNamespace = (): DurableObjectNamespace => {
  const instances = new Map<string, RateLimiter>();
  const instanceFor = (name: string): RateLimiter => {
    const existing = instances.get(name);
    if (existing) return existing;
    const created = new RateLimiter({} as DurableObjectState, {});
    instances.set(name, created);
    return created;
  };
  return {
    idFromName: (name: string) => ({ name }) as unknown as DurableObjectId,
    get: (id: DurableObjectId) => {
      const instance = instanceFor((id as unknown as { name: string }).name);
      return {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          instance.fetch(new Request(input, init)),
      } as unknown as DurableObjectStub;
    },
  } as unknown as DurableObjectNamespace;
};

describe('createPublicReadRateLimit', () => {
  it('limits repeated anonymous public reads until the window resets', async () => {
    let now = 1_000;
    const app = buildApp({ maxRequests: 2, now: () => now });

    const first = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const second = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const third = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    now += 60_001;
    const afterReset = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });

    expect(first.status).toBe(200);
    expect(first.headers.get('X-RateLimit-Remaining')).toBe('1');
    expect(second.status).toBe(200);
    expect(second.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(third.status).toBe(429);
    expect(third.headers.get('Retry-After')).toBe('60');
    expect(await third.json()).toEqual({
      error: 'rate_limited',
      retry_after_seconds: 60,
      limit: 2,
      reset_at: 61,
    });
    expect(afterReset.status).toBe(200);
    expect(afterReset.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  it('enforces a shared limit across isolates when a Durable Object namespace is bound', async () => {
    let now = 1_000;
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() };
    // Two independent middlewares = two isolates, each with its own in-memory
    // Map, but both pointed at the same DO namespace.
    const isolateA = buildApp({ maxRequests: 2, now: () => now });
    const isolateB = buildApp({ maxRequests: 2, now: () => now });
    const headers = { 'CF-Connecting-IP': '203.0.113.10' };

    const a1 = await isolateA.request('/api/public/collections/example', { headers }, env);
    const b1 = await isolateB.request('/api/public/collections/example', { headers }, env);
    const a2 = await isolateA.request('/api/public/collections/example', { headers }, env);

    expect(a1.status).toBe(200);
    expect(a1.headers.get('X-RateLimit-Remaining')).toBe('1');
    // Second hit lands on the *other* isolate yet still decrements the shared
    // budget — a per-isolate Map would have reported '1' here.
    expect(b1.status).toBe(200);
    expect(b1.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(a2.status).toBe(429);

    // The window reset is global too: advancing past it frees the shared budget.
    now += 60_001;
    const afterReset = await isolateB.request('/api/public/collections/example', { headers }, env);
    expect(afterReset.status).toBe(200);
    expect(afterReset.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  it('tracks callers separately by connecting IP', async () => {
    const app = buildApp({ maxRequests: 1, now: () => 10_000 });

    const first = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const sameIp = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const differentIp = await app.request('/api/public/collections/example', {
      headers: { 'CF-Connecting-IP': '203.0.113.11' },
    });

    expect(first.status).toBe(200);
    expect(sameIp.status).toBe(429);
    expect(differentIp.status).toBe(200);
  });

  it('caps stored buckets even when no bucket has expired', async () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    const app = buildApp({
      maxRequests: 10,
      maxBuckets: 2,
      now: () => 10_000,
      store,
    });

    for (const ip of ['203.0.113.10', '203.0.113.11', '203.0.113.12']) {
      const res = await app.request('/api/public/collections/example', {
        headers: { 'CF-Connecting-IP': ip },
      });
      expect(res.status).toBe(200);
    }

    expect(store.size).toBe(2);
    expect([...store.keys()]).toEqual(['public-read:203.0.113.11', 'public-read:203.0.113.12']);
  });

  it('uses the first forwarded IP when Cloudflare does not provide one', async () => {
    const app = buildApp({ maxRequests: 1, now: () => 10_000 });

    const first = await app.request('/api/public/collections/example', {
      headers: { 'X-Forwarded-For': '203.0.113.10, 198.51.100.20' },
    });
    const second = await app.request('/api/public/collections/example', {
      headers: { 'X-Forwarded-For': '203.0.113.10, 198.51.100.20' },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it('can split public reads from public report submissions', async () => {
    const app = new Hono();
    const isReport = (c: { readonly req: { readonly method: string; readonly path: string } }) =>
      c.req.method === 'POST' && c.req.path.endsWith('/report');
    app.use(
      '*',
      createPublicReportRateLimit({ maxRequests: 1, now: () => 10_000, shouldLimit: isReport }),
    );
    app.use(
      '*',
      createPublicReadRateLimit({
        maxRequests: 1,
        now: () => 10_000,
        shouldLimit: (c) => !isReport(c),
      }),
    );
    app.get('/api/public/collections/example', (c) => c.json({ ok: true }));
    app.post('/api/public/collections/example/report', (c) => c.json({ ok: true }));

    const headers = { 'CF-Connecting-IP': '203.0.113.10' };
    const read = await app.request('/api/public/collections/example', { headers });
    const firstReport = await app.request('/api/public/collections/example/report', {
      method: 'POST',
      headers,
    });
    const secondReport = await app.request('/api/public/collections/example/report', {
      method: 'POST',
      headers,
    });

    expect(read.status).toBe(200);
    expect(firstReport.status).toBe(200);
    expect(secondReport.status).toBe(429);
    expect(secondReport.headers.get('X-RateLimit-Limit')).toBe('1');
  });

  it('can split OAuth starts and callbacks while leaving other auth routes alone', async () => {
    const app = new Hono();
    const isStart = (c: { readonly req: { readonly path: string } }) =>
      c.req.path.startsWith('/api/auth/sign-in/');
    const isCallback = (c: { readonly req: { readonly path: string } }) =>
      c.req.path.startsWith('/api/auth/callback/');
    app.use(
      '*',
      createAuthOAuthStartRateLimit({ maxRequests: 1, now: () => 10_000, shouldLimit: isStart }),
    );
    app.use(
      '*',
      createAuthOAuthCallbackRateLimit({
        maxRequests: 1,
        now: () => 10_000,
        shouldLimit: isCallback,
      }),
    );
    app.get('/api/auth/sign-in/google', (c) => c.json({ ok: true }));
    app.get('/api/auth/callback/google', (c) => c.json({ ok: true }));
    app.get('/api/auth/get-session', (c) => c.json({ ok: true }));

    const headers = { 'CF-Connecting-IP': '203.0.113.10' };
    const firstStart = await app.request('/api/auth/sign-in/google', { headers });
    const secondStart = await app.request('/api/auth/sign-in/google', { headers });
    const firstCallback = await app.request('/api/auth/callback/google', { headers });
    const secondCallback = await app.request('/api/auth/callback/google', { headers });
    const session = await app.request('/api/auth/get-session', { headers });

    expect(firstStart.status).toBe(200);
    expect(secondStart.status).toBe(429);
    expect(firstCallback.status).toBe(200);
    expect(secondCallback.status).toBe(429);
    expect(session.status).toBe(200);
    expect(firstStart.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(firstCallback.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(session.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('rate-limits anonymous MCP client registration while leaving other auth routes alone', async () => {
    const app = new Hono();
    const isRegister = (c: { readonly req: { readonly method: string; readonly path: string } }) =>
      c.req.method === 'POST' && c.req.path.startsWith('/api/auth/mcp/register');
    app.use(
      '*',
      createMcpRegisterRateLimit({ maxRequests: 1, now: () => 10_000, shouldLimit: isRegister }),
    );
    app.post('/api/auth/mcp/register', (c) => c.json({ ok: true }));
    app.get('/api/auth/mcp/register', (c) => c.json({ ok: true }));
    app.get('/api/auth/get-session', (c) => c.json({ ok: true }));

    const headers = { 'CF-Connecting-IP': '203.0.113.10' };
    const first = await app.request('/api/auth/mcp/register', { method: 'POST', headers });
    const second = await app.request('/api/auth/mcp/register', { method: 'POST', headers });
    // A GET to the same path is not a registration attempt, so it is untouched.
    const getReg = await app.request('/api/auth/mcp/register', { headers });
    const session = await app.request('/api/auth/get-session', { headers });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(getReg.status).toBe(200);
    expect(session.status).toBe(200);
    expect(first.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(session.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('can limit authenticated plan creation by user while leaving other plan routes alone', async () => {
    const app = new Hono<{ Variables: AuthVars }>();
    app.use('*', async (c, next) => {
      const id = c.req.header('X-Test-User') ?? 'u1';
      c.set('user', { id, email: `${id}@test.local`, name: id });
      await next();
    });
    const isPlanCreate = (c: {
      readonly req: { readonly method: string; readonly path: string };
    }) => c.req.method === 'POST' && c.req.path === '/api/plan';
    app.use(
      '*',
      createPlanCreateRateLimit({
        maxRequests: 1,
        now: () => 10_000,
        shouldLimit: isPlanCreate,
      }),
    );
    app.post('/api/plan', (c) => c.json({ ok: true }));
    app.get('/api/plan/:id', (c) => c.json({ ok: true }));
    app.post('/api/plan/:id/confirm', (c) => c.json({ ok: true }));

    const first = await app.request('/api/plan', { method: 'POST' });
    const second = await app.request('/api/plan', { method: 'POST' });
    const otherUser = await app.request('/api/plan', {
      method: 'POST',
      headers: { 'X-Test-User': 'u2' },
    });
    const read = await app.request('/api/plan/p1');
    const confirm = await app.request('/api/plan/p1/confirm', { method: 'POST' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({
      error: 'rate_limited',
      retry_after_seconds: 600,
      limit: 1,
      reset_at: 610,
    });
    expect(otherUser.status).toBe(200);
    expect(read.status).toBe(200);
    expect(confirm.status).toBe(200);
    expect(read.headers.get('X-RateLimit-Limit')).toBeNull();
  });
});
