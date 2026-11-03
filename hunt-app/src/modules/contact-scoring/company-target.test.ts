import { describe, it, expect } from 'vitest';
import { scoreCompanyTarget } from './company-target';
import { CompanyScores } from '../company-intelligence/scoring';

const companyScores: CompanyScores = {
  cloudRelevance: 8,
  azureRelevance: 10,
  contractUsage: 8,
  remoteDelivery: 5, // scoreCompany()'s neutral placeholder
  internationalWork: 10,
  subcontractingPotential: 10,
  companySizeMarket: 5, // neutral placeholder
  transformationActivity: 5, // neutral placeholder
  overall: 7.6,
};

describe('scoreCompanyTarget', () => {
  // §95 mandatory test #19: company score reproducible.
  it('is reproducible', () => {
    const input = { companyScores, hasValidContactChannel: true, hasNamedContact: true };
    expect(scoreCompanyTarget(input)).toEqual(scoreCompanyTarget(input));
  });

  // §84 vs docs/06 documented conflict: scoreCompany()'s neutral-5
  // dimensions must become explicit unknowns here, not silently inherited.
  it('treats remoteDelivery, companySizeMarket and transformationActivity as unknown, never awarding their neutral-5 points', () => {
    const result = scoreCompanyTarget({ companyScores, hasValidContactChannel: false, hasNamedContact: false });
    for (const dimension of ['remoteDelivery', 'companySizeMarket', 'transformationActivity']) {
      const component = result.components.find((c) => c.name === dimension);
      expect(component?.known).toBe(false);
      expect(component?.points).toBe(0);
    }
  });

  it('carries through the genuinely-evidenced dimensions unchanged', () => {
    const result = scoreCompanyTarget({ companyScores, hasValidContactChannel: false, hasNamedContact: false });
    expect(result.components.find((c) => c.name === 'azureRelevance')?.points).toBe(10);
    expect(result.components.find((c) => c.name === 'azureRelevance')?.known).toBe(true);
  });

  it('rewards a verified contact channel and a named contact', () => {
    const withBoth = scoreCompanyTarget({ companyScores, hasValidContactChannel: true, hasNamedContact: true });
    const withNeither = scoreCompanyTarget({ companyScores, hasValidContactChannel: false, hasNamedContact: false });
    expect(withBoth.score).toBeGreaterThan(withNeither.score);
  });
});
