import { describe, expect, it } from 'vitest';
import { decrypt } from './crypto';
import { protectAccountTokens } from './account-tokens';
import { trustedOriginsForAuth } from './index';

const KEY = '11'.repeat(32);

describe('account token protection', () => {
  it('encrypts reusable Google tokens and drops the unneeded ID token', async () => {
    const protectedTokens = await protectAccountTokens(
      { accessToken: 'access', refreshToken: 'refresh', idToken: 'profile-jwt' },
      KEY,
    );

    await expect(decrypt(String(protectedTokens.accessToken), KEY)).resolves.toBe('access');
    await expect(decrypt(String(protectedTokens.refreshToken), KEY)).resolves.toBe('refresh');
    expect(protectedTokens.idToken).toBeNull();
  });

  it('does not trust localhost origins in production', () => {
    expect(trustedOriginsForAuth('https://antenna.example')).toEqual(['https://antenna.example']);
    expect(trustedOriginsForAuth('http://localhost:8787')).toEqual([
      'http://localhost:5173',
      'http://localhost:8787',
    ]);
    expect(trustedOriginsForAuth('http://127.0.0.1:8789')).toEqual([
      'http://localhost:5173',
      'http://localhost:8787',
      'http://127.0.0.1:8789',
    ]);
  });
});
