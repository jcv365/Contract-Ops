import { describe, it, expect } from 'vitest';
import { computeFingerprint } from './service';
import { RawOpportunity } from '../source-adapters/base';

function raw(overrides: Partial<RawOpportunity> = {}): RawOpportunity {
  return {
    externalId: '1',
    url: 'https://example.com/job/1',
    title: 'Senior Azure Architect',
    companyName: 'Acme Corp',
    location: 'Remote',
    rawData: {},
    ...overrides,
  };
}

describe('computeFingerprint', () => {
  it('is identical for the same title/company/location from two different sources', () => {
    const a = computeFingerprint(raw({ externalId: 'jobicy-1' }));
    const b = computeFingerprint(raw({ externalId: 'jobscollider-9' }));
    expect(a).toBe(b);
  });

  it('is case- and whitespace-insensitive', () => {
    const a = computeFingerprint(raw({ title: 'Senior Azure Architect' }));
    const b = computeFingerprint(raw({ title: '  senior   azure architect  ' }));
    expect(a).toBe(b);
  });

  it('differs when the company differs', () => {
    const a = computeFingerprint(raw({ companyName: 'Acme Corp' }));
    const b = computeFingerprint(raw({ companyName: 'Other Corp' }));
    expect(a).not.toBe(b);
  });
});
