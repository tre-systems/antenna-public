import { drizzle } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import * as schema from '../db/schema';
import { authenticateOAuthRequest } from './oauth-access';
import {
  setupOAuth,
  createAuthorizedGrant,
  beginAuthorizedGrant,
} from './oauth-provider-test-fixtures';
import { verifyOAuthJwt } from './oauth-jwt';

vi.mock('../db/client', () => ({
  db: (env: { DB: { __sqlite: ReturnType<typeof Database> } }) =>
    drizzle(env.DB.__sqlite, { schema }),
}));

describe('resource-bound OAuth provider', () => {
  it('rejects an incorrect PKCE verifier and a replayed authorization code', async () => {
    const f = await setupOAuth();
    try {
      const pending = await beginAuthorizedGrant(f);
      const wrongProof = await pending.exchange({
        grant_type: 'authorization_code',
        client_id: pending.clientId,
        redirect_uri: 'https://client.test/callback',
        code_verifier: 'b'.repeat(64),
        code: pending.code,
        resource: 'https://antenna.test/api/mcp',
      });
      expect(wrongProof.status).toBe(400);
      const completed = await createAuthorizedGrant(f);
      const replay = await completed.exchange({
        grant_type: 'authorization_code',
        client_id: completed.clientId,
        redirect_uri: 'https://client.test/callback',
        code_verifier: completed.verifier,
        code: completed.code,
        resource: 'https://antenna.test/api/mcp',
      });
      expect(replay.status).toBe(400);
    } finally {
      f.sqlite.close();
    }
  });

  it('rechecks live permissions, resource, client, session and consent for a signed token', async () => {
    const f = await setupOAuth();
    try {
      const grant = await createAuthorizedGrant(f);
      const check = () => authenticateOAuthRequest(f.env, grant.tokens.access_token);
      expect((await check())?.user.id).toBe('owner');
      f.client
        .update(schema.oauth2Consent)
        .set({ scopes: ['openid'] })
        .run();
      expect(await check()).toBeNull();
      f.client
        .update(schema.oauth2Consent)
        .set({ scopes: ['antenna'], resources: ['https://other.test/api/mcp'] })
        .run();
      expect(await check()).toBeNull();
      f.client
        .update(schema.oauth2Consent)
        .set({ resources: ['https://antenna.test/api/mcp'] })
        .run();
      f.client.update(schema.oauthClient).set({ disabled: true }).run();
      expect(await check()).toBeNull();
      f.client.update(schema.oauthClient).set({ disabled: false }).run();
      f.client
        .update(schema.session)
        .set({ expiresAt: new Date(0) })
        .run();
      expect(await check()).toBeNull();
      f.client
        .update(schema.session)
        .set({ expiresAt: new Date(Date.now() + 60000) })
        .run();
      expect((await check())?.user.id).toBe('owner');
      f.client.delete(schema.oauth2Consent).run();
      expect(await check()).toBeNull();
    } finally {
      f.sqlite.close();
    }
  });

  it('publishes the new issuer, registration and resource metadata', async () => {
    const f = await setupOAuth();
    const metadata = await f.request('/.well-known/oauth-authorization-server/api/auth');
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toMatchObject({
      issuer: 'https://antenna.test/api/auth',
      authorization_endpoint: 'https://antenna.test/api/auth/oauth2/authorize',
      token_endpoint: 'https://antenna.test/api/auth/oauth2/token',
      registration_endpoint: 'https://antenna.test/api/auth/oauth2/register',
    });
    const resource = await f.request('/.well-known/oauth-protected-resource/api/mcp');
    await expect(resource.json()).resolves.toMatchObject({
      resource: 'https://antenna.test/api/mcp',
      scopes_supported: ['antenna'],
    });
    expect((await f.request('/api/auth/token')).status).toBe(404);
    expect((await f.request('/api/auth/mcp/token', { method: 'POST' })).status).toBe(404);
  });

  it('runs registration, PKCE, consent, token verification and strict refresh rotation', async () => {
    const fixture = await setupOAuth();
    const grant = await createAuthorizedGrant(fixture);
    const authenticated = await authenticateOAuthRequest(fixture.env, grant.tokens.access_token);
    expect(authenticated?.user.id).toBe('owner');
    const rows = fixture.client.select().from(schema.oauth2RefreshToken).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token).not.toBe(grant.tokens.refresh_token);
    const response = await grant.exchange({
      grant_type: 'refresh_token',
      client_id: grant.clientId,
      refresh_token: grant.tokens.refresh_token,
      resource: 'https://antenna.test/api/mcp',
    });
    const next: { access_token: string; refresh_token: string } = await response.json();
    expect(response.status).toBe(200);
    expect(next.refresh_token).not.toBe(grant.tokens.refresh_token);
    expect((await authenticateOAuthRequest(fixture.env, next.access_token))?.user.id).toBe('owner');
    const replay = await grant.exchange({
      grant_type: 'refresh_token',
      client_id: grant.clientId,
      refresh_token: grant.tokens.refresh_token,
      resource: 'https://antenna.test/api/mcp',
    });
    expect(replay.status).toBe(400);
  });

  it('checks signatures, issuer, audience, expiry, access-token type and required claims', async () => {
    const f = await setupOAuth();
    const keys = await generateKeyPair('EdDSA');
    f.client
      .insert(schema.jwks)
      .values({
        id: 'test-key',
        publicKey: JSON.stringify(await exportJWK(keys.publicKey)),
        privateKey: 'unused',
        alg: 'EdDSA',
        crv: 'Ed25519',
        createdAt: new Date(),
      })
      .run();
    const base = {
      sub: 'owner',
      azp: 'client',
      scope: 'antenna',
      antenna_grant: 'grant',
      antenna_session: 'session',
      iss: 'https://antenna.test/api/auth',
      aud: 'https://antenna.test/api/mcp',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const sign = (patch: Record<string, unknown> = {}, typ = 'at+jwt') =>
      new SignJWT({ ...base, ...patch })
        .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key', typ })
        .sign(keys.privateKey);
    expect(await verifyOAuthJwt(f.env, await sign())).toMatchObject({ sub: 'owner' });
    for (const patch of [
      { iss: 'https://attacker.test' },
      { aud: 'https://other.test/api/mcp' },
      { exp: 1 },
      { antenna_grant: undefined },
      { cnf: { jkt: 'sender-bound' } },
    ]) {
      await expect(verifyOAuthJwt(f.env, await sign(patch))).resolves.toBeNull();
    }
    await expect(verifyOAuthJwt(f.env, await sign({}, 'JWT'))).resolves.toBeNull();
    await expect(verifyOAuthJwt(f.env, 'retired-plaintext-token')).resolves.toBeNull();
    const parts = (await sign()).split('.');
    parts[1] = btoa(JSON.stringify({ ...base, sub: 'other-owner' }))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '');
    await expect(verifyOAuthJwt(f.env, parts.join('.'))).resolves.toBeNull();
  });
});
