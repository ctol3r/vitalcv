import { createCipheriv, randomBytes } from 'crypto';

export interface EncryptionResult {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptPassportPayload(payload: Buffer, key: Buffer): EncryptionResult {
  if (key.length !== 32) {
    throw new Error('Passport encryption key must be 32 bytes (256-bit)');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

