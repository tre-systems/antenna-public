import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

// Fixed test keys — never used in real environments. Generated once with
// `openssl rand -hex 32`. Two different keys so we can prove cross-key
// decrypt actually fails (rather than coincidentally succeeding).
const KEY_A = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const KEY_B = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('auth/crypto', () => {
  it('round-trips an ASCII plaintext', async () => {
    const plain = 'ya29.a0Ad52N3-fake-refresh-token-value';
    const ct = await encrypt(plain, KEY_A);
    expect(ct).not.toBe(plain);
    expect(ct.split('.').length).toBe(2);
    const out = await decrypt(ct, KEY_A);
    expect(out).toBe(plain);
  });

  it('round-trips unicode and emoji', async () => {
    const plain = 'héllo 🌍 — naïve string';
    const ct = await encrypt(plain, KEY_A);
    expect(await decrypt(ct, KEY_A)).toBe(plain);
  });

  it('produces a different ciphertext per call (fresh IV)', async () => {
    const a = await encrypt('same input', KEY_A);
    const b = await encrypt('same input', KEY_A);
    expect(a).not.toBe(b);
  });

  it('rejects decryption under the wrong key', async () => {
    const ct = await encrypt('secret', KEY_A);
    await expect(decrypt(ct, KEY_B)).rejects.toThrow();
  });

  it('rejects malformed ciphertext', async () => {
    await expect(decrypt('not-base64-and-no-dot', KEY_A)).rejects.toThrow();
    await expect(decrypt('only-one-part.', KEY_A)).rejects.toThrow();
    await expect(decrypt('.only-the-second-part', KEY_A)).rejects.toThrow();
  });

  it('rejects malformed key', async () => {
    await expect(encrypt('x', 'too-short')).rejects.toThrow();
    await expect(encrypt('x', 'z'.repeat(64))).rejects.toThrow();
  });
});
