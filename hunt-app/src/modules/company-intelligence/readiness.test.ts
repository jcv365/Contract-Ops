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
});
