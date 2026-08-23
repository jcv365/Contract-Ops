import { describe, it, expect } from 'vitest';
import { computeRateBenchmark, toMonthlyEquivalent } from './benchmarking';

describe('computeRateBenchmark', () => {
  it('flags insufficient data below the minimum sample size', () => {
    const result = computeRateBenchmark([{ zarRate: 100 }, { zarRate: 200 }]);
    expect(result.sufficientData).toBe(false);
    expect(result.sampleSize).toBe(2);
  });

  // docs-pack/docs/12: never present a benchmark as fact when sample size
  // is insufficient — but the numbers are still returned, just flagged.
  it('still computes numbers even when data is insufficient, just flagged', () => {
    const result = computeRateBenchmark([{ zarRate: 100 }, { zarRate: 200 }]);
    expect(result.median).toBe(150);
  });

  it('marks sufficient data at 5+ samples', () => {
    const result = computeRateBenchmark([{ zarRate: 100 }, { zarRate: 200 }, { zarRate: 300 }, { zarRate: 400 }, { zarRate: 500 }]);
    expect(result.sufficientData).toBe(true);
    expect(result.median).toBe(300);
  });

  it('ignores non-finite or non-positive rates rather than corrupting the benchmark', () => {
    const result = computeRateBenchmark([{ zarRate: 100 }, { zarRate: -50 }, { zarRate: NaN }]);
    expect(result.sampleSize).toBe(1);
  });

  it('returns an empty, insufficient result for zero samples rather than throwing', () => {
    const result = computeRateBenchmark([]);
    expect(result.sampleSize).toBe(0);
    expect(result.sufficientData).toBe(false);
    expect(result.median).toBeUndefined();
  });
});

describe('toMonthlyEquivalent', () => {
  it('converts a daily rate to a monthly equivalent', () => {
    expect(toMonthlyEquivalent(1000, 'DAILY')).toBeCloseTo(21700, 0);
  });

  it('passes a monthly rate through unchanged', () => {
    expect(toMonthlyEquivalent(50000, 'MONTHLY')).toBe(50000);
  });

  it('converts an annual rate to a monthly equivalent', () => {
    expect(toMonthlyEquivalent(600000, 'ANNUAL')).toBe(50000);
  });
});
