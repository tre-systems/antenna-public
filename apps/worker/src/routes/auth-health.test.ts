import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthVars } from '../auth/middleware';
import { authHealthRoute } from './auth-health';

describe('GET /api/healthz', () => {
  it('returns a lightweight authenticated API health response', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T10:00:00Z'));

    const app = new Hono<{ Variables: AuthVars }>();
    app.use('/api/*', async (c, next) => {
      c.set('user', { id: 'u1', email: 'u1@test', name: 'User' });
      await next();
    });
    app.route('/api/healthz', authHealthRoute);

    const res = await app.request('/api/healthz');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      authenticated: true,
      ts: Date.parse('2026-07-06T10:00:00Z'),
    });

    vi.useRealTimers();
  });
});
