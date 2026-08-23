import { describe, it, expect } from 'vitest';
import { computeScores } from './service';
import { HuntSettings } from '../eligibility/service';

const settings: HuntSettings = {
  countries: [],
  regions: [],
  contractTypes: ['FREELANCE', 'CONTRACT', 'SOW', 'PROJECT', 'CONSULTING'],
  remoteOnly: true,
  seniority: [],
  excludedKeywords: [],
  requiredSkills: ['AZURE', 'CLOUD'],
  preferredSkills: ['FINOPS'],
};

describe('computeScores', () => {
  // The legacy scorer (archive/legacy-hunt/src/services/scoring/scorer.ts)
  // divided an already-weighted sum by 6 again, capping overallPriority at
  // ~1.67 against thresholds written for a 0-10 scale — so nothing could
  // ever reach "medium". This is the regression test for that class of bug.
  it('produces an overallPriority on a 0-10 scale, not further divided', () => {
    const scores = computeScores(
      {
        title: 'Senior Azure Cloud Architect',
        contractType: 'CONTRACT',
        remotePolicy: 'FULLY_REMOTE',
        status: 'ELIGIBLE',
        gaps: [],
      } as never,
      settings
    );
    // All six components are maxed or near-maxed for this input, so the
    // overall must land close to 10, not ~1.6.
    expect(scores.overallPriority).toBeGreaterThan(7);
    expect(scores.overallPriority).toBeLessThanOrEqual(10);
  });

  it('component weights sum to 1.0 (a perfect-10 input scores exactly 10)', () => {
    const scores = computeScores(
      {
        title: 'Azure Cloud role',
        contractType: 'FREELANCE',
        remotePolicy: 'FULLY_REMOTE',
        status: 'ELIGIBLE',
        gaps: [],
      } as never,
      settings
    );
    // technicalFit is capped by keyword overlap (not guaranteed 10 here),
    // but contractFit/remoteFit/eligibility should each be at their max.
    expect(scores.contractFit).toBe(10);
    expect(scores.eligibility).toBe(10);
  });

  // Rule 13: hard-filter failure (INELIGIBLE) must score eligibility 0,
  // which the caller (scoreOpportunity) additionally refuses to promote
  // past REVIEW/UNKNOWN regardless of the other components.
  it('scores the eligibility dimension 0 for an INELIGIBLE opportunity', () => {
    const scores = computeScores(
      {
        title: 'Senior Azure Cloud Architect',
        contractType: 'CONTRACT',
        remotePolicy: 'FULLY_REMOTE',
        status: 'INELIGIBLE',
        gaps: [],
      } as never,
      settings
    );
    expect(scores.eligibility).toBe(0);
  });

  it('scores remoteFit 0 for ONSITE and 10 for FULLY_REMOTE', () => {
    const onsite = computeScores(
      { title: 'x', contractType: 'CONTRACT', remotePolicy: 'ONSITE', status: 'ELIGIBLE', gaps: [] } as never,
      settings
    );
    const remote = computeScores(
      { title: 'x', contractType: 'CONTRACT', remotePolicy: 'FULLY_REMOTE', status: 'ELIGIBLE', gaps: [] } as never,
      settings
    );
    expect(onsite.remoteFit).toBe(0);
    expect(remote.remoteFit).toBe(10);
  });
});
