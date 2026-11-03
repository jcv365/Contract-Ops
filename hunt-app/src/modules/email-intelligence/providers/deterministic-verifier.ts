// The only implemented EmailVerificationProvider (confirmed decision:
// free deterministic only, no paid vendor). DNS via node:dns/promises,
// domain ownership via ../domain.ts, "published proof" via the
// EmailSourceObservation rows a discovery provider already recorded —
// this provider never fetches a page itself, it only judges evidence
// already on file. NOT SMTP RCPT-TO probing: unreliable from this
// network, non-deterministic under greylisting, and arguably an access
// probe under rule 14 — that gap is exactly what a paid verification slot
// exists to fill later (see verification-slot.ts).
import dns from 'node:dns/promises';
import { EmailSourceKind } from '../../../domain/types';
import { EmailVerificationProvider, VerificationTarget, VerificationAttempt } from '../verification-provider';
import { decideVerification, DeterministicChecks } from '../verification-decision';
import { extractDomain, domainOwnershipMatch, registrableDomain } from '../domain';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// A small bundled blocklist of well-known disposable-email domains — not
// exhaustive, but catches the obvious cases without an external API call.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'yopmail.com', 'throwawaymail.com', 'trashmail.com', 'fakeinbox.com',
  'getnada.com', 'sharklasers.com', 'temp-mail.org', 'dispostable.com',
]);

type DnsResult = DeterministicChecks['dns'];

async function resolveDns(hostname: string): Promise<DnsResult> {
  try {
    const records = await dns.resolveMx(hostname);
    if (records.length > 0) return 'MX_PRESENT';
    // Empty MX record set — fall through to the A/AAAA check below.
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOTFOUND' && code !== 'ENODATA') {
      // Timeout, SERVFAIL, or anything else ambiguous — fail closed
      // rather than guess which case it was.
      return 'LOOKUP_FAILED';
    }
    // ENOTFOUND/ENODATA on the MX query specifically means "no MX record",
    // not "domain doesn't exist" — fall through to the A/AAAA check below.
  }

  // No MX — the domain might still resolve via A/AAAA (implicit MX,
  // RISKY, never VALID on its own).
  try {
    await dns.resolve4(hostname);
    return 'A_ONLY_NO_MX';
  } catch {
    try {
      await dns.resolve6(hostname);
      return 'A_ONLY_NO_MX';
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      return code === 'ENOTFOUND' || code === 'ENODATA' ? 'NO_DOMAIN' : 'LOOKUP_FAILED';
    }
  }
}

export class DeterministicVerifier implements EmailVerificationProvider {
  readonly providerId = 'deterministic-dns-ownership';
  readonly implemented = true;
  // Unlike MockGraphTransport or the paid slots, this one genuinely
  // performs the checks it claims to (docs/25 honesty flag).
  readonly verified = true;

  async verify(target: VerificationTarget): Promise<VerificationAttempt> {
    const checkedAt = new Date();
    const syntaxValid = EMAIL_REGEX.test(target.address);
    const domain = extractDomain(target.address);

    if (!syntaxValid || !domain) {
      const decision = decideVerification({
        syntaxValid: false,
        dns: 'NO_DOMAIN',
        ownership: 'NO_COMPANY_DOMAIN',
        publishedProof: 'NONE',
        nameBoundOnPage: false,
        disposableDomain: false,
      });
      return this.toAttempt(decision, checkedAt, { reason: 'malformed address' });
    }

    const disposableDomain = DISPOSABLE_DOMAINS.has(registrableDomain(domain));
    const dnsResult = await resolveDns(domain);
    const ownership = domainOwnershipMatch(domain, target.companyWebsite);

    const officialObservation = target.observations.find(
      (o) => o.domainMatch && (o.sourceKind === EmailSourceKind.OFFICIAL_COMPANY_SOURCE || o.sourceKind === EmailSourceKind.OFFICIAL_RECRUITER_PAGE)
    );
    const publicObservation = target.observations.find((o) => o.sourceKind === EmailSourceKind.PUBLIC_BUSINESS_SOURCE);
    const publishedProof = officialObservation ? 'OFFICIAL_PAGE' : publicObservation ? 'PUBLIC_BUSINESS_PAGE' : 'NONE';

    const nameBoundOnPage = Boolean(
      target.personName &&
        target.observations.some((o) => o.personName && o.personName.toLowerCase() === target.personName!.toLowerCase())
    );

    const decision = decideVerification({ syntaxValid, dns: dnsResult, ownership, publishedProof, nameBoundOnPage, disposableDomain });

    return this.toAttempt(decision, checkedAt, { domain, dns: dnsResult, ownership, publishedProof, nameBoundOnPage, disposableDomain }, officialObservation?.sourceUrl ?? publicObservation?.sourceUrl);
  }

  private toAttempt(
    decision: ReturnType<typeof decideVerification>,
    checkedAt: Date,
    detail: Record<string, unknown>,
    sourceUrl?: string
  ): VerificationAttempt {
    return {
      providerId: this.providerId,
      result: decision.result,
      method: 'dns-mx+domain-ownership+published-source',
      confidence: decision.confidence,
      sourceUrl,
      checkedAt,
      detail: { ...detail, reason: decision.reason },
      conclusive: decision.conclusive,
    };
  }
}

export const deterministicVerifier = new DeterministicVerifier();
