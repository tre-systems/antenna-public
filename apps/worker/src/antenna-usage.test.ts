import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { recordAntennaUsage } from './antenna-usage';
import type { WorkerEnv } from './env';
import type { AuthVars } from './auth/middleware';

describe('recordAntennaUsage', () => {
  it('records successful product actions without identifiers or request content', async () => {
    const writeDataPoint = vi.fn();
    const app = new Hono<{ Bindings: WorkerEnv; Variables: AuthVars }>();
    app.use('*', recordAntennaUsage());
    app.post('/api/plan/:id/confirm', (c) => c.json({ ok: true }));

    const response = await app.request(
      '/api/plan/private-plan/confirm',
      { method: 'POST' },
      {
        APP_USAGE: { writeDataPoint },
      },
    );

    expect(response.status).toBe(200);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['antenna'],
      blobs: ['plan_confirmed'],
      doubles: [1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain('private-plan');
  });

  it('does not record failed or ordinary read requests', async () => {
    const writeDataPoint = vi.fn();
    const app = new Hono<{ Bindings: WorkerEnv; Variables: AuthVars }>();
    app.use('*', recordAntennaUsage());
    app.post('/api/signals/:id/refresh', (c) => c.text('no', 409));
    app.get('/api/signals', (c) => c.json([]));
    const env = { APP_USAGE: { writeDataPoint } } as unknown as WorkerEnv;
    await app.request('/api/signals/a/refresh', { method: 'POST' }, env);
    await app.request('/api/signals', {}, env);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
