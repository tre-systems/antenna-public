import { and, eq, lte, notExists } from 'drizzle-orm';
import { db, type Env as DbEnv } from '../db/client';
import {
  oauthClient,
  oauthClientAssertion,
  oauth2AccessToken,
  oauth2RefreshToken,
  oauth2Consent,
} from '../db/schema';

export const cleanupOAuthProviderState = async (env: DbEnv, now: number): Promise<void> => {
  const client = db(env),
    before = new Date(now);
  await client.delete(oauth2AccessToken).where(lte(oauth2AccessToken.expiresAt, before)).run();
  await client.delete(oauth2RefreshToken).where(lte(oauth2RefreshToken.expiresAt, before)).run();
  await client
    .delete(oauthClientAssertion)
    .where(lte(oauthClientAssertion.expiresAt, before))
    .run();
  await client
    .delete(oauthClient)
    .where(
      and(
        lte(oauthClient.createdAt, new Date(now - 30 * 86400000)),
        notExists(
          client
            .select({ id: oauth2Consent.id })
            .from(oauth2Consent)
            .where(eq(oauth2Consent.clientId, oauthClient.clientId)),
        ),
        notExists(
          client
            .select({ id: oauth2RefreshToken.id })
            .from(oauth2RefreshToken)
            .where(eq(oauth2RefreshToken.clientId, oauthClient.clientId)),
        ),
        notExists(
          client
            .select({ id: oauth2AccessToken.id })
            .from(oauth2AccessToken)
            .where(eq(oauth2AccessToken.clientId, oauthClient.clientId)),
        ),
      ),
    )
    .run();
};
