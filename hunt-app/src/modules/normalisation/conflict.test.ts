import { describe, it, expect } from 'vitest';
import { detectConflict } from './conflict';

const now = new Date().toISOString();

describe('detectConflict', () => {
  it('flags a genuine disagreement between two different sources', () => {
    const a = { value: 500, source: 'jobicy', retrievedAt: now };
    const b = { value: 650, source: 'jobscollider', retrievedAt: now };
    expect(detectConflict(a, b)).toBe(true);
  });

  it('does not flag agreement between two sources', () => {
    const a = { value: 'USD', source: 'jobicy', retrievedAt: now };
    const b = { value: 'USD', source: 'jobscollider', retrievedAt: now };
    expect(detectConflict(a, b)).toBe(false);
  });

  it('does not flag a missing value on either side as a conflict (that is a gap, not a disagreement)', () => {
    const a = { value: null, source: 'jobicy', retrievedAt: now };
    const b = { value: 650, source: 'jobscollider', retrievedAt: now };
    expect(detectConflict(a, b)).toBe(false);
    expect(detectConflict(b, a)).toBe(false);
  });

  it('does not flag the same source re-supplying an updated value as a conflict', () => {
    const a = { value: 500, source: 'jobicy', retrievedAt: now };
    const b = { value: 650, source: 'jobicy', retrievedAt: now };
    expect(detectConflict(a, b)).toBe(false);
  });
});
