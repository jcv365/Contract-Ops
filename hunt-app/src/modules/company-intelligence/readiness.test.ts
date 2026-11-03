import { describe, it, expect } from 'vitest';
import { evaluateCompanyReadiness } from './readiness';

const ready = {
  hasWebsite: true,
  hasType: true,
  targetingReason: 'Confirmed Azure cloud transformation programme via careers page',
  proposition: 'Company capability profile — cloud architecture practice',
  hasValidChannel: true,
};

describe('evaluateCompanyReadiness', () => {
  it('is ready when every requirement is present', () => {
    expect(evaluateCompanyReadiness(ready).ready).toBe(true);
  });

  it('is not ready without a verified company (missing website)', () => {
    expect(evaluateCompanyReadiness({ ...ready, hasWebsite: false }).ready).toBe(false);
  });

  it('is not ready without an evidence-backed targeting reason', () => {
    expect(evaluateCompanyReadiness({ ...ready, targetingReason: '' }).ready).toBe(false);
  });

  it('is not ready without a selected proposition', () => {
    expect(evaluateCompanyReadiness({ ...ready, proposition: null }).ready).toBe(false);
  });

  it('is not ready without a valid contact channel', () => {
    expect(evaluateCompanyReadiness({ ...ready, hasValidChannel: false }).ready).toBe(false);
  });

  // Gap fix (2026-09-01 recovery audit): the company-side gate previously
  // had no suppression check at all, unlike the recruiter-side gate.
  it('is not ready when suppressed, even with every other requirement present', () => {
    const result = evaluateCompanyReadiness({ ...ready, suppressed: true });
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('suppression');
  });

  it('defaults to not-suppressed when the caller omits the field', () => {
    expect(evaluateCompanyReadiness(ready).ready).toBe(true);
  });
});
