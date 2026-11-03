import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { createAuth, type AuthEnv } from './index';

export const OAUTH_MIGRATION = readFileSync(
  fileURLToPath(String(new URL('../../drizzle/0004_oauth_provider.sql', import.meta.url))),
  'utf8',
);
export const OAUTH_BASE_DDL = `
CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL,
 email_verified INTEGER NOT NULL DEFAULT 1, image TEXT, created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL, first_seen_at INTEGER, onboarded_at INTEGER);
CREATE TABLE session (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT NOT NULL,
 expires_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE account (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_id TEXT NOT NULL,
 provider_id TEXT NOT NULL, access_token TEXT, refresh_token TEXT, id_token TEXT,
 access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE oauth_application (id TEXT PRIMARY KEY, client_id TEXT, disabled INTEGER);
CREATE TABLE oauth_access_token (id TEXT PRIMARY KEY, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER);
`;

export const setupOAuth = async () => {
  const sqlite = new Database(':memory:');
  sqlite.exec(OAUTH_BASE_DDL + OAUTH_MIGRATION);
  const client = drizzle(sqlite, { schema });
  client
    .insert(schema.user)
    .values({
      id: 'owner',
      email: 'owner@test.local',
      name: 'Owner',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .run();
  client
    .insert(schema.session)
    .values({
      id: 'session',
      userId: 'owner',
      token: 'session-secret',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();
  const env: AuthEnv = {
    DB: { __sqlite: sqlite } as unknown as D1Database,
    BETTER_AUTH_URL: 'https://antenna.test',
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    BETTER_AUTH_SECRET: 'test-better-auth-secret-please-ignore',
    ENCRYPTION_KEY: '0'.repeat(64),
  };
  const auth = createAuth(env);
  const name = (await auth.$context).authCookies.sessionToken.name;
  const signature = createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update('session-secret')
    .digest('base64');
  const cookie = `${name}=${encodeURIComponent(`session-secret.${signature}`)}`;
  const request = (path: string, init?: RequestInit) =>
    auth.handler(new Request(`https://antenna.test${path}`, init));
  return { sqlite, client, env, auth, cookie, request };
};

export const beginAuthorizedGrant = async (f: Awaited<ReturnType<typeof setupOAuth>>) => {
  const registered = await f.request('/api/auth/oauth2/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Test agent',
      redirect_uris: ['https://client.test/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
    }),
  });
  const client: { client_id: string } = await registered.json();
  if (!registered.ok) throw new Error(`Registration failed: ${JSON.stringify(client)}`);
  const verifier = 'a'.repeat(64);
  const challenge = btoa(
    String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
    ),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  const query = new URLSearchParams({
    client_id: client.client_id,
    response_type: 'code',
    redirect_uri: 'https://client.test/callback',
    scope: 'openid offline_access antenna',
    resource: 'https://antenna.test/api/mcp',
    state: 'test-state',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const authorized = await f.request(`/api/auth/oauth2/authorize?${query.toString()}`, {
    headers: { cookie: f.cookie, accept: 'text/html' },
  });
  const location = authorized.headers.get('location');
  if (!location) throw new Error(`Authorization failed: ${await authorized.text()}`);
  const consentUrl = new URL(location, 'https://antenna.test');
  const oauthQuery = consentUrl.search.slice(1);
  const consentResponse = await f.request('/api/auth/oauth2/consent', {
    method: 'POST',
    headers: {
      cookie: f.cookie,
      origin: 'https://antenna.test',
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
  });
  const consent: { url: string } = await consentResponse.json();
  if (!consentResponse.ok) throw new Error(`Consent failed: ${JSON.stringify(consent)}`);
  const code = new URL(consent.url).searchParams.get('code');
  if (!code) throw new Error('Authorization returned no code');
  const exchange = (body: Record<string, string>) =>
    f.request('/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
  return { clientId: client.client_id, exchange, oauthQuery, code, verifier };
};

export const createAuthorizedGrant = async (f: Awaited<ReturnType<typeof setupOAuth>>) => {
  const grant = await beginAuthorizedGrant(f);
  const response = await grant.exchange({
    grant_type: 'authorization_code',
    client_id: grant.clientId,
    redirect_uri: 'https://client.test/callback',
    code_verifier: grant.verifier,
    code: grant.code,
    resource: 'https://antenna.test/api/mcp',
  });
  const tokens: { access_token: string; refresh_token: string } = await response.json();
  if (!response.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);
  return { ...grant, tokens };
};
