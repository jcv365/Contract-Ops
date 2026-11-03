// Deliberately unimplemented. Confirmed decision (2026-08-25): discovery
// from official organisation websites only (Sprint E) — no paid
// enrichment vendor (Hunter.io, Apollo, ...) is configured. Same purpose
// as verification-slot.ts's paid slot: a future vendor is a new file + one
// registry line.
import { EmailSourceKind } from '../../../domain/types';
import { EmailDiscoveryProvider, DiscoveryOutcome } from '../discovery-provider';

export class PaidEnrichmentProviderSlot implements EmailDiscoveryProvider {
  readonly providerId = 'paid-enrichment-slot';
  readonly sourceKind = EmailSourceKind.ENRICHMENT_PROVIDER;
  readonly implemented = false;
  readonly verified = false;

  async discover(): Promise<DiscoveryOutcome> {
    throw new Error('Not implemented — no paid enrichment vendor is configured');
  }
}

export const paidEnrichmentProviderSlot = new PaidEnrichmentProviderSlot();
