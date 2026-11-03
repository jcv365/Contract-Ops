import { describe, it, expect } from 'vitest';
import { evaluateSubmittability, evaluateSendability } from './gate';
import { DraftStatus, EmailClassification } from '../../domain/types';

describe('evaluateSubmittability', () => {
  it('allows a VALIDATED draft to a VERIFIED_NAMED recipient', () => {
    const result = evaluateSubmittability({ draftStatus: DraftStatus.VALIDATED, recipientClassification: EmailClassification.VERIFIED_NAMED });
    expect(result.allowed).toBe(true);
  });

  it('refuses a non-VALIDATED draft', () => {
    const result = evaluateSubmittability({ draftStatus: DraftStatus.DRAFT, recipientClassification: EmailClassification.VERIFIED_NAMED });
    expect(result.allowed).toBe(false);
  });

  // §95 mandatory test #20: outreach cannot bypass verification.
  it('refuses a VALIDATED draft to a non-EMAIL_READY recipient', () => {
    for (const classification of [EmailClassification.UNVERIFIED, EmailClassification.INVALID, EmailClassification.UNKNOWN]) {
      const result = evaluateSubmittability({ draftStatus: DraftStatus.VALIDATED, recipientClassification: classification });
      expect(result.allowed).toBe(false);
    }
  });
});

describe('evaluateSendability', () => {
  it('allows an APPROVED draft to a verified, unsuppressed recipient', () => {
    const result = evaluateSendability({ draftStatus: DraftStatus.APPROVED, recipientClassification: EmailClassification.VERIFIED_TEAM, suppressed: false });
    expect(result.allowed).toBe(true);
  });

  // §95 mandatory test #21: outreach cannot bypass human approval.
  it('refuses any status other than APPROVED, including AWAITING_APPROVAL', () => {
    for (const status of [DraftStatus.DRAFT, DraftStatus.VALIDATED, DraftStatus.AWAITING_APPROVAL, DraftStatus.REJECTED, DraftStatus.SENT]) {
      const result = evaluateSendability({ draftStatus: status, recipientClassification: EmailClassification.VERIFIED_NAMED, suppressed: false });
      expect(result.allowed).toBe(false);
    }
  });

  // §95 mandatory test #14: suppressed contact cannot enter the send queue.
  it('refuses a suppressed recipient even when APPROVED and verified', () => {
    const result = evaluateSendability({ draftStatus: DraftStatus.APPROVED, recipientClassification: EmailClassification.VERIFIED_NAMED, suppressed: true });
    expect(result.allowed).toBe(false);
  });

  it('refuses an APPROVED draft whose recipient classification has since regressed (e.g. a bounce)', () => {
    const result = evaluateSendability({ draftStatus: DraftStatus.APPROVED, recipientClassification: EmailClassification.INVALID, suppressed: false });
    expect(result.allowed).toBe(false);
  });
});
