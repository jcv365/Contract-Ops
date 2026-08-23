import { EmailType, RelationshipStatus, GreetingMode } from '../../domain/types';

export interface BestEmail {
  emailType: EmailType;
  verified: boolean;
  verificationSource?: string | null;
  verifiedAt?: Date | null;
}

export interface RecruiterReadinessInput {
  hasCompany: boolean;
  relationshipStatus: RelationshipStatus;
  suppressed: boolean;
  bestEmail?: BestEmail;
}

export interface RecruiterReadinessResult {
  ready: boolean;
  reason: string;
  greetingMode?: GreetingMode;
}

// This is the code-level enforcement of ADR-003 and CLAUDE.md rules 6/7 —
// deliberately NOT delegated to a prompt or an AI judgement call (doc 24:
// "deterministic code controls ... email verification"). EmailType.INFERRED
// is structurally incapable of reaching EMAIL_READY here: there is no
// branch that returns ready:true for it, regardless of any other field.
//
// "Verified company" per docs-pack/docs/27 is interpreted here as the
// recruiter having a linked Company record — the only evidentiary anchor
// this schema currently models for company verification. Documented as an
// interpretation choice, not a literal quote from the doc.
export function evaluateRecruiterReadiness(input: RecruiterReadinessInput): RecruiterReadinessResult {
  if (input.suppressed) {
    return { ready: false, reason: 'Recipient is on the suppression list' };
  }
  if (input.relationshipStatus === RelationshipStatus.DO_NOT_CONTACT) {
    return { ready: false, reason: 'Recruiter relationship status is DO_NOT_CONTACT' };
  }
  if (!input.hasCompany) {
    return { ready: false, reason: 'No verified company linked to this recruiter' };
  }
  if (!input.bestEmail) {
    return { ready: false, reason: 'No email on file' };
  }
  if (input.bestEmail.emailType === EmailType.INFERRED) {
    return { ready: false, reason: 'Email is INFERRED (guessed) — never eligible for send, regardless of verification flag' };
  }
  if (!input.bestEmail.verified || !input.bestEmail.verificationSource || !input.bestEmail.verifiedAt) {
    return { ready: false, reason: 'Email is not independently verified with a recorded source and timestamp' };
  }

  const greetingMode = input.bestEmail.emailType === EmailType.PERSONAL ? GreetingMode.FIRST_NAME : GreetingMode.COMPANY_TEAM;

  return {
    ready: true,
    reason:
      greetingMode === GreetingMode.FIRST_NAME
        ? 'Named email independently verified — personal greeting permitted'
        : 'Verified generic/team/company email — company/team greeting only',
    greetingMode,
  };
}

// Picks the single best candidate email for outreach among several on
// file: prefer verified over unverified, and among verified emails prefer
// PERSONAL (enables a named greeting) over GENERIC/TEAM/COMPANY, and never
// prefer INFERRED regardless of any verified flag someone may have
// mistakenly set on it.
export function selectBestEmail(emails: BestEmail[]): BestEmail | undefined {
  const rank = (e: BestEmail): number => {
    if (e.emailType === EmailType.INFERRED) return -1;
    if (!e.verified) return 0;
    if (e.emailType === EmailType.PERSONAL) return 3;
    return 2;
  };
  const candidates = [...emails].sort((a, b) => rank(b) - rank(a));
  const best = candidates[0];
  return best && rank(best) > 0 ? best : undefined;
}
