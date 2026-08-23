// docs-pack/docs/12: "Do not present a benchmark as fact when sample size
// is insufficient." A benchmark is always computed and returned (never
// hidden), but sufficientData tells the caller whether to present it as
// a reliable fact or as "too few data points" — never silently upgraded.
const MIN_SAMPLE_SIZE = 5;

export interface RateSample {
  zarRate: number;
}

export interface RateBenchmark {
  sampleSize: number;
  sufficientData: boolean;
  median?: number;
  min?: number;
  max?: number;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeRateBenchmark(samples: RateSample[]): RateBenchmark {
  const rates = samples.map((s) => s.zarRate).filter((r) => Number.isFinite(r) && r > 0);
  const sufficientData = rates.length >= MIN_SAMPLE_SIZE;

  if (rates.length === 0) {
    return { sampleSize: 0, sufficientData: false };
  }

  const sorted = [...rates].sort((a, b) => a - b);
  return {
    sampleSize: rates.length,
    sufficientData,
    median: median(sorted),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// docs-pack/docs/12: "Calculate ... monthly equivalent where sensible."
// Deterministic period conversion — never an AI guess.
export function toMonthlyEquivalent(rate: number, period: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'): number | undefined {
  switch (period) {
    case 'HOURLY':
      return rate * 8 * 21.7; // 8h/day, ~21.7 working days/month
    case 'DAILY':
      return rate * 21.7;
    case 'WEEKLY':
      return rate * 4.33;
    case 'MONTHLY':
      return rate;
    case 'ANNUAL':
      return rate / 12;
    default:
      return undefined;
  }
}
