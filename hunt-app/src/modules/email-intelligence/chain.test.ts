import { describe, it, expect } from 'vitest';
import { runVerificationChain, runDiscoveryChain } from './chain';
import { EmailVerificationResult, EmailSourceKind, EmailType } from '../../domain/types';
import { EmailVerificationProvider, VerificationTarget, VerificationAttempt } from './verification-provider';
import { EmailDiscoveryProvider, DiscoveryTarget, DiscoveryOutcome } from './discovery-provider';

const target: VerificationTarget = { address: 'jane@example.com', companyName: 'Example', observations: [] };
const NOW = () => new Date('2026-09-02T00:00:00Z');

function fakeVerifier(id: string, behaviour: 'valid' | 'invalid' | 'risky' | 'unknown' | 'throw'): EmailVerificationProvider {
  return {
    providerId: id,
    implemented: true,
    verified: true,
    async verify(): Promise<VerificationAttempt> {
      if (behaviour === 'throw') throw new Error(`${id} exploded`);
      const map: Record<string, VerificationAttempt> = {
        valid: { providerId: id, result: EmailVerificationResult.VALID, method: 'fake', confidence: 0.9, checkedAt: NOW(), detail: {}, conclusive: true },
        invalid: { providerId: id, result: EmailVerificationResult.INVALID, method: 'fake', confidence: 0.9, checkedAt: NOW(), detail: {}, conclusive: true },
        risky: { providerId: id, result: EmailVerificationResult.RISKY, method: 'fake', confidence: 0.3, checkedAt: NOW(), detail: {}, conclusive: false },
        unknown: { providerId: id, result: EmailVerificationResult.UNKNOWN, method: 'fake', confidence: 0, checkedAt: NOW(), detail: {}, conclusive: false },
      };
      return map[behaviour];
    },
  };
}

describe('runVerificationChain', () => {
  it('stops at the first conclusive VALID and never calls a later provider', async () => {
    let calledB = false;
    const providerB: EmailVerificationProvider = {
      providerId: 'B',
      implemented: true,
      verified: true,
      async verify() {
        calledB = true;
        return { providerId: 'B', result: EmailVerificationResult.VALID, method: 'fake', confidence: 0.9, checkedAt: NOW(), detail: {}, conclusive: true };
      },
    };
    const result = await runVerificationChain([fakeVerifier('A', 'valid'), providerB], target, NOW);
    expect(result.final).toBe(EmailVerificationResult.VALID);
    expect(result.finalProviderId).toBe('A');
    expect(calledB).toBe(false);
  });

  // §95 mandatory test #9: provider failure does not create an email —
  // a thrown provider never produces a VALID/INVALID result on its own.
  it('a throwing provider is recorded as an inconclusive attempt, never a crash or a positive result', async () => {
    const result = await runVerificationChain([fakeVerifier('A', 'throw')], target, NOW);
    expect(result.attempts[0].result).toBe(EmailVerificationResult.UNKNOWN);
    expect(result.attempts[0].conclusive).toBe(false);
    expect(result.final).toBe(EmailVerificationResult.UNKNOWN);
  });

  // §95 mandatory test #10: provider A failure can trigger provider B.
  it('an inconclusive (RISKY) provider A lets provider B run next', async () => {
    let calledB = false;
    const providerA = fakeVerifier('A', 'risky');
    const providerB: EmailVerificationProvider = {
      providerId: 'B',
      implemented: true,
      verified: true,
      async verify() {
        calledB = true;
        return { providerId: 'B', result: EmailVerificationResult.VALID, method: 'fake', confidence: 0.9, checkedAt: NOW(), detail: {}, conclusive: true };
      },
    };
    const result = await runVerificationChain([providerA, providerB], target, NOW);
    expect(calledB).toBe(true);
    expect(result.final).toBe(EmailVerificationResult.VALID);
    expect(result.finalProviderId).toBe('B');
  });

  // §95 mandatory test #11: A + B failure results in UNKNOWN, never a guess.
  it('every provider inconclusive results in UNKNOWN', async () => {
    const result = await runVerificationChain(
      [fakeVerifier('A', 'unknown'), fakeVerifier('B', 'risky')],
      target,
      NOW
    );
    expect(result.final).toBe(EmailVerificationResult.UNKNOWN);
    expect(result.finalProviderId).toBeNull();
    expect(result.attempts).toHaveLength(2);
  });

  it('an INVALID anywhere in the chain (non-conclusive path) wins over a plain UNKNOWN result', async () => {
    // Neither is individually conclusive in this contrived scenario, but
    // fail-closed means any INVALID observation still surfaces.
    const inconclusiveInvalid: EmailVerificationProvider = {
      providerId: 'A',
      implemented: true,
      verified: true,
      async verify() {
        return { providerId: 'A', result: EmailVerificationResult.INVALID, method: 'fake', confidence: 0.5, checkedAt: NOW(), detail: {}, conclusive: false };
      },
    };
    const result = await runVerificationChain([inconclusiveInvalid, fakeVerifier('B', 'unknown')], target, NOW);
    expect(result.final).toBe(EmailVerificationResult.INVALID);
  });

  it('an unimplemented provider is recorded as UNKNOWN without being called', async () => {
    let called = false;
    const slot: EmailVerificationProvider = {
      providerId: 'paid-slot',
      implemented: false,
      verified: false,
      async verify() {
        called = true;
        throw new Error('should never be called');
      },
    };
    const result = await runVerificationChain([slot], target, NOW);
    expect(called).toBe(false);
    expect(result.attempts[0].method).toBe('not-implemented');
    expect(result.final).toBe(EmailVerificationResult.UNKNOWN);
  });
});

describe('runDiscoveryChain', () => {
  const discoveryTarget: DiscoveryTarget = { companyId: 'c1', companyName: 'Example', companyWebsite: 'https://example.com' };

  function fakeDiscoverer(id: string, outcome: DiscoveryOutcome | 'throw'): EmailDiscoveryProvider {
    return {
      providerId: id,
      sourceKind: EmailSourceKind.OFFICIAL_COMPANY_SOURCE,
      implemented: true,
      verified: true,
      async discover() {
        if (outcome === 'throw') throw new Error('boom');
        return outcome;
      },
    };
  }

  const candidate = {
    address: 'info@example.com',
    emailType: EmailType.COMPANY,
    sourceUrl: 'https://example.com/contact',
    sourceKind: EmailSourceKind.OFFICIAL_COMPANY_SOURCE,
    extractionMethod: 'mailto-href' as const,
    observedAt: new Date(),
    contentHash: 'abc',
    confidence: 0.9,
  };

  it('returns the first provider that finds a candidate', async () => {
    const result = await runDiscoveryChain(
      [fakeDiscoverer('A', { status: 'NONE_FOUND', checkedUrls: [] }), fakeDiscoverer('B', { status: 'FOUND', candidates: [candidate] })],
      discoveryTarget
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.attemptedProviders).toEqual(['A', 'B']);
  });

  it('a throwing provider never produces a candidate and the chain continues', async () => {
    const result = await runDiscoveryChain([fakeDiscoverer('A', 'throw'), fakeDiscoverer('B', { status: 'FOUND', candidates: [candidate] })], discoveryTarget);
    expect(result.candidates).toEqual([candidate]);
  });

  it('returns no candidates and a reason when every provider finds nothing', async () => {
    const result = await runDiscoveryChain([fakeDiscoverer('A', { status: 'NONE_FOUND', checkedUrls: [] })], discoveryTarget);
    expect(result.candidates).toEqual([]);
    expect(result.reason).toBeDefined();
  });

  it('skips unimplemented providers without calling them', async () => {
    let called = false;
    const slot: EmailDiscoveryProvider = {
      providerId: 'paid-slot',
      sourceKind: EmailSourceKind.ENRICHMENT_PROVIDER,
      implemented: false,
      verified: false,
      async discover() {
        called = true;
        throw new Error('should never be called');
      },
    };
    const result = await runDiscoveryChain([slot], discoveryTarget);
    expect(called).toBe(false);
    expect(result.attemptedProviders).toEqual([]);
  });
});
