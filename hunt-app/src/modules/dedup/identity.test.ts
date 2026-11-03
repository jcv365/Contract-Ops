import { describe, it, expect } from 'vitest';
import { companyIdentityKey, recruiterIdentityKey, planMerge } from './identity';

describe('companyIdentityKey', () => {
  it('uses the registrable domain when a website is present (subdomains stripped)', () => {
    expect(companyIdentityKey({ name: 'Example Cloud Consulting', website: 'https://www.examplecloud.com' })).toBe(
      'domain:examplecloud.com'
    );
  });

  it('produces the same key for the same domain regardless of protocol or trailing slash', () => {
    const a = companyIdentityKey({ name: 'Example', website: 'https://examplecloud.com/' });
    const b = companyIdentityKey({ name: 'Example Ltd', website: 'examplecloud.com' });
    expect(a).toBe(b);
  });

  it('falls back to a suffix-stripped name slug when there is no website', () => {
    expect(companyIdentityKey({ name: 'Example Cloud Consulting Ltd' })).toBe('name:example-cloud-consulting');
  });

  it('treats differently-cased/suffixed names as the same identity when no website is on record', () => {
    const a = companyIdentityKey({ name: 'Example Cloud Consulting' });
    const b = companyIdentityKey({ name: 'EXAMPLE CLOUD CONSULTING, INC.' });
    expect(a).toBe(b);
  });
});

describe('recruiterIdentityKey', () => {
  it('uses the profile URL when present', () => {
    const key = recruiterIdentityKey({ companyKey: 'domain:examplecloud.com', name: 'Jane Smith', publicProfileUrl: 'https://linkedin.com/in/janesmith' });
    expect(key).toBe('profile:linkedin.com/in/janesmith');
  });

  it('falls back to company-scoped normalised name without a profile URL', () => {
    const key = recruiterIdentityKey({ companyKey: 'domain:examplecloud.com', name: 'Jane   Smith' });
    expect(key).toBe('domain:examplecloud.com|jane smith');
  });

  it('scopes the name-based key by company — the same name at two different companies must not collide', () => {
    const a = recruiterIdentityKey({ companyKey: 'domain:companya.com', name: 'Jane Smith' });
    const b = recruiterIdentityKey({ companyKey: 'domain:companyb.com', name: 'Jane Smith' });
    expect(a).not.toBe(b);
  });
});

describe('planMerge', () => {
  // §95 mandatory test #12/#13: duplicate recruiter/company merged, not
  // re-created.
  it('creates when no existing record is on file', () => {
    const plan = planMerge(null, { fields: { name: 'Jane Smith' }, source: 'source-a' });
    expect(plan.action).toBe('CREATE');
    expect(plan.conflicts).toHaveLength(0);
  });

  it('fills in a previously-null field without creating a conflict', () => {
    const plan = planMerge(
      { id: '1', fields: { name: 'Jane Smith', title: null }, source: 'source-a' },
      { fields: { title: 'Cloud Practice Director' }, source: 'source-b' }
    );
    expect(plan.action).toBe('MERGE');
    expect(plan.fieldUpdates.title).toBe('Cloud Practice Director');
    expect(plan.conflicts).toHaveLength(0);
  });

  it('never silently overwrites a differing existing value — records a conflict instead', () => {
    const plan = planMerge(
      { id: '1', fields: { title: 'Cloud Practice Director' }, source: 'source-a' },
      { fields: { title: 'Head of Cloud' }, source: 'source-b' }
    );
    expect(plan.fieldUpdates.title).toBeUndefined();
    expect(plan.conflicts).toEqual([
      { field: 'title', existing: 'Cloud Practice Director', incoming: 'Head of Cloud', existingSource: 'source-a', incomingSource: 'source-b' },
    ]);
  });

  it('does not conflict when the incoming value is identical', () => {
    const plan = planMerge({ id: '1', fields: { title: 'Same' }, source: 'a' }, { fields: { title: 'Same' }, source: 'b' });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.fieldUpdates.title).toBeUndefined();
  });

  it('unions array fields rather than conflicting on them', () => {
    const plan = planMerge(
      { id: '1', fields: { specialisms: ['Azure'] }, source: 'a' },
      { fields: { specialisms: ['Azure', 'FinOps'] }, source: 'b' }
    );
    expect(plan.fieldUpdates.specialisms).toEqual(['Azure', 'FinOps']);
    expect(plan.conflicts).toHaveLength(0);
  });

  it('carries source refs through to the plan for the caller to persist', () => {
    const refs = [{ sourceUrl: 'https://example.com', sourceKind: 'OFFICIAL_COMPANY_SOURCE', observedAt: new Date() }];
    const plan = planMerge(null, { fields: {}, source: 'a', sourceRefs: refs });
    expect(plan.sourceRefsToAppend).toEqual(refs);
  });
});
