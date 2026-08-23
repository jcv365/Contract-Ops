import { describe, it, expect } from 'vitest';
import { findHallucinatedEvidenceIds } from './evidence-check';

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
