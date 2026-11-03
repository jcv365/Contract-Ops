import { describe, it, expect } from 'vitest';
import { classifyEmail, isEmailReadyClassification } from './classification';
import { EmailType, EmailClassification, EmailVerificationResult } from '../../domain/types';

describe('classifyEmail', () => {
  // §95 mandatory test #1: verified named email becomes EMAIL_READY.
  it('classifies a VALID PERSONAL email as VERIFIED_NAMED', () => {
    const result = classifyEmail({ emailType: EmailType.PERSONAL, latestResult: EmailVerificationResult.VALID });
    expect(result).toBe(EmailClassification.VERIFIED_NAMED);
    expect(isEmailReadyClassification(result)).toBe(true);
  });

  // §95 mandatory test #2: verified generic email becomes EMAIL_READY.
  it('classifies a VALID GENERIC email as VERIFIED_COMPANY', () => {
    const result = classifyEmail({ emailType: EmailType.GENERIC, latestResult: EmailVerificationResult.VALID });
    expect(result).toBe(EmailClassification.VERIFIED_COMPANY);
    expect(isEmailReadyClassification(result)).toBe(true);
  });

  it('classifies a VALID TEAM email as VERIFIED_TEAM', () => {
    const result = classifyEmail({ emailType: EmailType.TEAM, latestResult: EmailVerificationResult.VALID });
    expect(result).toBe(EmailClassification.VERIFIED_TEAM);
    expect(isEmailReadyClassification(result)).toBe(true);
  });

  it('classifies a VALID COMPANY email as VERIFIED_COMPANY', () => {
    expect(classifyEmail({ emailType: EmailType.COMPANY, latestResult: EmailVerificationResult.VALID })).toBe(
      EmailClassification.VERIFIED_COMPANY
    );
  });

  // §95 mandatory test #3: unverified email cannot become EMAIL_READY.
  it('classifies a never-attempted email as UNVERIFIED, not EMAIL_READY', () => {
    const result = classifyEmail({ emailType: EmailType.PERSONAL, latestResult: null });
    expect(result).toBe(EmailClassification.UNVERIFIED);
    expect(isEmailReadyClassification(result)).toBe(false);
  });

  // §95 mandatory test #4: guessed email cannot become EMAIL_READY, even
  // with a VALID-looking result — the structural veto fires first.
  it('never classifies an INFERRED email as VERIFIED_*, regardless of any result', () => {
    expect(
      classifyEmail({ emailType: EmailType.INFERRED, latestResult: EmailVerificationResult.VALID })
    ).toBe(EmailClassification.UNVERIFIED);
    expect(
      classifyEmail({ emailType: EmailType.INFERRED, latestResult: null })
    ).toBe(EmailClassification.UNVERIFIED);
  });

  it('classifies an INFERRED email confirmed INVALID as INVALID (not silently dropped)', () => {
    expect(
      classifyEmail({ emailType: EmailType.INFERRED, latestResult: EmailVerificationResult.INVALID })
    ).toBe(EmailClassification.INVALID);
  });

  // §95 mandatory test #5: invalid email cannot become EMAIL_READY.
  it('classifies an INVALID result as INVALID for any structural type', () => {
    const result = classifyEmail({ emailType: EmailType.PERSONAL, latestResult: EmailVerificationResult.INVALID });
    expect(result).toBe(EmailClassification.INVALID);
    expect(isEmailReadyClassification(result)).toBe(false);
  });

  it('never upgrades RISKY or UNKNOWN to a VERIFIED_* label (§75)', () => {
    for (const result of [EmailVerificationResult.RISKY, EmailVerificationResult.UNKNOWN]) {
      const classification = classifyEmail({ emailType: EmailType.PERSONAL, latestResult: result });
      expect(classification).toBe(EmailClassification.UNKNOWN);
      expect(isEmailReadyClassification(classification)).toBe(false);
    }
  });
});
