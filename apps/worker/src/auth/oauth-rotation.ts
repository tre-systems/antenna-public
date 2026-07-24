import { eq } from 'drizzle-orm';
import { db, type Env as DbEnv } from '../db/client';
import { oauthAccessToken } from '../db/schema';

export const refreshTokenBeingRotated = async (request: Request): Promise<string | null> => {
  if (request.method !== 'POST') return null;
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body: unknown = await request.json();
      if (!isRecord(body) || body.grant_type !== 'refresh_token') return null;
      return nonEmptyString(body.refresh_token);
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = new URLSearchParams(await request.text());
      if (body.get('grant_type') !== 'refresh_token') return null;
      return nonEmptyString(body.get('refresh_token'));
    }
  } catch {
    // Better Auth owns validation and the eventual error response.
  }
  return null;
};

export const retireRotatedOAuthGrant = async (
  env: DbEnv,
  oldRefreshToken: string,
): Promise<void> => {
  await db(env)
    .delete(oauthAccessToken)
    .where(eq(oauthAccessToken.refreshToken, oldRefreshToken))
    .run();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;
