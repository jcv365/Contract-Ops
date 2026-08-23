import { describe, it, expect } from 'vitest';
import { findHallucinatedEvidenceIds, evaluateDuplicateContact } from './evidence-check';

describe('findHallucinatedEvidenceIds', () => {
  it('is empty when every cited id was supplied', () => {
    expect(findHallucinatedEvidenceIds(['a', 'b'], new Set(['a', 'b', 'c']))).toEqual([]);
  });

  it('flags every id not in the supplied set', () => {
    expect(findHallucinatedEvidenceIds(['a', 'x', 'y'], new Set(['a', 'b']))).toEqual(['x', 'y']);
  });

  it('flags all ids when nothing was supplied', () => {
    expect(findHallucinatedEvidenceIds(['a'], new Set())).toEqual(['a']);
  });

  it('is empty when the model cited nothing', () => {
    expect(findHallucinatedEvidenceIds([], new Set(['a']))).toEqual([]);
  });
});

describe('evaluateDuplicateContact', () => {
  // Mandatory test #5 (docs-pack/docs/18): duplicate outreach blocked.
  it('fails when the recipient already has a SENT draft', () => {
    const result = evaluateDuplicateContact('recruiter@example.com', 'draft-existing-id');
    expect(result.result).toBe('FAIL');
    expect(result.issues[0]).toContain('draft-existing-id');
  });

  it('passes when no SENT draft exists for the recipient', () => {
    expect(evaluateDuplicateContact('recruiter@example.com', null).result).toBe('PASS');
  });
});
