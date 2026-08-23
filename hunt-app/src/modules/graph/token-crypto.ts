import crypto from 'node:crypto';

// docs-pack/docs/09/14: "Encrypt tokens at rest." AES-256-GCM with a
// random IV per encryption and the auth tag appended — standard
// authenticated encryption, not a custom scheme. ENCRYPTION_KEY must be
// exactly 32 bytes (enforced by env.ts's zod schema, z.string().length(32)).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encryptToken(plaintext: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(encryptionKey, 'utf-8'), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptToken(encoded: string, encryptionKey: string): string {
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(encryptionKey, 'utf-8'), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf-8');
}
