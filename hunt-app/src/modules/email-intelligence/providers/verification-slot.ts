// Deliberately unimplemented. Confirmed decision (2026-08-25): free
// deterministic verification only — no paid vendor (ZeroBounce, NeverBounce,
// ...) is configured. This slot exists so adding one later is a new file +
// one registry line (registry.ts), not a redesign of chain.ts or
// verification-decision.ts. runVerificationChain skips implemented=false
// providers without ever calling verify().
import { EmailVerificationProvider, VerificationAttempt } from '../verification-provider';

export class PaidVerificationProviderSlot implements EmailVerificationProvider {
  readonly providerId = 'paid-verification-slot';
  readonly implemented = false;
  readonly verified = false;

  async verify(): Promise<VerificationAttempt> {
    throw new Error('Not implemented — no paid verification vendor is configured');
  }
}

export const paidVerificationProviderSlot = new PaidVerificationProviderSlot();
