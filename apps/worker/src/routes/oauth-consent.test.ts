import { drizzle } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import type { AuthVars, MiddlewareEnv } from '../auth/middleware';
import { setupOAuth, createAuthorizedGrant } from '../auth/oauth-provider-test-fixtures';
import { securityHeaders } from '../security-headers';
import { oauthConsentRoute } from './oauth-consent';

vi.mock('../db/client', () => ({
  db: (env: { DB: { __sqlite: ReturnType<typeof Database> } }) =>
    drizzle(env.DB.__sqlite, { schema }),
}));

const app = new Hono<{ Bindings: MiddlewareEnv; Variables: AuthVars }>()
  .use('*', securityHeaders())
  .route('/api/oauth', oauthConsentRoute);

describe('OAuth consent page', () => {
  it.each([
    ['allow', 'code='],
    ['deny', 'error=access_denied'],
  ])('continues a same-origin %s form without weakening form CSP', async (accept, callback) => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const response = await app.request(
      'https://antenna.test/api/oauth/consent',
      {
        method: 'POST',
        headers: {
          cookie: f.cookie,
          origin: 'https://antenna.test',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ oauth_query: grant.oauthQuery, accept }),
      },
      f.env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-security-policy')).toContain("form-action 'self'");
    expect(await response.text()).toContain(`href="https://client.test/callback?${callback}`);
  });

  it.each([undefined, 'null'])('rejects a browser form with Origin %s', async (origin) => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const headers = new Headers({
      cookie: f.cookie,
      'content-type': 'application/x-www-form-urlencoded',
    });
    if (origin !== undefined) headers.set('origin', origin);
    const response = await app.request(
      'https://antenna.test/api/oauth/consent',
      {
        method: 'POST',
        headers,
        body: new URLSearchParams({ oauth_query: grant.oauthQuery, accept: 'allow' }),
      },
      f.env,
    );
    expect(response.status).toBe(403);
  });

  it('shows verified client identity and permissions, requires deliberate consent, and rejects tampering', async () => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const url = `https://antenna.test/api/oauth/consent?${grant.oauthQuery}`;
    const response = await app.request(url, { headers: { cookie: f.cookie } }, f.env);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');
    const body = await response.text();
    expect(body).toContain('Connect Test agent');
    expect(body).toContain('read and change your owner-scoped');
    expect(body).toContain('Allow access');
    const tampered = new URL(url);
    tampered.searchParams.set('scope', 'antenna arbitrary');
    expect(
      (await app.request(tampered.toString(), { headers: { cookie: f.cookie } }, f.env)).status,
    ).toBe(400);
    expect((await app.request(url, {}, f.env)).status).toBe(401);
  });

  it('rejects cross-origin submissions and blocks disallowed users before consent', async () => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const request: RequestInit = {
      method: 'POST',
      headers: {
        cookie: f.cookie,
        origin: 'https://attacker.test',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ oauth_query: grant.oauthQuery, accept: 'allow' }),
    };
    expect(
      (await app.request('https://antenna.test/api/oauth/consent', request, f.env)).status,
    ).toBe(403);
    const blocked = { ...f.env, BLOCKED_EMAILS: 'owner@test.local' };
    expect(
      (
        await app.request(
          `https://antenna.test/api/oauth/consent?${grant.oauthQuery}`,
          { headers: { cookie: f.cookie } },
          blocked,
        )
      ).status,
    ).toBe(401);
  });
});
