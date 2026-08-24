// The rule-12 / doc-01 "worldwide coverage matrix" — CLAUDE.md rule 12
// forbids reporting worldwide coverage unless this configured matrix was
// actually searched. Restored 2026-08-24 after a live bug: an earlier
// test of the portal's settings form left this narrowed to ZA/GB/US on
// the live system (see AUDIT-REPORT.md). ISO 3166-1 alpha-2 codes.
//
// Honesty note: actual search reach is still bounded by how many source
// adapters exist (two, as of this matrix — see
// src/modules/source-adapters/index.ts). Listing a country here declares
// intent to search it; it does not by itself grant the ability to.
export const WORLDWIDE_COUNTRIES: readonly string[] = [
  // Europe
  'GB', 'IE', 'DE', 'NL', 'BE', 'LU', 'FR', 'CH', 'AT', 'ES', 'PT', 'IT',
  'PL', 'CZ', 'DK', 'SE', 'NO', 'FI', 'IS', 'EE', 'LV', 'LT', 'RO', 'HU', 'GR',
  // Middle East
  'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'JO', 'IL', 'TR',
  // Africa
  'ZA', 'EG', 'MA', 'KE', 'NG', 'GH', 'MU', 'RW',
  // North America
  'US', 'CA', 'MX',
  // Latin America
  'BR', 'AR', 'CL', 'CO',
  // Asia
  'IN', 'SG', 'HK', 'JP', 'KR', 'CN', 'MY', 'ID', 'PH', 'TH', 'VN',
  // Oceania
  'AU', 'NZ',
];

export const WORLDWIDE_REGIONS: readonly string[] = [
  'EUROPE',
  'MIDDLE_EAST',
  'AFRICA',
  'NORTH_AMERICA',
  'LATIN_AMERICA',
  'ASIA',
  'OCEANIA',
];
