import { describe, expect, it } from 'vitest';
import { minimizeAccountTokens, trustedOriginsForAuth } from './index';

describe('account token protection', () => {
  it('drops Google bearer values that the application does not use', () => {
    const protectedTokens = minimizeAccountTokens({
      accountId: 'google-subject',
      accessToken: 'access',
      refreshToken: 'refresh',
      idToken: 'profile-jwt',
      accessTokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
    });

    expect(protectedTokens).toMatchObject({
      accountId: 'google-subject',
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    });
  });

  it('does not trust localhost origins in production', () => {
    expect(trustedOriginsForAuth('https://antenna.example')).toEqual(['https://antenna.example']);
    expect(trustedOriginsForAuth('http://localhost:8787')).toEqual([
      'http://localhost:5173',
      'http://localhost:8787',
    ]);
  });
});
