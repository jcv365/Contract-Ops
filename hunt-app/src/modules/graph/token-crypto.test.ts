import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from './token-crypto';

const KEY = 'a'.repeat(32); // env.ts requires exactly 32 bytes

describe('token-crypto', () => {
  it('round-trips a token through encrypt/decrypt', () => {
    const plaintext = 'ey.some.jwt.access.token';
    const encrypted = encryptToken(plaintext, KEY);
    expect(decryptToken(encrypted, KEY)).toBe(plaintext);
  });

  it('never stores the plaintext token in the encrypted output', () => {
    const plaintext = 'super-secret-access-token-value';
    const encrypted = encryptToken(plaintext, KEY);
    expect(encrypted).not.toContain(plaintext);
  });

  it('produces different ciphertext for the same plaintext on each call (random IV)', () => {
    const a = encryptToken('same-token', KEY);
    const b = encryptToken('same-token', KEY);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key rather than returning garbage silently', () => {
    const encrypted = encryptToken('token', KEY);
    const wrongKey = 'b'.repeat(32);
    expect(() => decryptToken(encrypted, wrongKey)).toThrow();
  });
});
