import { Hono, type Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { apiBodyLimit } from './api-body-limit';

describe('API request size limit', () => {
  it.each([true, false])(
    'rejects oversized bodies before dispatch (declared length: %s)',
    async (declared) => {
      const handler = vi.fn((c: Context) => c.json({ ok: true }));
      const app = new Hono().use('/api/*', apiBodyLimit()).post('/api/plan', handler);
      const body = 'x'.repeat(256 * 1024 + 1);
      const headers: HeadersInit = declared ? { 'content-length': String(body.length) } : {};
      const response = await app.request('/api/plan', { method: 'POST', body, headers });
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: 'invalid_body' });
      expect(handler).not.toHaveBeenCalled();
    },
  );
  it('leaves an accepted streamed body readable by JSON handlers', async () => {
    const app = new Hono()
      .use('/api/*', apiBodyLimit())
      .post('/api/plan', async (c) => c.text(await c.req.text()));
    const response = await app.request('/api/plan', {
      method: 'POST',
      body: '{"prompt":"weather"}',
    });
    expect(await response.json()).toEqual({ prompt: 'weather' });
  });
});
