// docs-pack/docs/27: OUTREACH_READY requires a verified company, an
// evidence-backed targeting reason, a selected proposition, and a valid
// contact channel. "Verified company" here means website + type known —
// the same evidentiary-anchor interpretation used for recruiters.
export interface CompanyReadinessInput {
  hasWebsite: boolean;
  hasType: boolean;
  targetingReason?: string | null;
  proposition?: string | null;
  hasValidChannel: boolean;
}

export interface CompanyReadinessResult {
  ready: boolean;
  reason: string;
}

export function evaluateCompanyReadiness(input: CompanyReadinessInput): CompanyReadinessResult {
  if (!input.hasWebsite || !input.hasType) {
    return { ready: false, reason: 'Company not independently verified (missing website or type)' };
  }
  if (!input.targetingReason || input.targetingReason.trim().length === 0) {
    return { ready: false, reason: 'No evidence-backed targeting reason recorded' };
  }
  if (!input.proposition || input.proposition.trim().length === 0) {
    return { ready: false, reason: 'No proposition selected for this company' };
  }
  if (!input.hasValidChannel) {
    return { ready: false, reason: 'No valid, verified contact channel on file' };
  }
  return { ready: true, reason: 'Verified company, targeting reason, proposition and contact channel all present' };
}
