// docs-pack §74. This module is a PROJECTION, not a replacement for the
// existing EmailType/verified split: EmailType stays the structural axis
// (who owns the address), the latest EmailVerificationResult stays the
// evidential axis (what a check concluded). The six §74 labels are a pure
// function of both. docs/25 fail-closed: no branch here can upgrade a
// non-VALID result to a VERIFIED_* label.
import { EmailType, EmailClassification, EmailVerificationResult } from '../../domain/types';

export interface ClassifyInput {
  emailType: EmailType;
  // null = never attempted. Distinguishing "never attempted" (UNVERIFIED)
  // from "attempted, inconclusive" (UNKNOWN) is required by §79 ("all
  // providers fail => UNKNOWN") but is not stated explicitly in §74 itself.
  latestResult: EmailVerificationResult | null;
}

export function classifyEmail(input: ClassifyInput): EmailClassification {
  // §76 structural veto: a guessed/inferred address can never carry a
  // VERIFIED_* label, no matter what any provider or operator asserts.
  if (input.emailType === EmailType.INFERRED) {
    return input.latestResult === EmailVerificationResult.INVALID
      ? EmailClassification.INVALID
      : EmailClassification.UNVERIFIED;
  }

  switch (input.latestResult) {
    case null:
      return EmailClassification.UNVERIFIED;
    case EmailVerificationResult.INVALID:
      return EmailClassification.INVALID;
    case EmailVerificationResult.RISKY:
    case EmailVerificationResult.UNKNOWN:
      // §75: "If the verification provider cannot establish validity:
      // UNKNOWN. Do not upgrade UNKNOWN to VALID." RISKY collapses into the
      // same user-facing label but is preserved verbatim on the
      // EmailVerification record.
      return EmailClassification.UNKNOWN;
    case EmailVerificationResult.VALID:
      if (input.emailType === EmailType.PERSONAL) return EmailClassification.VERIFIED_NAMED;
      if (input.emailType === EmailType.TEAM) return EmailClassification.VERIFIED_TEAM;
      // GENERIC and COMPANY both address the organisation, not a named
      // team, so both land on VERIFIED_COMPANY per §74's three-way split.
      return EmailClassification.VERIFIED_COMPANY;
    default: {
      // Exhaustiveness guard — a new EmailVerificationResult value must be
      // handled explicitly here, never silently fall through to a guess.
      const _exhaustive: never = input.latestResult;
      return _exhaustive;
    }
  }
}

// §74: "Only these are EMAIL_READY: VERIFIED_NAMED, VERIFIED_TEAM,
// VERIFIED_COMPANY."
export const EMAIL_READY_CLASSIFICATIONS: ReadonlySet<EmailClassification> = new Set([
  EmailClassification.VERIFIED_NAMED,
  EmailClassification.VERIFIED_TEAM,
  EmailClassification.VERIFIED_COMPANY,
]);

export function isEmailReadyClassification(classification: EmailClassification): boolean {
  return EMAIL_READY_CLASSIFICATIONS.has(classification);
}
