import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { AuthVars } from '../auth/middleware';
import * as schema from '../db/schema';
import { signalsRoute } from './signals';
import { collectionsRoute } from './collections';
import { alertsRoute } from './alerts';
import { setup, seedBaseline, OWNER_1 } from './signals-test-fixtures';

vi.mock('../db/client', async () => (await import('./routes-test-fixtures')).inMemoryDbClient());

const arrange = () => {
  const { db, env } = setup();
  seedBaseline(db);
  db.update(schema.signals)
    .set({ templateId: 'cloudflare-analytics' })
    .where(eq(schema.signals.id, 'b1'))
    .run();
  db.insert(schema.signalPoints)
    .values({
      signalId: 'b1',
      fetchedAt: new Date(),
      observedAt: new Date(),
      metricKey: 'requests',
      value: 987654,
    })
    .run();
  db.insert(schema.signalAlerts)
    .values({
      id: 'a1',
      collectionId: 'collection-1',
      signalId: 'b1',
      ruleId: 'r',
      ruleLabel: 'Private',
      metricKey: 'requests',
      observedAt: new Date(),
      triggeredAt: new Date(),
      value: 987654,
      previousValue: 1,
    })
    .run();
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('*', async (c, next) => {
    c.set('user', OWNER_1);
    await next();
  });
  app.route('/api/signals', signalsRoute);
  app.route('/api/collections', collectionsRoute);
  app.route('/api/alerts', alertsRoute);
  return { app, env };
};

describe('deployment data read boundary', () => {
  it.each(['/api/signals', '/api/collections/collection-1', '/api/alerts'])(
    'hides previously stored deployment data from non-admins at %s',
    async (path) => {
      const { app, env } = arrange();
      const response = await app.request(path, undefined, env);
      expect(response.status).toBe(200);
      expect(await response.text()).not.toContain('987654');
    },
  );
  it.each(['/api/signals/b1', '/api/signals/b1/history'])(
    'denies direct access at %s',
    async (path) => {
      const { app, env } = arrange();
      expect((await app.request(path, undefined, env)).status).toBe(404);
    },
  );
  it('retains administrator access to saved snapshots', async () => {
    const { app, env } = arrange();
    const response = await app.request('/api/signals/b1', undefined, {
      ...env,
      ADMIN_EMAILS: OWNER_1.email,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('987654');
  });
  it.each([
    ['PATCH', '/api/signals/b1'],
    ['POST', '/api/signals/b1/refresh'],
  ])('rejects non-admin %s at %s without returning private config', async (method, path) => {
    const { app, env } = arrange();
    const response = await app.request(path, { method, body: '{"refresh_seconds":3600}' }, env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });
});
