// docs-pack/docs/27: "If sources disagree, preserve both, mark
// CONFLICTED and require explicit precedence or human review." This
// compares a specific field between two source records describing what
// clustering (fingerprint matching) believes is the same real-world
// opportunity, and returns a conflict entry only when they genuinely
// disagree — not when one side simply lacks the evidence (null vs a
// value is a gap, not a conflict; rule 8 already treats that separately).
export interface ConflictCandidate {
  value: unknown;
  source: string;
  sourceUrl?: string;
  retrievedAt: string;
}

export function detectConflict(existing: ConflictCandidate, incoming: ConflictCandidate): boolean {
  if (existing.value == null || incoming.value == null) return false;
  if (existing.source === incoming.source) return false; // same source re-supplying isn't a conflict, it's an update
  return JSON.stringify(existing.value) !== JSON.stringify(incoming.value);
}

export const CONFLICT_TRACKED_FIELDS = ['originalRate', 'originalCurrency', 'remotePolicy', 'contractType'] as const;
export type ConflictTrackedField = (typeof CONFLICT_TRACKED_FIELDS)[number];
