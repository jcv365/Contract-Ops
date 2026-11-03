export interface DiscoveryQuery {
  mode: 'VENDOR_PARTNER' | 'REGIONAL_RECRUITER';
  vendor?: string; // 'Microsoft' | 'AWS' | 'Google Cloud' | operator-entered, VENDOR_PARTNER mode only
  region?: string; // REGIONAL_RECRUITER mode only
  keywords: string[];
}

// A search hit is a claim, not a fact (ADR-004/rule 8) — everything here
// is the search result's OWN text, never invented or embellished.
export interface DiscoveredCompanyCandidate {
  name: string;
  website?: string;
  snippet: string;
  sourceUrl: string;
  searchQuery: string;
}

export interface DiscoveryOutcome {
  candidates: DiscoveredCompanyCandidate[];
}

export interface OrgDiscoveryProvider {
  readonly providerId: string;
  readonly implemented: boolean;
  discover(query: DiscoveryQuery): Promise<DiscoveryOutcome>;
}
