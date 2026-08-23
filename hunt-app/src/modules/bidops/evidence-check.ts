// The core anti-hallucination check for BIDOPS drafts (rule 8/9, ADR-004,
// docs-pack/docs/24): the model is given a fixed set of evidence IDs it is
// allowed to cite; anything it returns outside that set is a fabricated
// citation, not a formatting error, and must block draft creation entirely
// rather than being silently filtered out (silently dropping a bad ID
// would let the surrounding claim survive un-cited, which is worse).
export function findHallucinatedEvidenceIds(citedIds: string[], availableIds: Set<string>): string[] {
  return citedIds.filter((id) => !availableIds.has(id));
}
