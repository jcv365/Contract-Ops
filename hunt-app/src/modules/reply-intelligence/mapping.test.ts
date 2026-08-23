import { describe, it, expect } from 'vitest';
import { mapExtractionToOpportunityFields } from './mapping';
import { ExtractionOutput } from './schemas';

function extraction(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  const empty = { value: null, confidence: 0 };
  return {
    role: empty,
    client: empty,
    startDate: empty,
    duration: empty,
    rate: empty,
    currency: empty,
    remotePolicy: empty,
    location: empty,
    workAuthorisation: empty,
    clearance: empty,
    technologies: empty,
    nextAction: empty,
    deadline: empty,
    ...overrides,
  } as ExtractionOutput;
}

describe('mapExtractionToOpportunityFields', () => {
  // Mandatory test #14 (docs-pack/docs/18): reply with no rate does not
  // invent one.
  it('never invents a rate when none was extracted', () => {
    const result = mapExtractionToOpportunityFields(extraction());
    expect(result.originalRate).toBeUndefined();
    expect(result.originalCurrency).toBeUndefined();
  });

  it('maps a confidently-extracted rate and currency together', () => {
    const result = mapExtractionToOpportunityFields(
      extraction({ rate: { value: 800, confidence: 0.9 }, currency: { value: 'USD', confidence: 0.9 } })
    );
    expect(result.originalRate).toBe(800);
    expect(result.originalCurrency).toBe('USD');
  });

  it('discards a low-confidence rate even if the value is present', () => {
    const result = mapExtractionToOpportunityFields(
      extraction({ rate: { value: 800, confidence: 0.2 }, currency: { value: 'USD', confidence: 0.9 } })
    );
    expect(result.originalRate).toBeUndefined();
  });

  it('never reports a rate without its currency, or vice versa', () => {
    const rateOnly = mapExtractionToOpportunityFields(extraction({ rate: { value: 800, confidence: 0.9 } }));
    expect(rateOnly.originalRate).toBeUndefined();
    expect(rateOnly.gaps.join(' ')).toContain('not both confidently extracted');
  });

  it('records a gap for every field that did not map, rather than silently omitting it', () => {
    const result = mapExtractionToOpportunityFields(extraction());
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it('maps role/location/remotePolicy when confidently extracted', () => {
    const result = mapExtractionToOpportunityFields(
      extraction({
        role: { value: 'Senior Azure Architect', confidence: 0.9 },
        location: { value: 'Remote - EU', confidence: 0.9 },
        remotePolicy: { value: 'FULLY_REMOTE', confidence: 0.9 },
      })
    );
    expect(result.title).toBe('Senior Azure Architect');
    expect(result.location).toBe('Remote - EU');
    expect(result.remotePolicy).toBe('FULLY_REMOTE');
  });
});
