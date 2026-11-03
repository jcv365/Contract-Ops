// Pure query construction — no network here (that's providers/brave-search.ts).
// A search hit is a claim, not a fact (ADR-004/rule 8): these queries are
// deliberately phrased to surface candidates for human review, never
// treated as themselves proving partner/agency status.
export function buildVendorPartnerQuery(vendor: string, keywords: string[]): string {
  const keywordPart = keywords.length > 0 ? ` ${keywords.join(' ')}` : '';
  return `"${vendor} partner" OR "${vendor} certified partner"${keywordPart} consultancy`;
}

export function buildRegionalRecruiterQuery(region: string, keywords: string[]): string {
  const keywordPart = keywords.length > 0 ? ` ${keywords.join(' ')}` : '';
  return `recruitment agency ${region}${keywordPart} contract OR contractor`;
}
