import { describe, it, expect } from 'vitest';
import { evaluateEligibility, HuntSettings } from './service';

const settings: HuntSettings = {
  countries: ['ZA', 'GB'],
  regions: ['EMEA'],
  contractTypes: ['FREELANCE', 'CONTRACT', 'SOW', 'PROJECT', 'CONSULTING'],
  remoteOnly: true,
  seniority: ['SENIOR'],
  excludedKeywords: ['PERMANENT', 'ONSITE', 'HYBRID', 'JUNIOR'],
  requiredSkills: ['AZURE'],
  preferredSkills: ['FINOPS'],
  allowedClearanceLevels: ['NONE'],
};

function baseOpportunity(overrides: Partial<Parameters<typeof evaluateEligibility>[0]> = {}) {
  return {
    title: 'Senior Azure Architect',
    remotePolicy: 'FULLY_REMOTE' as const,
    contractType: 'CONTRACT' as const,
    postedAt: new Date(),
    location: 'Remote',
    clearance: null,
    ...overrides,
  };
}

describe('evaluateEligibility', () => {
  // Mandatory test #10 (docs-pack/docs/18): hybrid/onsite role excluded
  // when remote-only configured.
  it('excludes HYBRID when remoteOnly is configured', () => {
    const result = evaluateEligibility(baseOpportunity({ remotePolicy: 'HYBRID' as const }), settings);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toContain('remotePolicy is HYBRID');
  });

  it('excludes ONSITE when remoteOnly is configured', () => {
    const result = evaluateEligibility(baseOpportunity({ remotePolicy: 'ONSITE' as const }), settings);
    expect(result.eligible).toBe(false);
  });

  it('accepts FULLY_REMOTE and REMOTE_FIRST', () => {
    expect(evaluateEligibility(baseOpportunity({ remotePolicy: 'FULLY_REMOTE' as const }), settings).eligible).toBe(true);
    expect(evaluateEligibility(baseOpportunity({ remotePolicy: 'REMOTE_FIRST' as const }), settings).eligible).toBe(true);
  });

  it('excludes PERMANENT contract type when not enabled in preferences', () => {
    const result = evaluateEligibility(baseOpportunity({ contractType: 'PERMANENT' as const }), settings);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toContain('permanent');
  });

  // Mandatory test #9: closed/stale opportunity excluded (30-day freshness
  // window, docs-pack/docs/03).
  it('excludes an opportunity posted more than 30 days ago', () => {
    const old = new Date();
    old.setDate(old.getDate() - 45);
    const result = evaluateEligibility(baseOpportunity({ postedAt: old }), settings);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toContain('freshness window');
  });

  it('accepts an opportunity posted within the last 30 days', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    const result = evaluateEligibility(baseOpportunity({ postedAt: recent }), settings);
    expect(result.eligible).toBe(true);
  });

  it('excludes a title containing a configured excluded keyword', () => {
    const result = evaluateEligibility(baseOpportunity({ title: 'Junior Azure Support Engineer' }), settings);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toContain('excluded keyword');
  });

  // Rule 13: a hard-filter failure must be recorded with a reason, never
  // silently dropped.
  it('always returns a reason for every exclusion, never an empty list', () => {
    const result = evaluateEligibility(baseOpportunity({ remotePolicy: 'ONSITE' as const }), settings);
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.notes).toContain('Failed hard filters');
  });

  it('records missing evidence as gaps, not as fabricated pass/fail', () => {
    const result = evaluateEligibility(baseOpportunity({ remotePolicy: null, contractType: null, postedAt: null }), settings);
    expect(result.gaps).toContain('Remote policy not confirmed by source');
    expect(result.gaps).toContain('Contract type not confirmed by source');
    expect(result.gaps).toContain('Posted date not confirmed by source');
    // never hard-excludes purely for missing (not contradicting) evidence
    expect(result.eligible).toBe(true);
  });

  // Mandatory test #11 (docs-pack/docs/18): mandatory clearance excluded
  // when clearance is prohibited.
  it('excludes a role requiring SECURITY_CLEARANCE when only NONE is allowed', () => {
    const result = evaluateEligibility(baseOpportunity({ clearance: 'SECURITY_CLEARANCE' as const }), settings);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(' ')).toContain('SECURITY_CLEARANCE');
  });

  it('excludes a role requiring ENHANCED clearance when only NONE is allowed', () => {
    const result = evaluateEligibility(baseOpportunity({ clearance: 'ENHANCED' as const }), settings);
    expect(result.eligible).toBe(false);
  });

  it('accepts a role explicitly requiring NONE clearance', () => {
    expect(evaluateEligibility(baseOpportunity({ clearance: 'NONE' as const }), settings).eligible).toBe(true);
  });

  it('accepts a clearance level the user has explicitly allowed', () => {
    const permissive = { ...settings, allowedClearanceLevels: ['NONE', 'BASIC'] };
    expect(evaluateEligibility(baseOpportunity({ clearance: 'BASIC' as const }), permissive).eligible).toBe(true);
  });

  it('treats an unconfirmed clearance (null or UNKNOWN) as a gap, never a fabricated pass or exclusion', () => {
    const nullResult = evaluateEligibility(baseOpportunity({ clearance: null }), settings);
    expect(nullResult.gaps).toContain('Clearance requirement not confirmed by source');
    expect(nullResult.eligible).toBe(true);

    const unknownResult = evaluateEligibility(baseOpportunity({ clearance: 'UNKNOWN' as const }), settings);
    expect(unknownResult.gaps).toContain('Clearance requirement not confirmed by source');
    expect(unknownResult.eligible).toBe(true);
  });
});
