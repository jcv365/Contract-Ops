// Default provider chains, in priority order (§78/§80). Real providers
// first, paid slots last — the slot is only reached when the free path is
// inconclusive AND happens to be implemented, which it never is today.
import { deterministicVerifier } from './providers/deterministic-verifier';
import { paidVerificationProviderSlot } from './providers/verification-slot';
import { orgWebsiteDiscoveryProvider } from './providers/org-website-discovery';
import { paidEnrichmentProviderSlot } from './providers/enrichment-slot';
import { EmailVerificationProvider } from './verification-provider';
import { EmailDiscoveryProvider } from './discovery-provider';

export const verificationProviders: readonly EmailVerificationProvider[] = [deterministicVerifier, paidVerificationProviderSlot];

// §80 order: official company source before the (unimplemented) paid
// enrichment slot.
export const discoveryProviders: readonly EmailDiscoveryProvider[] = [orgWebsiteDiscoveryProvider, paidEnrichmentProviderSlot];
