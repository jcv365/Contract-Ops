import { describe, it, expect } from 'vitest';
import { computeCoveragePercent } from './service';

describe('computeCoveragePercent', () => {
  it('is 100 when every configured source succeeded', () => {
    expect(computeCoveragePercent(['jobicy', 'jobscollider'], ['jobicy', 'jobscollider'])).toBe(100);
  });

  // docs-pack/docs/25: coverage must drop when a source fails — this is
  // the core "operational, not conceptual" guarantee for the coverage
  // number specifically.
  it('drops when a configured source fails', () => {
    expect(computeCoveragePercent(['jobicy', 'jobscollider'], ['jobicy'])).toBe(50);
  });

  it('is 0 when nothing succeeded', () => {
    expect(computeCoveragePercent(['jobicy', 'jobscollider'], [])).toBe(0);
  });

  it('is 0 when nothing was configured, not NaN or 100', () => {
    expect(computeCoveragePercent([], [])).toBe(0);
  });
});
