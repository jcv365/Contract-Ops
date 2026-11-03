import { describe, it, expect } from 'vitest';
import { assemble, UnknownAwardedPointsError } from './types';

describe('assemble', () => {
  it('sums points and max across components', () => {
    const result = assemble([
      { name: 'a', points: 5, max: 10, evidence: 'x', known: true },
      { name: 'b', points: 3, max: 5, evidence: 'y', known: true },
    ]);
    expect(result.score).toBe(8);
    expect(result.max).toBe(15);
  });

  it('lists unknown components without reducing the max', () => {
    const result = assemble([
      { name: 'a', points: 5, max: 10, evidence: 'x', known: true },
      { name: 'b', points: 0, max: 15, evidence: 'no evidence', known: false },
    ]);
    expect(result.unknowns).toEqual(['b']);
    expect(result.max).toBe(25);
    expect(result.score).toBe(5);
  });

  // §82/§83/§84: "do not award points for unknown information" — enforced
  // structurally, not just by convention.
  it('throws if a component marked unknown was given nonzero points', () => {
    expect(() => assemble([{ name: 'bad', points: 5, max: 10, evidence: '', known: false }])).toThrow(UnknownAwardedPointsError);
  });

  it('an empty component list scores 0/0', () => {
    const result = assemble([]);
    expect(result).toEqual({ score: 0, max: 0, components: [], unknowns: [] });
  });
});
