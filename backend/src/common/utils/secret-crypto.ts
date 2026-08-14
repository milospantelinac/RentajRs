import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM at-rest encryption for secrets we must be able to read back
 * (NestPay Store Key / API password) — unlike password hashing, these aren't
 * one-way, since the actual value has to be sent to NestPay on every
 * checkout/callback. Never logged, never returned to the frontend in
 * plaintext (see PaymentSettingsService).
 *
 * Output format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext).
 */

const ALGORITHM = 'aes-256-gcm';

function resolveKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('PAYMENT_ENCRYPTION_KEY is not set — required to store NestPay secrets');
  }
  const key = raw.includes('/') || raw.includes('+') || raw.endsWith('=') ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('PAYMENT_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret payload');
  }
  const key = resolveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
