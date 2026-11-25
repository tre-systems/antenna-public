import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import * as schema from '../db/schema';
import type { AuthVars } from '../auth/middleware';
import { createSignalMutationRateLimit } from './public-read-rate-limit';
import { buildApp, seedBaseline, setup } from './signals-test-fixtures';
import { loadDueDispatchRows } from '../cron/dispatch/due';
import type { Client } from '../cron/dispatch/types';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

describe('refresh abuse controls', () => {
  it('retains cooldown and retry gates across configuration changes', async () => {
    const { db, env } = setup();
    seedBaseline(db);
    const now = Date.now();
    db.insert(schema.signalStatus)
      .values({
        signalId: 'b1',
        status: 'error',
        lastManualRequestAt: new Date(now - 1000),
        updatedAt: new Date(now),
        nextAttemptAt: new Date(now + 3600000),
        lastOkAt: new Date(now - 5000),
      })
      .run();
    const app = buildApp();
    const patch = await app.request(
      '/api/signals/b1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: { quote: 'GBP' } }),
      },
      env,
    );
    expect(patch.status).toBe(200);
    const refresh = await app.request('/api/signals/b1/refresh', { method: 'POST' }, env);
    expect(refresh.status).toBe(429);
    expect(db.select().from(schema.signalStatus).get()).toMatchObject({
      status: 'loading',
      lastOkAt: null,
      nextAttemptAt: new Date(now + 3600000),
      lastManualRequestAt: new Date(now - 1000),
      updatedAt: new Date(now),
    });
    expect(await loadDueDispatchRows(db as unknown as Client, now)).toEqual([]);
  });

  it('shares the owner mutation budget across signals, methods and client IPs', async () => {
    const app = new Hono<{ Variables: AuthVars }>();
    app.use('*', async (c, next) => {
      c.set('user', {
        id: c.req.header('test-owner') ?? 'owner-a',
        email: 'test@example.test',
        name: 'Test',
      });
      await next();
    });
    app.use('*', createSignalMutationRateLimit({ maxRequests: 2, now: () => 1000 }));
    app.all('*', (c) => c.json({ ok: true }));
    expect((await app.request('/a', { method: 'PATCH' })).status).toBe(200);
    expect((await app.request('/b/refresh', { method: 'POST' })).status).toBe(200);
    expect(
      (await app.request('/c', { method: 'PATCH', headers: { 'CF-Connecting-IP': '192.0.2.3' } }))
        .status,
    ).toBe(429);
    expect(
      (await app.request('/d', { method: 'PATCH', headers: { 'test-owner': 'owner-b' } })).status,
    ).toBe(200);
  });
});
