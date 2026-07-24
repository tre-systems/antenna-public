// Hono middleware that gates the JSON API behind a Better Auth session.
//
// The session cookie is read from the incoming request headers; BA's
// `getSession` does the heavy lifting. When BYPASS_AUTH is set in a
// non-production environment we short-circuit with a synthetic user so the
// Playwright e2e suite doesn't need real Google credentials.

import type { Context, MiddlewareHandler } from 'hono';
import { db } from '../db/client';
import { err } from '../routes/http';
import { createAuth, ensureUserCollection, parseWhitelist, type AuthEnv } from './index';
import { authenticateBearer, extractBearerToken } from './mcp-token';

export type SessionUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image?: string | null;
};

export type AuthVars = {
  readonly user: SessionUser;
};

export type MiddlewareEnv = AuthEnv & {
  readonly NODE_ENV?: string;
  readonly BYPASS_AUTH?: string;
};

const E2E_USER: SessionUser = {
  id: 'e2e-user',
  email: 'e2e@test.local',
  name: 'E2E Test User',
  image: null,
};

const isBypassActive = (env: MiddlewareEnv): boolean =>
  env.BYPASS_AUTH === '1' && env.NODE_ENV !== undefined && env.NODE_ENV !== 'production';

const hasSessionCookie = (headers: Headers): boolean => {
  const cookie = headers.get('cookie');
  return cookie !== null && cookie.trim().length > 0;
};

export const requireUser =
  (): MiddlewareHandler<{ Bindings: MiddlewareEnv; Variables: AuthVars }> => async (c, next) => {
    if (isBypassActive(c.env)) {
      await ensureUserCollection(db(c.env), E2E_USER.id, c.env.DB);
      c.set('user', E2E_USER);
      await next();
      return;
    }

    const bearerToken = extractBearerToken(c.req.raw.headers.get('authorization'));
    if (bearerToken !== null) {
      // `pbk_` → long-lived MCP token; any other bearer → OAuth access token
      // (mcp plugin), validated with expiry. Both resolve to an owner-scoped user.
      const result = await authenticateBearer(db(c.env), bearerToken);
      if (result === null || !emailAllowed(c.env, result.user.email)) return unauthorized(c);
      c.set('user', result.user);
      await next();
      return;
    }

    if (!hasSessionCookie(c.req.raw.headers)) {
      return unauthorized(c);
    }

    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return unauthorized(c);
    }
    const u = session.user;
    if (!emailAllowed(c.env, u.email)) return unauthorized(c);
    c.set('user', {
      id: u.id,
      email: u.email,
      // BA's User.name is `string` but can be empty for some providers — fall
      // back to email so the UI never shows a blank greeting.
      name: u.name.length > 0 ? u.name : u.email,
      image: normalizeImage(u.image),
    });
    await next();
    return;
  };

export const getUser = (
  c: Context<{ Bindings: MiddlewareEnv; Variables: AuthVars }>,
): SessionUser => c.get('user');

const normalizeImage = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const emailAllowed = (env: MiddlewareEnv, email: string): boolean =>
  parseWhitelist(env.ALLOWED_EMAILS).has(email.trim().toLowerCase());

const unauthorized = (c: Context<{ Bindings: MiddlewareEnv; Variables: AuthVars }>): Response => {
  if (c.req.path === '/api/mcp' || c.req.path.startsWith('/api/mcp/')) {
    const resourceMetadata = `${new URL(c.req.url).origin}/.well-known/oauth-protected-resource`;
    c.header('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}"`);
  }
  return err(c, 'unauthorized', 401);
};
