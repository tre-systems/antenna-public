import { drizzle } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { authenticateOAuthRequest } from './oauth-access';
import { createAuthorizedGrant, setupOAuth } from './oauth-provider-test-fixtures';
import { activeOAuthGrantClaims } from './oauth-grant-claims';

vi.mock('../db/client', () => ({
  db: (env: { DB: { __sqlite: ReturnType<typeof Database> } }) =>
    drizzle(env.DB.__sqlite, { schema }),
}));

describe('OAuth refresh uses the same live grant as MCP access', () => {
  it('does not disguise database failures as an expired authorization', async () => {
    const f = await setupOAuth();
    const { adapter: storage } = await f.auth.$context;
    const failure = new Error('Database unavailable');
    vi.spyOn(storage, 'findOne').mockRejectedValueOnce(failure);
    await expect(
      activeOAuthGrantClaims(storage, 'owner', 'client', 'session', 'https://antenna.test/api/mcp'),
    ).rejects.toBe(failure);
  });

  it('refreshes without repeating the resource and keeps a valid owner-bound token', async () => {
    const f = await setupOAuth();
    const grant = await createAuthorizedGrant(f);
    const response = await grant.exchange({
      grant_type: 'refresh_token',
      client_id: grant.clientId,
      refresh_token: grant.tokens.refresh_token,
    });
    expect(response.status).toBe(200);
    const next: { access_token: string } = await response.json();
    expect((await authenticateOAuthRequest(f.env, next.access_token))?.user.id).toBe('owner');
  });

  it.each([
    'expired session',
    'missing session',
    'different owner',
    'missing consent',
    'removed scope',
    'removed resource',
  ])('rejects issuance for %s instead of returning an unusable token', async (reason) => {
    const f = await setupOAuth();
    const grant = await createAuthorizedGrant(f);
    if (reason === 'expired session') f.sqlite.exec('UPDATE session SET expires_at = 0');
    if (reason === 'missing session') f.sqlite.exec('DELETE FROM session');
    if (reason === 'different owner') f.sqlite.exec("UPDATE session SET user_id = 'other'");
    if (reason === 'missing consent') f.sqlite.exec('DELETE FROM oauth2_consent');
    if (reason === 'removed scope') f.sqlite.exec("UPDATE oauth2_consent SET scopes = '[]'");
    if (reason === 'removed resource') f.sqlite.exec("UPDATE oauth2_consent SET resources = '[]'");
    expect(await authenticateOAuthRequest(f.env, grant.tokens.access_token)).toBeNull();
    const before = f.client.select().from(schema.oauth2RefreshToken).all();
    const response = await grant.exchange({
      grant_type: 'refresh_token',
      client_id: grant.clientId,
      refresh_token: grant.tokens.refresh_token,
      resource: 'https://antenna.test/api/mcp',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_grant' });
    expect(f.client.select().from(schema.oauth2RefreshToken).all()).toEqual(before);
  });
});
