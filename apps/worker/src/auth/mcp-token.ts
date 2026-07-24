import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { mcpTokens, oauthAccessToken, oauthApplication, user } from '../db/schema';
import type { SessionUser } from './middleware';

export const TOKEN_PREFIX = 'pbk_';

export type McpTokenAuthResult = {
  readonly tokenId: string;
  readonly user: SessionUser;
};

type TokenDb = Pick<Db, 'select' | 'update'>;

export async function hashMcpToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return hex(new Uint8Array(digest));
}

// Any bearer value (not just `pbk_`). Used to recognize OAuth access tokens,
// which the `mcp` plugin issues as random, non-prefixed strings.
export function extractBearerToken(value: string | null): string | null {
  if (value === null) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  const token = match?.[1]?.trim() ?? '';
  return token.length > 0 ? token : null;
}

export async function authenticateMcpToken(
  client: TokenDb,
  token: string,
): Promise<McpTokenAuthResult | null> {
  const tokenHash = await hashMcpToken(token);
  const [row] = await client
    .select({
      tokenId: mcpTokens.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    })
    .from(mcpTokens)
    .innerJoin(user, eq(user.id, mcpTokens.userId))
    .where(and(eq(mcpTokens.tokenHash, tokenHash), isNull(mcpTokens.revokedAt)))
    .limit(1)
    .all();

  if (row === undefined) return null;

  await client
    .update(mcpTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpTokens.id, row.tokenId))
    .run();

  return {
    tokenId: row.tokenId,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name.length > 0 ? row.name : row.email,
      image: row.image,
    },
  };
}

// OAuth access tokens issued by the Better Auth `mcp` plugin (random, non-`pbk_`),
// stored in `oauth_access_token`. We validate by lookup AND enforce expiry —
// the plugin's own getMcpSession does NOT check `access_token_expires_at`, so an
// expired token would otherwise be accepted.
export async function authenticateOAuthToken(
  client: TokenDb,
  token: string,
): Promise<{ readonly user: SessionUser } | null> {
  const [row] = await client
    .select({
      userId: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      expiresAt: oauthAccessToken.accessTokenExpiresAt,
    })
    .from(oauthAccessToken)
    .innerJoin(user, eq(user.id, oauthAccessToken.userId))
    .innerJoin(oauthApplication, eq(oauthApplication.clientId, oauthAccessToken.clientId))
    .where(and(eq(oauthAccessToken.accessToken, token), eq(oauthApplication.disabled, false)))
    .limit(1)
    .all();

  if (row === undefined) return null;
  // `access_token_expires_at` is NOT NULL, so it is always a Date here.
  if (row.expiresAt.getTime() <= Date.now()) return null;

  return {
    user: {
      id: row.userId,
      email: row.email,
      name: row.name.length > 0 ? row.name : row.email,
      image: row.image,
    },
  };
}

// Resolve any MCP bearer to a user: `pbk_` → the long-lived token table; any other
// value → an OAuth access token. Shared by the API session middleware and the
// /api/mcp transport gate so both accept the same credentials.
export async function authenticateBearer(
  client: TokenDb,
  token: string,
): Promise<{ readonly user: SessionUser } | null> {
  if (token.startsWith(TOKEN_PREFIX)) {
    const result = await authenticateMcpToken(client, token);
    return result === null ? null : { user: result.user };
  }
  return authenticateOAuthToken(client, token);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
