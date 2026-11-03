// §78/§79 failover: A -> B -> C -> public source. All fail => UNKNOWN,
// NEVER a guess. Pure — providers are injected, no I/O here directly.
import { EmailVerificationResult } from '../../domain/types';
import { EmailVerificationProvider, VerificationTarget, VerificationAttempt } from './verification-provider';
import { EmailDiscoveryProvider, DiscoveryTarget, DiscoveredEmailCandidate } from './discovery-provider';

export interface VerificationChainResult {
  attempts: VerificationAttempt[];
  final: EmailVerificationResult;
  finalProviderId: string | null;
}

// Every link's attempt is recorded, in order, always — even an
// unimplemented slot (as a synthetic UNKNOWN) and a thrown provider error
// (as an inconclusive attempt, never a silent skip). Only VALID/INVALID
// may stop the chain; RISKY/UNKNOWN must let the next provider try.
export async function runVerificationChain(
  providers: readonly EmailVerificationProvider[],
  target: VerificationTarget,
  now: () => Date = () => new Date()
): Promise<VerificationChainResult> {
  const attempts: VerificationAttempt[] = [];

  for (const provider of providers) {
    if (!provider.implemented) {
      attempts.push({
        providerId: provider.providerId,
        result: EmailVerificationResult.UNKNOWN,
        method: 'not-implemented',
        confidence: 0,
        checkedAt: now(),
        detail: {},
        conclusive: false,
      });
      continue;
    }

    let attempt: VerificationAttempt;
    try {
      attempt = await provider.verify(target);
    } catch (err) {
      attempt = {
        providerId: provider.providerId,
        result: EmailVerificationResult.UNKNOWN,
        method: 'provider-error',
        confidence: 0,
        checkedAt: now(),
        detail: { error: err instanceof Error ? err.message : 'Unknown provider error' },
        conclusive: false,
      };
    }
    attempts.push(attempt);

    const stops =
      attempt.conclusive &&
      (attempt.result === EmailVerificationResult.VALID || attempt.result === EmailVerificationResult.INVALID);
    if (stops) return { attempts, final: attempt.result, finalProviderId: attempt.providerId };
  }

  // Any INVALID anywhere in the chain wins over UNKNOWN — fail closed
  // rather than let an earlier negative signal be diluted by a later
  // inconclusive one.
  const anyInvalid = attempts.some((a) => a.result === EmailVerificationResult.INVALID);
  return {
    attempts,
    final: anyInvalid ? EmailVerificationResult.INVALID : EmailVerificationResult.UNKNOWN,
    finalProviderId: null,
  };
}

export interface DiscoveryChainResult {
  candidates: DiscoveredEmailCandidate[];
  attemptedProviders: string[];
  reason?: string;
  contactFormUrl?: string;
}

// §80: providers are tried in the order the caller supplies them (the
// registry orders by EmailSourceKind priority). Stops at the first
// provider that actually finds a candidate. A provider throwing is treated
// exactly like a clean "nothing found" — it is never grounds to invent a
// candidate.
export async function runDiscoveryChain(
  providers: readonly EmailDiscoveryProvider[],
  target: DiscoveryTarget
): Promise<DiscoveryChainResult> {
  const attemptedProviders: string[] = [];
  let contactFormUrl: string | undefined;

  for (const provider of providers) {
    if (!provider.implemented) continue;
    attemptedProviders.push(provider.providerId);

    let outcome;
    try {
      outcome = await provider.discover(target);
    } catch {
      continue;
    }

    if (!contactFormUrl && (outcome.status === 'FOUND' || outcome.status === 'NONE_FOUND')) {
      contactFormUrl = outcome.contactFormUrl;
    }

    if (outcome.status === 'FOUND' && outcome.candidates.length > 0) {
      return { candidates: outcome.candidates, attemptedProviders, contactFormUrl };
    }
  }

  return { candidates: [], attemptedProviders, reason: 'No provider found a usable candidate', contactFormUrl };
}
