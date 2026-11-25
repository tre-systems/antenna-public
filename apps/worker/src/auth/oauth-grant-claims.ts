import type { DBAdapter, Session } from 'better-auth';
import { APIError } from 'better-auth/api';

type Consent = { id: string; scopes: string[]; resources: string[] | null };

const invalidGrant = () =>
  new APIError('BAD_REQUEST', {
    error: 'invalid_grant',
    error_description: 'The authorization is no longer active. Reconnect the client.',
  });

/** Refuse unusable credentials before the provider signs or rotates tokens. */
export const activeOAuthGrantClaims = async (
  storage: Pick<DBAdapter, 'findOne'>,
  userId: string | undefined,
  clientId: string,
  sessionId: string | undefined,
  resource: string,
) => {
  if (!userId || !sessionId) throw invalidGrant();
  const [session, consent] = await Promise.all([
    storage.findOne<Session>({
      model: 'session',
      where: [
        { field: 'id', value: sessionId },
        { field: 'userId', value: userId },
      ],
    }),
    storage.findOne<Consent>({
      model: 'oauthConsent',
      where: [
        { field: 'userId', value: userId },
        { field: 'clientId', value: clientId },
      ],
    }),
  ]);
  if (
    !session ||
    !(session.expiresAt.getTime() > Date.now()) ||
    !consent?.scopes.includes('antenna') ||
    !consent.resources?.includes(resource)
  )
    throw invalidGrant();
  return { antenna_grant: consent.id, antenna_session: sessionId };
};
