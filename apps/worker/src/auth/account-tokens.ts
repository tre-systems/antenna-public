import { encrypt } from './crypto';

// Encrypt Google tokens before Better Auth persists them.
export const protectAccountTokens = async (
  incoming: Record<string, unknown>,
  key: string,
): Promise<Record<string, unknown>> => {
  const next: Record<string, unknown> = { ...incoming };
  if (typeof incoming.accessToken === 'string' && incoming.accessToken.length > 0) {
    next.accessToken = await encrypt(incoming.accessToken, key);
  }
  if (typeof incoming.refreshToken === 'string' && incoming.refreshToken.length > 0) {
    next.refreshToken = await encrypt(incoming.refreshToken, key);
  }
  // Drop the unused Google ID token and its profile claims.
  if ('idToken' in incoming) next.idToken = null;
  return next;
};
