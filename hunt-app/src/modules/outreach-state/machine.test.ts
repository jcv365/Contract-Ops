import { describe, it, expect } from 'vitest';
import { transition, deriveOutreachState, ContactFacts } from './machine';
import { OutreachState, EmailClassification, DraftStatus } from '../../domain/types';

const base: ContactFacts = {
  suppressed: false,
  hasContact: false,
  hasAnyEmail: false,
  readinessReady: false,
  discoveryExhausted: false,
  hasReply: false,
  hasOpenFollowUp: false,
};

describe('transition', () => {
  it('allows a normal forward transition', () => {
    expect(transition(OutreachState.DISCOVERED, OutreachState.CONTACT_IDENTIFIED, 'discovery').ok).toBe(true);
  });

  it('refuses any transition out of SUPPRESSED (absorbing, §91)', () => {
    const result = transition(OutreachState.SUPPRESSED, OutreachState.OUTREACH_READY, 'readiness.recompute');
    expect(result.ok).toBe(false);
  });

  it('allows SUPPRESSED -> SUPPRESSED (idempotent)', () => {
    expect(transition(OutreachState.SUPPRESSED, OutreachState.SUPPRESSED, 'suppression.recheck').ok).toBe(true);
  });
});

describe('deriveOutreachState', () => {
  it('SUPPRESSED wins over everything else', () => {
    const result = deriveOutreachState({ ...base, suppressed: true, readinessReady: true, hasReply: true });
    expect(result.state).toBe(OutreachState.SUPPRESSED);
  });

  it('an open follow-up outranks a plain reply', () => {
    const result = deriveOutreachState({ ...base, hasReply: true, hasOpenFollowUp: true });
    expect(result.state).toBe(OutreachState.FOLLOW_UP);
  });

  it('a reply outranks a sent draft', () => {
    const result = deriveOutreachState({ ...base, hasReply: true, latestDraftStatus: DraftStatus.SENT });
    expect(result.state).toBe(OutreachState.RESPONDED);
  });

  // §95 mandatory test #16: previously contacted recruiter is visible.
  it('a SENT draft produces CONTACTED', () => {
    const result = deriveOutreachState({ ...base, latestDraftStatus: DraftStatus.SENT });
    expect(result.state).toBe(OutreachState.CONTACTED);
  });

  it('an AWAITING_APPROVAL draft produces AWAITING_APPROVAL', () => {
    const result = deriveOutreachState({ ...base, latestDraftStatus: DraftStatus.AWAITING_APPROVAL });
    expect(result.state).toBe(OutreachState.AWAITING_APPROVAL);
  });

  it('a DRAFT/VALIDATED/APPROVED draft produces DRAFTED', () => {
    for (const status of [DraftStatus.DRAFT, DraftStatus.VALIDATED, DraftStatus.APPROVED]) {
      expect(deriveOutreachState({ ...base, latestDraftStatus: status }).state).toBe(OutreachState.DRAFTED);
    }
  });

  it('readinessReady without any draft yet produces OUTREACH_READY', () => {
    const result = deriveOutreachState({ ...base, readinessReady: true });
    expect(result.state).toBe(OutreachState.OUTREACH_READY);
  });

  it('a VERIFIED_* classification without full readiness produces EMAIL_VERIFIED', () => {
    const result = deriveOutreachState({ ...base, bestEmailClassification: EmailClassification.VERIFIED_NAMED });
    expect(result.state).toBe(OutreachState.EMAIL_VERIFIED);
  });

  it('an UNVERIFIED classification does not count as EMAIL_VERIFIED', () => {
    const result = deriveOutreachState({ ...base, hasAnyEmail: true, bestEmailClassification: EmailClassification.UNVERIFIED });
    expect(result.state).toBe(OutreachState.EMAIL_FOUND);
  });

  it('a contact form with no email produces CONTACT_FORM_AVAILABLE (§88)', () => {
    const result = deriveOutreachState({ ...base, contactFormUrl: 'https://example.com/contact' });
    expect(result.state).toBe(OutreachState.CONTACT_FORM_AVAILABLE);
  });

  it('an identified contact with nothing else produces CONTACT_IDENTIFIED', () => {
    const result = deriveOutreachState({ ...base, hasContact: true });
    expect(result.state).toBe(OutreachState.CONTACT_IDENTIFIED);
  });

  it('exhausted discovery with nothing found produces NO_USABLE_CONTACT, not silently DISCOVERED', () => {
    const result = deriveOutreachState({ ...base, discoveryExhausted: true });
    expect(result.state).toBe(OutreachState.NO_USABLE_CONTACT);
  });

  it('defaults to DISCOVERED when nothing else applies', () => {
    expect(deriveOutreachState(base).state).toBe(OutreachState.DISCOVERED);
  });
});
