import { describe, it, expect } from 'vitest';
import { scoreRecruiterTarget } from './recruiter-target';
import { assemble } from './types';

const contactQuality = assemble([{ name: 'x', points: 50, max: 100, evidence: '', known: true }]);

describe('scoreRecruiterTarget', () => {
  // §95 mandatory test #18: recruiter score reproducible.
  it('is reproducible', () => {
    const input = { contactQuality, specialisms: ['Azure Cloud Architecture'] };
    expect(scoreRecruiterTarget(input)).toEqual(scoreRecruiterTarget(input));
  });

  it('awards azure_relevance only when a specialism actually mentions azure', () => {
    const withAzure = scoreRecruiterTarget({ contactQuality, specialisms: ['Azure Migration'] });
    const withoutAzure = scoreRecruiterTarget({ contactQuality, specialisms: ['Java Development'] });
    expect(withAzure.components.find((c) => c.name === 'azure_relevance')?.points).toBe(10);
    expect(withoutAzure.components.find((c) => c.name === 'azure_relevance')?.points).toBe(0);
  });

  it('marks every relevance dimension unknown, not zero-known, when there are no specialisms at all', () => {
    const result = scoreRecruiterTarget({ contactQuality, specialisms: [] });
    expect(result.unknowns).toContain('azure_relevance');
    expect(result.unknowns).toContain('cloud_relevance');
  });

  it('scales the contact-quality component onto a 0-30 range', () => {
    const half = assemble([{ name: 'x', points: 50, max: 100, evidence: '', known: true }]);
    const result = scoreRecruiterTarget({ contactQuality: half, specialisms: [] });
    expect(result.components.find((c) => c.name === 'contact_quality')?.points).toBe(15);
  });
});
