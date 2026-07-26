// AES-GCM for the OAuth tokens on the `account` row. Key is 64 hex chars
// (`openssl rand -hex 32`); output is `${ivBase64}.${ciphertextBase64}` with a
// fresh 12-byte IV per encrypt, per NIST SP 800-38D.

const IV_BYTES = 12;
const HEX_KEY_LENGTH = 64;

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length !== HEX_KEY_LENGTH) {
    throw new Error(`encryption key must be ${HEX_KEY_LENGTH} hex chars (got ${hex.length})`);
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('encryption key must be hex');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
};

const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
};

const importKey = async (hexKey: string): Promise<CryptoKey> => {
  const raw = hexToBytes(hexKey);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

export const encrypt = async (plaintext: string, hexKey: string): Promise<string> => {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
};

export const decrypt = async (packed: string, hexKey: string): Promise<string> => {
  const parts = packed.split('.');
  if (parts.length !== 2) {
    throw new Error('ciphertext must be "<ivBase64>.<ciphertextBase64>"');
  }
  const ivB64 = parts[0];
  const ctB64 = parts[1];
  if (!ivB64 || !ctB64) {
    throw new Error('ciphertext components must be non-empty');
  }
  const iv = base64ToBytes(ivB64);
  if (iv.length !== IV_BYTES) {
    throw new Error(`iv must decode to ${IV_BYTES} bytes`);
  }
  const ct = base64ToBytes(ctB64);
  const key = await importKey(hexKey);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plaintext);
};
