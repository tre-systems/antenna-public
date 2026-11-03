import { and, eq } from 'drizzle-orm';
import type { JWTPayload } from 'jose';
import { db } from '../db/client';
import { parseStringArray } from '../db/codecs';
import { oauthClient, oauth2Consent, session, user } from '../db/schema';
import type { AuthEnv } from './index';
import type { SessionUser } from './middleware';
import { oauthOrigin } from './oauth-provider';
import { retryOAuthRead } from './oauth-read-retry';
import { verifyOAuthJwt } from './oauth-jwt';

export const authenticateOAuthRequest = async (
  env: AuthEnv,
  token: string,
): Promise<{ readonly user: SessionUser } | null> => {
  const claims = await verifyOAuthJwt(env, token);
  if (!claims || !validOwnerClaims(claims)) return null;
  const [row] = await retryOAuthRead(() => loadOAuthOwner(env, claims));
  if (!row || row.expiresAt.getTime() <= Date.now() || Number(claims.exp) * 1000 <= Date.now()) {
    return null;
  }
  const resource = `${oauthOrigin(env.BETTER_AUTH_URL)}/api/mcp`;
  if (
    !parseStringArray(row.scopes)?.includes('antenna') ||
    !parseStringArray(row.resources)?.includes(resource)
  )
    return null;
  return { user: { id: row.id, email: row.email, name: row.name || row.email, image: row.image } };
};

const validOwnerClaims = (claims: JWTPayload): boolean =>
  ['sub', 'azp', 'antenna_grant', 'antenna_session'].every(
    (key) => typeof claims[key] === 'string',
  ) &&
  typeof claims.scope === 'string' &&
  claims.scope.split(' ').includes('antenna');

const loadOAuthOwner = (env: AuthEnv, claims: JWTPayload) =>
  db(env)
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      expiresAt: session.expiresAt,
      scopes: oauth2Consent.scopes,
      resources: oauth2Consent.resources,
    })
    .from(oauth2Consent)
    .innerJoin(user, eq(user.id, oauth2Consent.userId))
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauth2Consent.clientId))
    .innerJoin(
      session,
      and(eq(session.userId, user.id), eq(session.id, String(claims.antenna_session))),
    )
    .where(
      and(
        eq(user.id, String(claims.sub)),
        eq(oauthClient.clientId, String(claims.azp)),
        eq(oauthClient.disabled, false),
        eq(oauth2Consent.id, String(claims.antenna_grant)),
      ),
    )
    .limit(1)
    .all();
