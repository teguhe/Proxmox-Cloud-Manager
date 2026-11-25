import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(hexKey?: string): Buffer {
  const keyHex = hexKey ?? process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns `iv:authTag:ciphertext` encoded in hex.
 */
export function encryptSecret(plaintext: string, hexKey?: string): string {
  const key = getEncryptionKey(hexKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts `iv:authTag:ciphertext` (hex) using AES-256-GCM.
 */
export function decryptSecret(payload: string, hexKey?: string): string {
  const key = getEncryptionKey(hexKey);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted payload components');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
