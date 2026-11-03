import { drizzle } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { McpOAuthConnectionRecord } from '@antenna/shared';
import type { AuthVars } from '../auth/middleware';
import { authenticateOAuthRequest } from '../auth/oauth-access';
import { setupOAuth, createAuthorizedGrant } from '../auth/oauth-provider-test-fixtures';
import * as schema from '../db/schema';
import { mcpConnectionsRoute } from './mcp-connections';

vi.mock('../db/client', () => ({
  db: (env: { DB: { __sqlite: ReturnType<typeof Database> } }) =>
    drizzle(env.DB.__sqlite, { schema }),
}));

const buildApp = (owner = 'owner') => {
  const app = new Hono<{ Variables: AuthVars }>();
  app.use('*', async (c, next) => {
    c.set('user', { id: owner, email: 'owner@test.local', name: 'Owner' });
    await next();
  });
  app.route('/api/mcp-connections', mcpConnectionsRoute);
  return app;
};

describe('/api/mcp-connections', () => {
  it('lists owner-scoped consents and refresh expiry without inventing a JWT expiry', async () => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const response = await buildApp().request('/api/mcp-connections', {}, f.env);
    const body: McpOAuthConnectionRecord[] = await response.json();
    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      client_id: grant.clientId,
      name: 'Test agent',
      access_expires_at: null,
      scopes: ['antenna', 'offline_access', 'openid'],
    });
    expect(body[0]?.refresh_expires_at).toBeGreaterThan(Date.now());
    const other = await buildApp('other').request('/api/mcp-connections', {}, f.env);
    await expect(other.json()).resolves.toEqual([]);
    f.client
      .update(schema.oauthClient)
      .set({ disabled: true })
      .where(eq(schema.oauthClient.clientId, grant.clientId))
      .run();
    const disabled = await buildApp().request('/api/mcp-connections', {}, f.env);
    await expect(disabled.json()).resolves.toEqual([]);
  });

  it('disconnects only this owner and immediately denies the signed JWT and refresh token', async () => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const consent = f.client.select().from(schema.oauth2Consent).get();
    expect(consent).toBeDefined();
    if (!consent) throw new Error('Expected a test consent');
    f.client
      .insert(schema.user)
      .values({
        id: 'other',
        email: 'other@test.local',
        name: 'Other',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    f.client
      .insert(schema.oauth2Consent)
      .values({ ...consent, id: 'other-consent', userId: 'other' })
      .run();
    const response = await buildApp().request(
      `/api/mcp-connections/${grant.clientId}`,
      { method: 'DELETE' },
      f.env,
    );
    expect(response.status).toBe(200);
    expect(
      f.client
        .select()
        .from(schema.oauth2Consent)
        .all()
        .map((r) => r.id),
    ).toEqual(['other-consent']);
    expect(f.client.select().from(schema.oauth2RefreshToken).all()).toEqual([]);
    await expect(authenticateOAuthRequest(f.env, grant.tokens.access_token)).resolves.toBeNull();
    const refresh = await grant.exchange({
      grant_type: 'refresh_token',
      client_id: grant.clientId,
      refresh_token: grant.tokens.refresh_token,
      resource: 'https://antenna.test/api/mcp',
    });
    expect(refresh.status).toBe(400);
  });

  it('does not disclose or revoke another owner connection', async () => {
    const f = await setupOAuth(),
      grant = await createAuthorizedGrant(f);
    const response = await buildApp('other').request(
      `/api/mcp-connections/${grant.clientId}`,
      { method: 'DELETE' },
      f.env,
    );
    expect(response.status).toBe(404);
    expect((await authenticateOAuthRequest(f.env, grant.tokens.access_token))?.user.id).toBe(
      'owner',
    );
  });
});
