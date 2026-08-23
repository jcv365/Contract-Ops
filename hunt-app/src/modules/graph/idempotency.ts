// Mandatory test #6 (docs-pack/docs/18): "Failed send retries idempotently
// without duplicate email." The rule: once an EmailSend row exists in
// status SENT for a draft, never send again — return the existing record.
// A PENDING/QUEUED/FAILED/RETRY row means no successful send has happened
// yet, so a (re)send attempt is allowed and reuses the SAME idempotency
// key rather than minting a new one, so the Graph API's own idempotency
// (if any) and this system's stay aligned.
export type ExistingSendStatus = 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RETRY' | null;

export interface SendDecision {
  shouldSend: boolean;
  reason: string;
}

export function decideSend(existingStatus: ExistingSendStatus): SendDecision {
  if (existingStatus === 'SENT') {
    return { shouldSend: false, reason: 'Already sent — idempotent no-op, not a resend' };
  }
  if (existingStatus === 'SENDING') {
    return { shouldSend: false, reason: 'A send is already in flight for this draft' };
  }
  return { shouldSend: true, reason: existingStatus ? `Retrying from status ${existingStatus}` : 'First send attempt' };
}
