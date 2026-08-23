import { describe, it, expect } from 'vitest';
import { computeRelationshipScore } from './relationship-score';

describe('computeRelationshipScore', () => {
  it('scores DO_NOT_CONTACT as 0 regardless of history', () => {
    const score = computeRelationshipScore({
      relationshipStatus: 'DO_NOT_CONTACT',
      responseHistory: [{ respondedAt: new Date() }],
      opportunityHistoryCount: 5,
    });
    expect(score).toBe(0);
  });

  it('scores PARTNER higher than CONTACTED with identical history', () => {
    const partner = computeRelationshipScore({ relationshipStatus: 'PARTNER', responseHistory: [], opportunityHistoryCount: 0 });
    const contacted = computeRelationshipScore({ relationshipStatus: 'CONTACTED', responseHistory: [], opportunityHistoryCount: 0 });
    expect(partner).toBeGreaterThan(contacted);
  });

  it('never exceeds 10', () => {
    const score = computeRelationshipScore({
      relationshipStatus: 'PARTNER',
      responseHistory: Array.from({ length: 10 }, () => ({ respondedAt: new Date() })),
      opportunityHistoryCount: 20,
    });
    expect(score).toBeLessThanOrEqual(10);
  });

  it('rewards a higher response rate', () => {
    const highResponse = computeRelationshipScore({
      relationshipStatus: 'CONTACTED',
      responseHistory: [{ respondedAt: new Date() }, { respondedAt: new Date() }],
      opportunityHistoryCount: 0,
    });
    const noResponse = computeRelationshipScore({
      relationshipStatus: 'CONTACTED',
      responseHistory: [{ respondedAt: null }, { respondedAt: null }],
      opportunityHistoryCount: 0,
    });
    expect(highResponse).toBeGreaterThan(noResponse);
  });
});
