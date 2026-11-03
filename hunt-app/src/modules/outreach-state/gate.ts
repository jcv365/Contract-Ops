// The two enforcement points where outreach state actually blocks
// something, expressed as pure decision functions so §95 mandatory tests
// #20/#21 don't need a database. The Prisma-touching wrappers that load
// real drafts/emails and call these live in service.ts.
import { DraftStatus, EmailClassification } from '../../domain/types';
import { isEmailReadyClassification } from '../email-intelligence/classification';

export interface GateResult {
  allowed: boolean;
  reason: string;
}

export interface SubmittabilityFacts {
  draftStatus: DraftStatus;
  recipientClassification: EmailClassification;
}

// docs-pack/docs/09: VALIDATED -> AWAITING_APPROVAL. §95 test #20: outreach
// cannot bypass verification — a draft to a non-EMAIL_READY recipient may
// not be submitted, regardless of its own validation status.
export function evaluateSubmittability(facts: SubmittabilityFacts): GateResult {
  if (facts.draftStatus !== DraftStatus.VALIDATED) {
    return { allowed: false, reason: `Draft is ${facts.draftStatus}, not VALIDATED — cannot submit for approval` };
  }
  if (!isEmailReadyClassification(facts.recipientClassification)) {
    return { allowed: false, reason: `Recipient classification is ${facts.recipientClassification} — only VERIFIED_NAMED/TEAM/COMPANY may be submitted (§74)` };
  }
  return { allowed: true, reason: 'VALIDATED draft to a verified recipient' };
}

export interface SendabilityFacts {
  draftStatus: DraftStatus;
  recipientClassification: EmailClassification;
  suppressed: boolean;
}

// ADR-002: "Every outbound message requires explicit human approval
// immediately before sending." §95 test #21: outreach cannot bypass human
// approval — only an APPROVED draft may proceed, and even then only to a
// still-verified, still-unsuppressed recipient (defence in depth: either
// fact could have changed between approval and send).
export function evaluateSendability(facts: SendabilityFacts): GateResult {
  if (facts.suppressed) {
    return { allowed: false, reason: 'Recipient is on the suppression list (§91)' };
  }
  if (facts.draftStatus !== DraftStatus.APPROVED) {
    return { allowed: false, reason: `Draft is ${facts.draftStatus}, not APPROVED — no hidden send action, human approval is required first (ADR-002)` };
  }
  if (!isEmailReadyClassification(facts.recipientClassification)) {
    return { allowed: false, reason: `Recipient classification is ${facts.recipientClassification} — no longer EMAIL_READY (may have bounced or been re-verified since approval)` };
  }
  return { allowed: true, reason: 'APPROVED draft to a verified, unsuppressed recipient' };
}
