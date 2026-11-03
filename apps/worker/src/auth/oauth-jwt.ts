import { createLocalJWKSet, errors, jwtVerify, type JWTPayload } from 'jose';
import { createAuth, type AuthEnv } from './index';
import { oauthOrigin } from './oauth-provider';

export const verifyOAuthJwt = async (env: AuthEnv, token: string): Promise<JWTPayload | null> => {
  if (token.split('.').length !== 3) return null;
  const origin = oauthOrigin(env.BETTER_AUTH_URL);
  // Initial JWKS access may create a signing key, so it must not use the read-only retry.
  const keys = await createAuth(env).api.getJwks();
  try {
    const { payload } = await jwtVerify(token, createLocalJWKSet(keys), {
      issuer: `${origin}/api/auth`,
      audience: `${origin}/api/mcp`,
      algorithms: ['EdDSA'],
      typ: 'at+jwt',
      requiredClaims: ['exp', 'iat', 'sub', 'azp', 'scope', 'antenna_grant', 'antenna_session'],
    });
    return payload.cnf === undefined ? payload : null;
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
};
