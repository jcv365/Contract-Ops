import { describe, it, expect } from 'vitest';
import { scoreContactQuality, ContactQualityInput } from './contact-quality';
import { EmailClassification, ContactRoleCategory } from '../../domain/types';

const input: ContactQualityInput = {
  emailClassification: EmailClassification.VERIFIED_NAMED,
  roleCategory: ContactRoleCategory.COMPANY_DECISION_ROLE,
  hasPublicProfile: true,
  recruiterSpecialisms: ['Azure', 'Cloud Architecture'],
  profileSpecialisms: ['Azure', 'FinOps'],
  relationshipStatus: 'CONTACTED',
  responseHistory: [],
  opportunityHistoryCount: 0,
};

describe('scoreContactQuality', () => {
  // §95 mandatory test #17: contact score reproducible.
  it('is reproducible — same input, same output, across repeated calls', () => {
    expect(scoreContactQuality(input)).toEqual(scoreContactQuality(input));
  });

  it('never awards points for unknown information (no email on file)', () => {
    const result = scoreContactQuality({ ...input, emailClassification: undefined });
    expect(result.components.find((c) => c.name === 'email_classification')?.points).toBe(0);
    expect(result.unknowns).toContain('email_classification');
  });

  it('scores an HR role lower than a company decision-maker role (§73)', () => {
    const hr = scoreContactQuality({ ...input, roleCategory: ContactRoleCategory.HR_ROLE });
    const decisionMaker = scoreContactQuality({ ...input, roleCategory: ContactRoleCategory.COMPANY_DECISION_ROLE });
    expect(hr.score).toBeLessThan(decisionMaker.score);
  });

  it('scores an UNKNOWN role category as unknown, not silently zero-known', () => {
    const result = scoreContactQuality({ ...input, roleCategory: ContactRoleCategory.UNKNOWN });
    expect(result.unknowns).toContain('role_relevance');
  });

  it('does not award specialism overlap points when the recruiter has no recorded specialisms', () => {
    const result = scoreContactQuality({ ...input, recruiterSpecialisms: [] });
    expect(result.components.find((c) => c.name === 'specialism_overlap')?.known).toBe(false);
  });
});
