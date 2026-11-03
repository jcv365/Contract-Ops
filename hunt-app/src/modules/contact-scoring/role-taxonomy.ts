// §73 contact role taxonomy — the flat lists the spec gives, turned into a
// pure classifier. "Do not automatically target HR" is enforced by scoring
// HR_ROLE low elsewhere (contact-quality.ts), not by refusing to record
// the title here — recording what a title actually is stays honest even
// when it's not a preferred target.
import { ContactRoleCategory } from '../../domain/types';

const RECRUITER_ROLE_PATTERNS = [
  /cloud recruiter/i,
  /azure recruiter/i,
  /technology recruiter/i,
  /contract recruiter/i,
  /it recruitment consultant/i,
  /senior recruitment consultant/i,
  /principal recruitment consultant/i,
  /cloud practice recruiter/i,
  /infrastructure recruiter/i,
  /delivery\s*(\/|&|and)?\s*resource\s*manager/i,
  /resourcing/i,
  /\brecruiter\b/i,
  /recruitment consultant/i,
];

// §73's explicit company-role list — "Talent Acquisition" is named here
// specifically, distinct from a generic HR title (see HR_ROLE_PATTERNS).
const COMPANY_DECISION_ROLE_PATTERNS = [
  /cloud practice director/i,
  /cloud practice lead/i,
  /azure practice lead/i,
  /technology practice director/i,
  /delivery director/i,
  /resource manager/i,
  /managing partner/i,
  /\bpartner\b/i,
  /head of cloud/i,
  /head of architecture/i,
  /enterprise architecture lead/i,
  /talent acquisition/i,
  /programme director/i,
  /program director/i,
];

// A generic HR/People title NOT already matched above by the explicit
// "Talent Acquisition" pattern — "do not automatically target HR" (§73).
const HR_ROLE_PATTERNS = [/\bhr\b/i, /human resources/i, /people (&|and) culture/i, /people partner/i, /people operations/i];

export function categoriseRole(title: string | null | undefined): ContactRoleCategory {
  if (!title || title.trim().length === 0) return ContactRoleCategory.UNKNOWN;

  if (RECRUITER_ROLE_PATTERNS.some((p) => p.test(title))) return ContactRoleCategory.RECRUITER_ROLE;
  // Checked before COMPANY_DECISION_ROLE_PATTERNS deliberately: "HR
  // Business Partner" / "People Partner" would otherwise match the
  // generic /\bpartner\b/i pattern meant for "Managing Partner" and be
  // wrongly promoted out of HR — a real bug caught by
  // role-taxonomy.test.ts before this file was ever used elsewhere.
  if (HR_ROLE_PATTERNS.some((p) => p.test(title))) return ContactRoleCategory.HR_ROLE;
  if (COMPANY_DECISION_ROLE_PATTERNS.some((p) => p.test(title))) return ContactRoleCategory.COMPANY_DECISION_ROLE;
  return ContactRoleCategory.OTHER;
}
