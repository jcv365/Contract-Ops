import { describe, it, expect } from 'vitest';
import { constantTimeEquals } from './constant-time';

describe('constantTimeEquals', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEquals('secret-value', 'secret-value')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(constantTimeEquals('secret-value', 'secret-valuf')).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(constantTimeEquals('short', 'a-much-longer-string')).toBe(false);
  });

  it('returns false comparing against an empty string', () => {
    expect(constantTimeEquals('', 'nonempty')).toBe(false);
  });
});
