// docs-pack/docs/25: coverage is computed from actual successful searches,
// never from the configured source list alone. A source that failed, was
// blocked, lacked credentials, or could not execute reduces the reported
// percentage and must appear as a visible gap — it is never silently
// treated as "not counted" (which would inflate the percentage) or hidden.
export function computeCoveragePercent(sourcesConfigured: string[], sourcesSucceeded: string[]): number {
  if (sourcesConfigured.length === 0) return 0;
  return Math.round((sourcesSucceeded.length / sourcesConfigured.length) * 10000) / 100;
}

// Sprint 1 scope note: this is source-level coverage only. Country/region
// coverage (docs-pack/docs/01's "countries searched") requires
// country-scoped adapters, which don't exist yet — both enabled sources
// (Jobicy, JobsCollider) are global feeds, not per-country. SearchRun still
// records countriesConfigured/regionsConfigured for visibility, but no
// per-country success/failure is computed until a country-scoped adapter
// exists. Documented here rather than silently implied.
export const COVERAGE_SCOPE_NOTE =
  'Coverage percentage reflects source-level search success only; per-country coverage requires country-scoped adapters not yet built.';
