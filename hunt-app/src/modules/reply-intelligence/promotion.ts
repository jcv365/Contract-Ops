// docs-pack/docs/10: "High-value reply: create a proposed HUNT opportunity
// with source provenance = email thread." Not every classification is
// high-value — a REJECTED, NOT_SUITABLE, OUT_OF_OFFICE or DO_NOT_CONTACT
// reply should never spawn a proposed opportunity, and UNKNOWN (meaning
// the classifier itself couldn't tell) shouldn't either, fail-closed.
const PROMOTABLE_CLASSIFICATIONS = new Set([
  'INTERESTED',
  'OPPORTUNITY',
  'REQUEST_CV',
  'REQUEST_PROFILE',
  'REQUEST_RATE',
  'REQUEST_CALL',
  'FUTURE_OPPORTUNITY',
]);

export function isPromotableClassification(classification: string): boolean {
  return PROMOTABLE_CLASSIFICATIONS.has(classification);
}
