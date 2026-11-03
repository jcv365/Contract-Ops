import { describe, it, expect } from 'vitest';
import { evaluateRecruiterReadiness, selectBestEmail } from './readiness';
import { EmailType, RelationshipStatus, GreetingMode, EmailClassification } from '../../domain/types';

const base = {
  hasCompany: true,
  relationshipStatus: RelationshipStatus.CONTACTED,
  suppressed: false,
};

describe('evaluateRecruiterReadiness', () => {
  // Mandatory test #2 (docs-pack/docs/18): inferred email never accepted
  // as verified — this is the single most safety-critical branch.
  it('never marks an INFERRED email ready, even if verified/verificationSource/verifiedAt are all set', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: {
        emailType: EmailType.INFERRED,
        verified: true,
        verificationSource: 'manual-guess',
        verifiedAt: new Date(),
      },
    });
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('guessed');
  });

  // Mandatory test #1: unverified email cannot be sent.
  it('rejects an unverified PERSONAL email', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: { emailType: EmailType.PERSONAL, verified: false },
    });
    expect(result.ready).toBe(false);
  });

  it('rejects a verified email missing a recorded verification source or timestamp', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: { emailType: EmailType.PERSONAL, verified: true },
    });
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('recorded source and timestamp');
  });

  // Mandatory test #4: named verified email permits personal greeting.
  it('grants FIRST_NAME greeting for a verified PERSONAL email', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: {
        emailType: EmailType.PERSONAL,
        verified: true,
        verificationSource: 'linkedin-cross-check',
        verifiedAt: new Date(),
      },
    });
    expect(result.ready).toBe(true);
    expect(result.greetingMode).toBe(GreetingMode.FIRST_NAME);
  });

  // Mandatory test #3: generic verified email -> company/team greeting.
  it('grants COMPANY_TEAM greeting for a verified GENERIC email, not FIRST_NAME', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: {
        emailType: EmailType.GENERIC,
        verified: true,
        verificationSource: 'domain-mx-check',
        verifiedAt: new Date(),
      },
    });
    expect(result.ready).toBe(true);
    expect(result.greetingMode).toBe(GreetingMode.COMPANY_TEAM);
  });

  it('refuses a suppressed recipient regardless of email verification', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      suppressed: true,
      bestEmail: {
        emailType: EmailType.PERSONAL,
        verified: true,
        verificationSource: 'x',
        verifiedAt: new Date(),
      },
    });
    expect(result.ready).toBe(false);
  });

  it('refuses a DO_NOT_CONTACT relationship regardless of email verification', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      relationshipStatus: RelationshipStatus.DO_NOT_CONTACT,
      bestEmail: {
        emailType: EmailType.PERSONAL,
        verified: true,
        verificationSource: 'x',
        verifiedAt: new Date(),
      },
    });
    expect(result.ready).toBe(false);
  });

  it('refuses when no email is on file at all', () => {
    expect(evaluateRecruiterReadiness(base).ready).toBe(false);
  });

  // §95 mandatory test #20 (docs-pack §70-97): even a verified/boolean-true
  // email cannot bypass the §74 classification gate once a classification
  // has been computed for it.
  it('refuses a bestEmail whose §74 classification is not VERIFIED_* even when the legacy verified flag is true', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: {
        emailType: EmailType.PERSONAL,
        verified: true,
        verificationSource: 'org-website-discovery',
        verifiedAt: new Date(),
        classification: EmailClassification.UNKNOWN,
      },
    });
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('§74');
  });

  it('permits a bestEmail whose §74 classification is VERIFIED_NAMED', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: {
        emailType: EmailType.PERSONAL,
        verified: true,
        verificationSource: 'org-website-discovery',
        verifiedAt: new Date(),
        classification: EmailClassification.VERIFIED_NAMED,
      },
    });
    expect(result.ready).toBe(true);
    expect(result.greetingMode).toBe(GreetingMode.FIRST_NAME);
  });

  it('is unaffected by the classification gate when classification is omitted (legacy callers)', () => {
    const result = evaluateRecruiterReadiness({
      ...base,
      bestEmail: {
        emailType: EmailType.PERSONAL,
        verified: true,
        verificationSource: 'linkedin-cross-check',
        verifiedAt: new Date(),
      },
    });
    expect(result.ready).toBe(true);
  });
});

describe('selectBestEmail', () => {
  it('prefers a verified PERSONAL email over a verified GENERIC one', () => {
    const best = selectBestEmail([
      { emailType: EmailType.GENERIC, verified: true },
      { emailType: EmailType.PERSONAL, verified: true },
    ]);
    expect(best?.emailType).toBe(EmailType.PERSONAL);
  });

  it('never selects an INFERRED email even if it is the only one marked verified', () => {
    const best = selectBestEmail([{ emailType: EmailType.INFERRED, verified: true }]);
    expect(best).toBeUndefined();
  });

  it('prefers any verified email over an unverified one', () => {
    const best = selectBestEmail([
      { emailType: EmailType.PERSONAL, verified: false },
      { emailType: EmailType.GENERIC, verified: true },
    ]);
    expect(best?.emailType).toBe(EmailType.GENERIC);
  });
});
