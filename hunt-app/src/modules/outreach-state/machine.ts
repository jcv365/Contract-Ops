// §85: "A target must have a clear state... Do not use a single boolean
// without the underlying verification record." OutreachState (a CONTACT's
// lifecycle) is separate from DraftStatus (a MESSAGE's lifecycle,
// unchanged in prisma/schema.prisma) — this module only OBSERVES draft
// events, it never replaces DraftStatus as the send authority.
import { OutreachState, EmailClassification, DraftStatus } from '../../domain/types';
import { isEmailReadyClassification } from '../email-intelligence/classification';

// SUPPRESSED is absorbing — §91: a suppressed contact cannot re-enter
// outreach. Every other state may transition forward as new facts arrive,
// and `deriveOutreachState` recomputes on every relevant event rather than
// tracking a hand-maintained forward-only pointer.
export function transition(from: OutreachState, to: OutreachState, trigger: string): { ok: boolean; reason: string } {
  if (from === OutreachState.SUPPRESSED && to !== OutreachState.SUPPRESSED) {
    return { ok: false, reason: `SUPPRESSED is absorbing — cannot transition to ${to} via ${trigger} (§91)` };
  }
  return { ok: true, reason: `${from} -> ${to} via ${trigger}` };
}

export interface ContactFacts {
  suppressed: boolean;
  hasContact: boolean; // a specific person/role identified (recruiter) or the company record itself exists
  bestEmailClassification?: EmailClassification;
  hasAnyEmail: boolean;
  readinessReady: boolean; // EMAIL_READY / OUTREACH_READY, computed elsewhere
  contactFormUrl?: string;
  discoveryExhausted: boolean; // discovery ran and found nothing usable
  latestDraftStatus?: DraftStatus;
  hasReply: boolean;
  hasOpenFollowUp: boolean;
}

export interface DerivedState {
  state: OutreachState;
  reason: string;
}

const DRAFTED_STATUSES = new Set<DraftStatus>([DraftStatus.DRAFT, DraftStatus.VALIDATED, DraftStatus.APPROVED]);

// Takes the RECORDS (readiness, classification, draft status, reply
// presence), not a single boolean — the §85 requirement stated explicitly.
// Ordered highest-priority (most-advanced / absorbing) first.
export function deriveOutreachState(facts: ContactFacts): DerivedState {
  if (facts.suppressed) return { state: OutreachState.SUPPRESSED, reason: 'On the suppression list (§91)' };
  if (facts.hasOpenFollowUp) return { state: OutreachState.FOLLOW_UP, reason: 'An open follow-up is scheduled' };
  if (facts.hasReply) return { state: OutreachState.RESPONDED, reason: 'A reply has been received' };
  if (facts.latestDraftStatus === DraftStatus.SENT) return { state: OutreachState.CONTACTED, reason: 'An outreach email has been sent' };
  if (facts.latestDraftStatus === DraftStatus.AWAITING_APPROVAL) {
    return { state: OutreachState.AWAITING_APPROVAL, reason: 'Draft is awaiting human approval (ADR-002)' };
  }
  if (facts.latestDraftStatus && DRAFTED_STATUSES.has(facts.latestDraftStatus)) {
    return { state: OutreachState.DRAFTED, reason: `Draft exists (${facts.latestDraftStatus})` };
  }
  if (facts.readinessReady) return { state: OutreachState.OUTREACH_READY, reason: 'Readiness gate passed' };
  if (facts.bestEmailClassification && isEmailReadyClassification(facts.bestEmailClassification)) {
    return { state: OutreachState.EMAIL_VERIFIED, reason: `Best email classified ${facts.bestEmailClassification}` };
  }
  if (facts.hasAnyEmail) return { state: OutreachState.EMAIL_FOUND, reason: 'An email is on file but not yet verified' };
  if (facts.contactFormUrl) return { state: OutreachState.CONTACT_FORM_AVAILABLE, reason: `Contact form found: ${facts.contactFormUrl} (§88 — never auto-submitted)` };
  if (facts.hasContact) return { state: OutreachState.CONTACT_IDENTIFIED, reason: 'A contact/role has been identified but no email or form yet' };
  if (facts.discoveryExhausted) return { state: OutreachState.NO_USABLE_CONTACT, reason: 'Discovery ran and found no usable contact (§72)' };
  return { state: OutreachState.DISCOVERED, reason: 'Recorded, not yet researched' };
}
