// Infers the STRUCTURAL EmailType (who an address belongs to) from an
// already-observed address's local part and page context. This function
// only ever classifies an address that was already found published
// somewhere (see providers/org-website-discovery.ts) — it never
// constructs, guesses or completes an address (rule 6 / §76).
import { EmailType } from '../../domain/types';

const GENERIC_LOCAL_PARTS = new Set([
  'info', 'hello', 'enquiries', 'enquiry', 'inquiries', 'contact', 'admin',
  'office', 'mail', 'support', 'general', 'help',
]);

const TEAM_LOCAL_PARTS = new Set([
  'careers', 'jobs', 'recruitment', 'recruiting', 'talent', 'hiring',
  'apply', 'cv', 'resourcing', 'people', 'hr',
]);

export interface LocalPartContext {
  address: string;
  // True when the page this address was observed on binds it adjacently to
  // a person's name (e.g. a team-page card with "Jane Smith" next to the
  // mailto: link). Only ever set from a real DOM observation.
  nameBoundOnPage: boolean;
}

// Structural inference only — never authoritative for §74 classification,
// which depends on the verification chain's result too.
export function inferEmailTypeFromLocalPart(input: LocalPartContext): EmailType {
  const at = input.address.indexOf('@');
  if (at <= 0) return EmailType.INFERRED; // not even a well-formed address to reason about
  const localPart = input.address.slice(0, at).toLowerCase();

  if (GENERIC_LOCAL_PARTS.has(localPart)) return EmailType.COMPANY;
  if (TEAM_LOCAL_PARTS.has(localPart)) return EmailType.TEAM;

  // A local part containing a name-like token (letters, optionally
  // separated by '.', '_', or '-', at least two segments e.g.
  // "jane.smith") AND the page itself binding it to a person's name is the
  // only path to PERSONAL. Structure alone is never enough — §77 requires
  // the greeting rule to rest on independent verification, not a guessed
  // name pattern.
  const looksNameShaped = /^[a-z]+([._-][a-z]+)+$/.test(localPart);
  if (looksNameShaped && input.nameBoundOnPage) return EmailType.PERSONAL;

  return EmailType.GENERIC;
}
