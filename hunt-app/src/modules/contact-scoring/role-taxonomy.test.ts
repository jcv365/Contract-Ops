import { describe, it, expect } from 'vitest';
import { categoriseRole } from './role-taxonomy';
import { ContactRoleCategory } from '../../domain/types';

describe('categoriseRole', () => {
  it('classifies recruiter-shaped titles as RECRUITER_ROLE', () => {
    for (const title of ['Cloud Recruiter', 'Senior Recruitment Consultant', 'Contract Recruiter']) {
      expect(categoriseRole(title)).toBe(ContactRoleCategory.RECRUITER_ROLE);
    }
  });

  it('classifies company decision-maker titles as COMPANY_DECISION_ROLE', () => {
    for (const title of ['Cloud Practice Director', 'Head of Cloud', 'Managing Partner', 'Enterprise Architecture Lead']) {
      expect(categoriseRole(title)).toBe(ContactRoleCategory.COMPANY_DECISION_ROLE);
    }
  });

  // §73's explicit exception — named in the spec's company role list.
  it('classifies "Talent Acquisition" as COMPANY_DECISION_ROLE, not HR_ROLE', () => {
    expect(categoriseRole('Talent Acquisition Manager')).toBe(ContactRoleCategory.COMPANY_DECISION_ROLE);
  });

  // §73: "do not automatically target HR."
  it('classifies a generic HR title as HR_ROLE', () => {
    for (const title of ['HR Manager', 'Human Resources Business Partner', 'People & Culture Lead']) {
      expect(categoriseRole(title)).toBe(ContactRoleCategory.HR_ROLE);
    }
  });

  it('classifies an unrelated title as OTHER', () => {
    expect(categoriseRole('Software Engineer')).toBe(ContactRoleCategory.OTHER);
  });

  it('classifies a missing title as UNKNOWN', () => {
    expect(categoriseRole(undefined)).toBe(ContactRoleCategory.UNKNOWN);
    expect(categoriseRole('')).toBe(ContactRoleCategory.UNKNOWN);
  });
});
