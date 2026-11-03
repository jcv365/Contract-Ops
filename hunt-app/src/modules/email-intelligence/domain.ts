// Pure domain-name reasoning used by §81 (company domain verification) and
// the deterministic verifier (Sprint D). No network access here — DNS
// lookups live in providers/deterministic-verifier.ts.

// A small bundled list of multi-label public suffixes actually relevant to
// this deployment's target countries (see worldwide-matrix.ts), rather than
// pulling in a full public-suffix-list dependency. Documented limitation:
// an exotic eTLD not on this list falls back to "last two labels", which in
// the worst case produces a false MISMATCH -> RISKY (fail closed, never a
// false VALID) — see AUDIT-REPORT.md.
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk',
  'co.za', 'org.za', 'gov.za', 'net.za',
  'com.au', 'net.au', 'org.au', 'gov.au',
  'co.nz', 'org.nz', 'govt.nz',
  'com.br', 'net.br', 'org.br',
  'co.in', 'net.in', 'org.in', 'gov.in',
  'com.sg', 'com.hk', 'com.my',
  'co.ke', 'co.ug',
  'com.mx', 'com.ar', 'com.co',
]);

// Free/consumer webmail providers — never accepted as a verified business
// address for a company unless the source explicitly establishes it (§81),
// which the deterministic verifier treats as RISKY, never VALID.
export const FREEMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com',
  'outlook.com', 'live.com', 'aol.com', 'icloud.com', 'protonmail.com',
  'mail.com', 'gmx.com', 'yandex.com', 'zoho.com',
]);

export function extractDomain(address: string): string | null {
  const at = address.lastIndexOf('@');
  if (at < 0 || at === address.length - 1) return null;
  return address.slice(at + 1).toLowerCase();
}

// Returns the "registrable domain" (eTLD+1) — e.g. "example.co.uk" from
// "mail.team.example.co.uk", or "example.com" from "example.com".
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');

  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(registrableDomain(domain));
}

export type DomainOwnership = 'OWNED' | 'SUBDOMAIN' | 'FREEMAIL' | 'MISMATCH' | 'NO_COMPANY_DOMAIN';

// §81: "Before accepting a company email: verify that the domain belongs to
// the company." companyWebsite is the operator/discovery-recorded site of
// record; emailDomain is the domain of the candidate address.
export function domainOwnershipMatch(emailDomain: string, companyWebsite: string | null | undefined): DomainOwnership {
  if (isFreemailDomain(emailDomain)) return 'FREEMAIL';
  if (!companyWebsite) return 'NO_COMPANY_DOMAIN';

  let companyHost: string;
  try {
    companyHost = new URL(
      companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`
    ).hostname.toLowerCase();
  } catch {
    return 'NO_COMPANY_DOMAIN';
  }

  const emailRegistrable = registrableDomain(emailDomain);
  const companyRegistrable = registrableDomain(companyHost);

  if (emailRegistrable !== companyRegistrable) return 'MISMATCH';
  return emailDomain.toLowerCase() === companyHost ? 'OWNED' : 'SUBDOMAIN';
}
