import { describe, it, expect } from 'vitest';
import { scoreCompany } from './scoring';
import { CompanyType } from '../../domain/types';

describe('scoreCompany', () => {
  it('scores a cloud consultancy with Azure specialism highly on cloud/azure/subcontracting', () => {
    const scores = scoreCompany({
      type: CompanyType.CLOUD_CONSULTANCY,
      specialisms: ['Azure', 'Cloud', 'Migration'],
      regions: ['EMEA', 'AMER'],
    });
    expect(scores.azureRelevance).toBe(10);
    expect(scores.subcontractingPotential).toBe(10);
    expect(scores.internationalWork).toBe(10);
  });

  it('scores a direct client lower on subcontracting potential than a consultancy', () => {
    const consultancy = scoreCompany({ type: CompanyType.CLOUD_CONSULTANCY, specialisms: [], regions: [] });
    const directClient = scoreCompany({ type: CompanyType.DIRECT_CLIENT, specialisms: [], regions: [] });
    expect(directClient.subcontractingPotential).toBeLessThan(consultancy.subcontractingPotential);
  });

  it('never fabricates size/market or transformation-activity scores — always neutral 5', () => {
    const scores = scoreCompany({ type: CompanyType.CLOUD_CONSULTANCY, specialisms: ['Azure'], regions: ['EMEA'] });
    expect(scores.companySizeMarket).toBe(5);
    expect(scores.transformationActivity).toBe(5);
  });

  it('scores 0 international work with no regions on file', () => {
    expect(scoreCompany({ type: null, specialisms: [], regions: [] }).internationalWork).toBe(0);
  });
});
