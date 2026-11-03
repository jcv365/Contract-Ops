// §90 duplicate contact protection — pure identity-key + merge-plan logic.
// "Do not create another recruiter record simply because the source
// differs. Merge evidence while retaining all source references."
import { registrableDomain } from '../email-intelligence/domain';

const LEGAL_SUFFIX_RE = /\b(ltd|limited|llc|inc|gmbh|pty|bv|sarl|plc|ag|corp|co)\b\.?/gi;

function slugifyCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

// Strong key when a website is on record (registrable domain is a much
// more reliable identity than a name string); falls back to a
// suffix-stripped name slug otherwise.
export function companyIdentityKey(input: { name: string; website?: string | null }): string {
  if (input.website) {
    try {
      const host = new URL(input.website.startsWith('http') ? input.website : `https://${input.website}`).hostname;
      return `domain:${registrableDomain(host)}`;
    } catch {
      // fall through to name-based key
    }
  }
  return `name:${slugifyCompanyName(input.name)}`;
}

function normaliseRecruiterName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Strong key when a public profile URL is on record; falls back to
// company-scoped normalised name (the same person's name can recur across
// unrelated companies, so the key must be scoped, not global).
export function recruiterIdentityKey(input: { companyKey: string; name: string; publicProfileUrl?: string | null }): string {
  if (input.publicProfileUrl) {
    try {
      const url = new URL(input.publicProfileUrl);
      return `profile:${url.hostname}${url.pathname.replace(/\/$/, '')}`;
    } catch {
      // fall through to name-based key
    }
  }
  return `${input.companyKey}|${normaliseRecruiterName(input.name)}`;
}

export interface ConflictEntry {
  field: string;
  existing: unknown;
  incoming: unknown;
  existingSource: string;
  incomingSource: string;
}

export interface SourceRef {
  sourceUrl: string;
  sourceKind: string;
  observedAt: Date;
}

export interface MergePlan {
  action: 'CREATE' | 'MERGE';
  targetId?: string;
  fieldUpdates: Record<string, unknown>;
  conflicts: ConflictEntry[];
  sourceRefsToAppend: SourceRef[];
}

export interface ExistingRecord {
  id: string;
  fields: Record<string, unknown>;
  source: string;
}

export interface IncomingRecord {
  fields: Record<string, unknown>;
  source: string;
  sourceRefs?: SourceRef[];
}

// A differing non-null scalar is never silently overwritten — it becomes a
// conflict entry for the caller to persist as a ClaimConflict row (§27).
// A null/undefined existing value CAN be filled in (that's not a
// conflict, it's completing missing information).
export function planMerge(existing: ExistingRecord | null, incoming: IncomingRecord): MergePlan {
  if (!existing) {
    return {
      action: 'CREATE',
      fieldUpdates: incoming.fields,
      conflicts: [],
      sourceRefsToAppend: incoming.sourceRefs ?? [],
    };
  }

  const fieldUpdates: Record<string, unknown> = {};
  const conflicts: ConflictEntry[] = [];

  for (const [field, incomingValue] of Object.entries(incoming.fields)) {
    if (incomingValue == null) continue;
    const existingValue = existing.fields[field];

    if (existingValue == null) {
      fieldUpdates[field] = incomingValue;
      continue;
    }
    if (existingValue === incomingValue) continue;
    if (Array.isArray(existingValue) && Array.isArray(incomingValue)) {
      // Arrays merge (union) rather than conflict — e.g. specialisms.
      fieldUpdates[field] = Array.from(new Set([...existingValue, ...incomingValue]));
      continue;
    }

    conflicts.push({ field, existing: existingValue, incoming: incomingValue, existingSource: existing.source, incomingSource: incoming.source });
  }

  return {
    action: 'MERGE',
    targetId: existing.id,
    fieldUpdates,
    conflicts,
    sourceRefsToAppend: incoming.sourceRefs ?? [],
  };
}
