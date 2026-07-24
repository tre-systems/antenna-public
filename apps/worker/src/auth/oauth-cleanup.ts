import { and, eq, lte, notExists } from 'drizzle-orm';
import { db, type Env as DbEnv } from '../db/client';
import { oauthAccessToken, oauthApplication, oauthConsent } from '../db/schema';

const STALE_APPLICATION_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export const shouldRunOAuthCleanup = (now: number): boolean => {
  const date = new Date(now);
  return date.getUTCMinutes() === 17;
};

export const cleanupExpiredOAuthState = async (env: DbEnv, now = Date.now()): Promise<void> => {
  const client = db(env);
  await client
    .delete(oauthAccessToken)
    .where(lte(oauthAccessToken.refreshTokenExpiresAt, new Date(now)))
    .run();

  const staleBefore = new Date(now - STALE_APPLICATION_AGE_MS);
  await client
    .delete(oauthApplication)
    .where(
      and(
        lte(oauthApplication.createdAt, staleBefore),
        notExists(
          client
            .select({ id: oauthAccessToken.id })
            .from(oauthAccessToken)
            .where(eq(oauthAccessToken.clientId, oauthApplication.clientId)),
        ),
        notExists(
          client
            .select({ id: oauthConsent.id })
            .from(oauthConsent)
            .where(eq(oauthConsent.clientId, oauthApplication.clientId)),
        ),
      ),
    )
    .run();
};
