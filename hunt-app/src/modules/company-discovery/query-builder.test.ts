import { describe, it, expect } from 'vitest';
import { buildVendorPartnerQuery, buildRegionalRecruiterQuery } from './query-builder';

describe('buildVendorPartnerQuery', () => {
  it('includes the vendor name and both partner phrasings', () => {
    const q = buildVendorPartnerQuery('Microsoft', ['Azure', 'cloud architecture']);
    expect(q).toContain('"Microsoft partner"');
    expect(q).toContain('"Microsoft certified partner"');
    expect(q).toContain('Azure');
    expect(q).toContain('cloud architecture');
  });

  it('still produces a valid query with no keywords', () => {
    expect(buildVendorPartnerQuery('AWS', [])).toBe('"AWS partner" OR "AWS certified partner" consultancy');
  });
});

describe('buildRegionalRecruiterQuery', () => {
  it('includes the region and contract/contractor terms', () => {
    const q = buildRegionalRecruiterQuery('United Kingdom', ['Azure architect']);
    expect(q).toContain('United Kingdom');
    expect(q).toContain('Azure architect');
    expect(q).toMatch(/contract OR contractor/);
  });

  it('still produces a valid query with no keywords', () => {
    expect(buildRegionalRecruiterQuery('Germany', [])).toBe('recruitment agency Germany contract OR contractor');
  });
});
