import { prisma } from '../../db/client';
import { computeRateBenchmark, RateBenchmark } from './benchmarking';
import { computeRelationshipScore } from './relationship-score';

export interface BenchmarkFilters {
  technology?: string; // matched against Opportunity.title, best-effort — no dedicated technology field exists on Opportunity yet
  location?: string;
}

// docs-pack/docs/12: compare role/geography/technology/seniority/duration
// "where sufficient data exists". Scoped to what's actually queryable
// today (title-text and location) — a dedicated technology/seniority
// facet on Opportunity would need a further schema change out of scope
// for this sprint.
export async function benchmarkZarRates(filters: BenchmarkFilters = {}): Promise<RateBenchmark> {
  const opportunities = await prisma.opportunity.findMany({
    where: {
      zarRate: { not: null },
      ...(filters.technology ? { title: { contains: filters.technology, mode: 'insensitive' } } : {}),
      ...(filters.location ? { location: { contains: filters.location, mode: 'insensitive' } } : {}),
    },
    select: { zarRate: true },
  });

  return computeRateBenchmark(opportunities.filter((o) => o.zarRate != null).map((o) => ({ zarRate: o.zarRate as number })));
}

export async function scoreRecruiterRelationship(recruiterId: string): Promise<number> {
  const recruiter = await prisma.recruiter.findUniqueOrThrow({ where: { id: recruiterId } });
  return computeRelationshipScore({
    relationshipStatus: recruiter.relationshipStatus,
    responseHistory: (recruiter.responseHistory as Array<{ respondedAt?: string | null }>) ?? [],
    opportunityHistoryCount: Array.isArray(recruiter.opportunityHistory) ? recruiter.opportunityHistory.length : 0,
  });
}

// docs-pack/docs/06/13: partner/subcontracting targeting — companies whose
// existing 8-dimension score (Sprint 2) already captures subcontracting
// potential. This is a ranked query over that score, not new scoring
// logic: modules/company-intelligence/scoring.ts is the source of truth.
export async function listPartnerCandidates(limit = 20) {
  return prisma.company.findMany({
    where: {
      type: { in: ['CLOUD_CONSULTANCY', 'SYSTEMS_INTEGRATOR', 'DELIVERY_PARTNER', 'SPECIALIST_TECH_CONSULTANCY'] },
    },
    orderBy: { score: 'desc' },
    take: limit,
  });
}
