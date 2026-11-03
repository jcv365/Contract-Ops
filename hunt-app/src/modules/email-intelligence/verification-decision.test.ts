import { describe, it, expect } from 'vitest';
import { decideVerification, DeterministicChecks } from './verification-decision';
import { EmailVerificationResult } from '../../domain/types';

const base: DeterministicChecks = {
  syntaxValid: true,
  dns: 'MX_PRESENT',
  ownership: 'OWNED',
  publishedProof: 'OFFICIAL_PAGE',
  nameBoundOnPage: false,
  disposableDomain: false,
};

describe('decideVerification', () => {
  it('the only VALID row: owned domain, MX present, published on the official page', () => {
    const result = decideVerification(base);
    expect(result.result).toBe(EmailVerificationResult.VALID);
    expect(result.conclusive).toBe(true);
  });

  it('SUBDOMAIN also reaches VALID under the same conditions', () => {
    const result = decideVerification({ ...base, ownership: 'SUBDOMAIN' });
    expect(result.result).toBe(EmailVerificationResult.VALID);
  });

  it('malformed syntax is INVALID and conclusive', () => {
    const result = decideVerification({ ...base, syntaxValid: false });
    expect(result.result).toBe(EmailVerificationResult.INVALID);
    expect(result.conclusive).toBe(true);
  });

  it('NXDOMAIN is INVALID and conclusive', () => {
    const result = decideVerification({ ...base, dns: 'NO_DOMAIN' });
    expect(result.result).toBe(EmailVerificationResult.INVALID);
    expect(result.conclusive).toBe(true);
  });

  it('a disposable domain is INVALID and conclusive', () => {
    const result = decideVerification({ ...base, disposableDomain: true });
    expect(result.result).toBe(EmailVerificationResult.INVALID);
    expect(result.conclusive).toBe(true);
  });

  it('a failed DNS lookup is UNKNOWN and never conclusive (fail closed, not negative)', () => {
    const result = decideVerification({ ...base, dns: 'LOOKUP_FAILED' });
    expect(result.result).toBe(EmailVerificationResult.UNKNOWN);
    expect(result.conclusive).toBe(false);
  });

  it('A record with no MX is RISKY, never conclusive', () => {
    const result = decideVerification({ ...base, dns: 'A_ONLY_NO_MX' });
    expect(result.result).toBe(EmailVerificationResult.RISKY);
    expect(result.conclusive).toBe(false);
  });

  it('no published proof anywhere is UNKNOWN, regardless of how clean everything else looks (§76)', () => {
    const result = decideVerification({ ...base, publishedProof: 'NONE' });
    expect(result.result).toBe(EmailVerificationResult.UNKNOWN);
    expect(result.conclusive).toBe(false);
  });

  // §81 — the exact scenario the spec calls out: domain mismatch must
  // never become VALID.
  it('a domain mismatch is RISKY and never conclusive, never VALID', () => {
    const result = decideVerification({ ...base, ownership: 'MISMATCH' });
    expect(result.result).toBe(EmailVerificationResult.RISKY);
    expect(result.conclusive).toBe(false);
  });

  // §81 — john@gmail.com must never pass as a verified business address.
  it('freemail without a page-bound name is RISKY, never VALID', () => {
    const result = decideVerification({ ...base, ownership: 'FREEMAIL', nameBoundOnPage: false });
    expect(result.result).toBe(EmailVerificationResult.RISKY);
  });

  it('freemail even WITH a page-bound name stays RISKY, never VALID — domain ownership cannot be established', () => {
    const result = decideVerification({ ...base, ownership: 'FREEMAIL', nameBoundOnPage: true });
    expect(result.result).toBe(EmailVerificationResult.RISKY);
    expect(result.conclusive).toBe(false);
  });

  it('owned domain + MX but only a third-party (non-official) page is RISKY, not VALID', () => {
    const result = decideVerification({ ...base, publishedProof: 'PUBLIC_BUSINESS_PAGE' });
    expect(result.result).toBe(EmailVerificationResult.RISKY);
    expect(result.conclusive).toBe(false);
  });

  it('NO_COMPANY_DOMAIN falls through to UNKNOWN rather than any positive result', () => {
    const result = decideVerification({ ...base, ownership: 'NO_COMPANY_DOMAIN' });
    expect(result.result).toBe(EmailVerificationResult.UNKNOWN);
    expect(result.conclusive).toBe(false);
  });

  it('every RISKY/UNKNOWN row has confidence strictly less than the VALID row', () => {
    const validConfidence = decideVerification(base).confidence;
    for (const variant of [
      { ...base, dns: 'A_ONLY_NO_MX' as const },
      { ...base, ownership: 'MISMATCH' as const },
      { ...base, publishedProof: 'PUBLIC_BUSINESS_PAGE' as const },
    ]) {
      expect(decideVerification(variant).confidence).toBeLessThan(validConfidence);
    }
  });
});
