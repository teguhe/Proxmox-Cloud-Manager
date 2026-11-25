import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../src/utils/crypto.js';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('AES-256-GCM Crypto Utility', () => {
  it('encrypts and decrypts a secret round-trip', () => {
    const secret = 'pve-super-secret-token-12345!@#';
    const encrypted = encryptSecret(secret, TEST_KEY);

    expect(encrypted).not.toBe(secret);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptSecret(encrypted, TEST_KEY);
    expect(decrypted).toBe(secret);
  });

  it('produces different ciphertexts for the same plaintext due to random IV', () => {
    const secret = 'same-secret-value';
    const enc1 = encryptSecret(secret, TEST_KEY);
    const enc2 = encryptSecret(secret, TEST_KEY);

    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1, TEST_KEY)).toBe(secret);
    expect(decryptSecret(enc2, TEST_KEY)).toBe(secret);
  });

  it('throws on tampered ciphertext or authTag', () => {
    const encrypted = encryptSecret('my-secret', TEST_KEY);
    const [iv, tag, cipher] = encrypted.split(':');
    const tamperedCipher = `${cipher?.slice(0, -2)}ff`;

    expect(() => decryptSecret(`${iv}:${tag}:${tamperedCipher}`, TEST_KEY)).toThrow();
  });

  it('throws on invalid key length', () => {
    expect(() => encryptSecret('test', 'short-key')).toThrow(/64-character hex string/);
  });
});
