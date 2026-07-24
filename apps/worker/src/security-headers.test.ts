import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, securityHeaders } from './security-headers';

const buildApp = () => {
  const app = new Hono();
  app.use('*', securityHeaders());
  app.get('/', (c) => c.html('<h1>Antenna</h1>'));
  app.get('/api/private', (c) => c.json({ ok: true }));
  return app;
};

describe('securityHeaders', () => {
  it('sets a restrictive browser security baseline', async () => {
    const response = await buildApp().request('/');

    expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups');
    expect(response.headers.get('permissions-policy')).toContain('microphone=()');
  });

  it('prevents authenticated and token API responses from being cached', async () => {
    const response = await buildApp().request('/api/private');

    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('keeps the inline theme bootstrap hash in sync with index.html', () => {
    const indexHtml = readFileSync(
      fileURLToPath(String(new URL('../../web/index.html', import.meta.url))),
      'utf8',
    );
    const openTag = '<script>';
    const start = indexHtml.indexOf(openTag);
    const end = indexHtml.indexOf('</script>', start + openTag.length);
    const script =
      start === -1 || end === -1 ? undefined : indexHtml.slice(start + openTag.length, end);
    expect(script).toBeDefined();
    const hash = createHash('sha256')
      .update(script ?? '')
      .digest('base64');

    expect(CONTENT_SECURITY_POLICY).toContain(`'sha256-${hash}'`);
  });

  it('keeps Cloudflare Static Assets on the same CSP', () => {
    const staticHeaders = readFileSync(
      fileURLToPath(String(new URL('../../web/public/_headers', import.meta.url))),
      'utf8',
    );

    expect(staticHeaders).toContain(`Content-Security-Policy: ${CONTENT_SECURITY_POLICY}`);
    expect(staticHeaders).toContain(
      'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    );
    expect(staticHeaders).toContain('X-Frame-Options: DENY');
  });
});
