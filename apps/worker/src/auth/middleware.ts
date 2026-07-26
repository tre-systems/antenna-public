// Gates the JSON API behind a Better Auth session, an MCP token, or — outside
// production, with BYPASS_AUTH set — a synthetic user for the Playwright suite.

import type { Context, MiddlewareHandler } from 'hono';
import { db } from '../db/client';
import { err } from '../routes/http';
import { accessRules, emailPermitted } from './access';
import { ensureUserCollection } from './ensure-user-collection';
import { createAuth, type AuthEnv } from './index';
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
      if (result === null || !permitted(c.env, result.user.email)) return unauthorized(c);
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
    if (!permitted(c.env, u.email)) return unauthorized(c);
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

const normalizeImage = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Checked on every browser-session and bearer-token request, so adding an
// Checked on every browser-session and bearer-token request, so adding an
// address to BLOCKED_EMAILS, or removing one from a configured ALLOWED_EMAILS,
// cuts off live sessions and MCP tokens immediately rather than at next sign-in.
const permitted = (env: MiddlewareEnv, email: string): boolean =>
  emailPermitted(accessRules(env), email);

const unauthorized = (c: Context<{ Bindings: MiddlewareEnv; Variables: AuthVars }>): Response => {
  if (c.req.path === '/api/mcp' || c.req.path.startsWith('/api/mcp/')) {
    const resourceMetadata = `${new URL(c.req.url).origin}/.well-known/oauth-protected-resource`;
    c.header('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}"`);
  }
  return err(c, 'unauthorized', 401);
};
