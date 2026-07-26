import { encrypt } from './crypto';

// Encrypts Google's tokens at rest before Better Auth persists them. Shared by the
// account create/update `before` hooks so the two paths stay identical.
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
  // The app never reads Google's ID token after sign-in, so this extra
  // bearer-like JWT and its profile claims are not retained in D1.
  if ('idToken' in incoming) next.idToken = null;
  return next;
};
