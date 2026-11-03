// §75's VALID/INVALID/RISKY/UNKNOWN decision matrix — pure, no DNS/network
// here (that's providers/deterministic-verifier.ts). Evaluated top-down,
// first match wins. Only ONE row produces VALID: an owned/subdomain
// company domain, with MX present, and the address actually published on
// the company's own official page. Every other outcome is INVALID, RISKY
// or UNKNOWN — never VALID by default, and RISKY/UNKNOWN are never
// conclusive, so a failover chain (chain.ts) always keeps trying the next
// provider rather than stopping on an inconclusive result (§78/§79).
import { EmailVerificationResult } from '../../domain/types';
import { DomainOwnership } from './domain';

export interface DeterministicChecks {
  syntaxValid: boolean;
  dns: 'MX_PRESENT' | 'A_ONLY_NO_MX' | 'NO_DOMAIN' | 'LOOKUP_FAILED';
  ownership: DomainOwnership;
  publishedProof: 'OFFICIAL_PAGE' | 'PUBLIC_BUSINESS_PAGE' | 'NONE';
  nameBoundOnPage: boolean;
  disposableDomain: boolean;
}

export interface VerificationDecision {
  result: EmailVerificationResult;
  confidence: number;
  conclusive: boolean;
  reason: string;
}

export function decideVerification(c: DeterministicChecks): VerificationDecision {
  if (!c.syntaxValid) {
    return { result: EmailVerificationResult.INVALID, confidence: 1, conclusive: true, reason: 'Malformed email address' };
  }
  if (c.dns === 'NO_DOMAIN') {
    return { result: EmailVerificationResult.INVALID, confidence: 0.95, conclusive: true, reason: 'Domain does not resolve (NXDOMAIN)' };
  }
  if (c.disposableDomain) {
    return { result: EmailVerificationResult.INVALID, confidence: 0.9, conclusive: true, reason: 'Domain is on the disposable-email blocklist' };
  }
  if (c.dns === 'LOOKUP_FAILED') {
    // docs/25 fail-closed: a transient DNS failure is inconclusive, never
    // treated as a negative result — the chain (or a later re-check) gets
    // another attempt.
    return { result: EmailVerificationResult.UNKNOWN, confidence: 0, conclusive: false, reason: 'DNS lookup failed (timeout/SERVFAIL) — retry later' };
  }
  if (c.dns === 'A_ONLY_NO_MX') {
    return { result: EmailVerificationResult.RISKY, confidence: 0.3, conclusive: false, reason: 'Domain has an A record but no MX record — mail delivery unproven' };
  }
  if (c.publishedProof === 'NONE') {
    // §76: not observed anywhere we actually fetched — never upgraded past
    // UNKNOWN no matter how plausible the address looks.
    return { result: EmailVerificationResult.UNKNOWN, confidence: 0, conclusive: false, reason: 'Address is not published on any page this system has fetched' };
  }
  if (c.ownership === 'MISMATCH') {
    // §81 — flagged, never VALID, regardless of publication or DNS state.
    return { result: EmailVerificationResult.RISKY, confidence: 0.2, conclusive: false, reason: 'Email domain does not match the company\'s registered website domain (§81)' };
  }
  if (c.ownership === 'FREEMAIL' && !c.nameBoundOnPage) {
    return { result: EmailVerificationResult.RISKY, confidence: 0.2, conclusive: false, reason: 'Consumer webmail domain used as a business address, with no page binding it to a named person' };
  }
  if (c.ownership === 'FREEMAIL' && c.nameBoundOnPage) {
    return { result: EmailVerificationResult.RISKY, confidence: 0.4, conclusive: false, reason: 'Consumer webmail address is bound to a named person on an official page, but domain ownership cannot be verified' };
  }
  if ((c.ownership === 'OWNED' || c.ownership === 'SUBDOMAIN') && c.dns === 'MX_PRESENT' && c.publishedProof === 'OFFICIAL_PAGE') {
    return { result: EmailVerificationResult.VALID, confidence: 0.95, conclusive: true, reason: 'Owned company domain, MX present, address published on the company\'s own official page' };
  }
  if ((c.ownership === 'OWNED' || c.ownership === 'SUBDOMAIN') && c.dns === 'MX_PRESENT' && c.publishedProof === 'PUBLIC_BUSINESS_PAGE') {
    return { result: EmailVerificationResult.RISKY, confidence: 0.6, conclusive: false, reason: 'Owned company domain and MX present, but only observed on a third-party page, not the company\'s own site' };
  }
  return { result: EmailVerificationResult.UNKNOWN, confidence: 0, conclusive: false, reason: 'Insufficient evidence to reach a verdict' };
}
