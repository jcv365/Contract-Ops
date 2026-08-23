// The core anti-hallucination check for BIDOPS drafts (rule 8/9, ADR-004,
// docs-pack/docs/24): the model is given a fixed set of evidence IDs it is
// allowed to cite; anything it returns outside that set is a fabricated
// citation, not a formatting error, and must block draft creation entirely
// rather than being silently filtered out (silently dropping a bad ID
// would let the surrounding claim survive un-cited, which is worse).
export function findHallucinatedEvidenceIds(citedIds: string[], availableIds: Set<string>): string[] {
  return citedIds.filter((id) => !availableIds.has(id));
}

// Mandatory test #5 (docs-pack/docs/18): "Duplicate outreach blocked." A
// recipient who already has a SENT draft on file must not get a second
// one approved — this is the pass/fail decision reviewDraft() applies to
// whatever the DB query for an existing SENT draft to the same recipient
// finds.
export interface DuplicateContactCheck {
  result: 'PASS' | 'FAIL';
  issues: string[];
}

export function evaluateDuplicateContact(recipientEmail: string, existingSentDraftId: string | null): DuplicateContactCheck {
  if (!existingSentDraftId) {
    return { result: 'PASS', issues: [] };
  }
  return {
    result: 'FAIL',
    issues: [`Recipient ${recipientEmail} already has a SENT draft (${existingSentDraftId})`],
  };
}
