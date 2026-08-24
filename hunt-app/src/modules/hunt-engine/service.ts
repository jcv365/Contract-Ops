import { AdapterStatus, SearchRunStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { adapterRegistry } from '../source-adapters';
import { SearchParams } from '../source-adapters/base';
import { normaliseOpportunity } from '../normalisation/service';
import { evaluateOpportunityEligibility, HuntSettings } from '../eligibility/service';
import { scoreOpportunity } from '../scoring/service';
import { applyFxToOpportunity } from '../fx/service';
import { computeCoveragePercent } from '../coverage/service';
import { WORLDWIDE_COUNTRIES, WORLDWIDE_REGIONS } from '../../config/worldwide-matrix';

interface StoredUserSettings {
  hunt?: Partial<HuntSettings>;
}

// Fallback only — the real settings live in User.settings.hunt (seeded
// with the same worldwide matrix, editable via the portal). This exists
// so a HUNT run against a user row with no settings configured at all
// still declares a real matrix rather than an empty one that would
// silently report 0% of nothing as "complete" coverage.
const DEFAULT_HUNT_SETTINGS: HuntSettings = {
  countries: [...WORLDWIDE_COUNTRIES],
  regions: [...WORLDWIDE_REGIONS],
  contractTypes: ['FREELANCE', 'CONTRACT', 'SOW', 'PROJECT', 'CONSULTING'],
  remoteOnly: true,
  seniority: [],
  excludedKeywords: [],
  requiredSkills: [],
  preferredSkills: [],
  allowedClearanceLevels: ['NONE'],
};

async function loadHuntSettings(): Promise<HuntSettings> {
  const user = await prisma.user.findUnique({ where: { id: 'default-user' } });
  const stored = (user?.settings as StoredUserSettings | undefined)?.hunt;
  return { ...DEFAULT_HUNT_SETTINGS, ...stored };
}

export interface HuntRunSummary {
  searchRunId: string;
  status: SearchRunStatus;
  coveragePercent: number;
  sourcesSucceeded: string[];
  sourcesFailed: string[];
  totalOpportunitiesFound: number;
  totalOpportunitiesNew: number;
}

// The end-to-end HUNT -> normalise -> dedup -> eligibility -> scoring ->
// FX pipeline for one run, per docs-pack/docs/02's data-flow contract
// (SourceAdapter -> CanonicalOpportunity). Every source attempted is
// recorded in SourceCoverage — success or failure — so coverage can never
// silently overstate what was actually searched (rule 12 / doc 25).
export async function runHunt(params: SearchParams = {}): Promise<HuntRunSummary> {
  const settings = await loadHuntSettings();

  const activeSources = await prisma.source.findMany({
    where: { adapterStatus: AdapterStatus.ACTIVE },
  });

  const searchRun = await prisma.searchRun.create({
    data: {
      status: SearchRunStatus.RUNNING,
      countriesConfigured: settings.countries,
      regionsConfigured: settings.regions,
      sourcesConfigured: activeSources.map((s) => s.sourceId),
    },
  });

  const mergedParams: SearchParams = {
    contractTypes: undefined,
    remoteOnly: settings.remoteOnly,
    ...params,
  };

  const results = await adapterRegistry.searchMany(
    activeSources.map((s) => s.sourceId),
    mergedParams
  );

  const sourcesSucceeded: string[] = [];
  const sourcesFailed: string[] = [];
  let totalFound = 0;
  let totalNew = 0;

  for (const result of results) {
    const source = activeSources.find((s) => s.sourceId === result.sourceId);
    if (!source) continue;

    const succeeded = result.errors.length === 0;
    if (succeeded) sourcesSucceeded.push(source.sourceId);
    else sourcesFailed.push(source.sourceId);

    await prisma.sourceCoverage.create({
      data: {
        searchRunId: searchRun.id,
        sourceId: source.id,
        attempted: true,
        succeeded,
        resultCount: result.opportunities.length,
        latencyMs: result.latencyMs,
        error: result.errors[0],
      },
    });

    await prisma.sourceHealthCheck.create({
      data: {
        sourceId: source.id,
        status: succeeded ? 'HEALTHY' : 'UNHEALTHY',
        latencyMs: result.latencyMs,
        error: result.errors[0],
      },
    });
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastHealthCheck: new Date(),
        lastSuccessfulSearch: succeeded ? new Date() : undefined,
        adapterStatus: succeeded ? AdapterStatus.ACTIVE : AdapterStatus.DEGRADED,
      },
    });

    totalFound += result.opportunities.length;

    for (const raw of result.opportunities) {
      try {
        const { opportunityId, created } = await normaliseOpportunity(source, raw);
        if (created) totalNew += 1;
        await evaluateOpportunityEligibility(opportunityId, settings);
        await scoreOpportunity(opportunityId, settings);
        await applyFxToOpportunity(opportunityId);
      } catch (err) {
        logger.error({ sourceId: source.sourceId, externalId: raw.externalId, err }, 'Failed to process opportunity');
      }
    }
  }

  const coveragePercent = computeCoveragePercent(
    activeSources.map((s) => s.sourceId),
    sourcesSucceeded
  );

  await prisma.searchRun.update({
    where: { id: searchRun.id },
    data: {
      status: SearchRunStatus.COMPLETED,
      completedAt: new Date(),
      sourcesSucceeded,
      sourcesFailed,
      coveragePercent,
      totalOpportunitiesFound: totalFound,
      totalOpportunitiesNew: totalNew,
    },
  });

  logger.info(
    { searchRunId: searchRun.id, coveragePercent, sourcesSucceeded, sourcesFailed, totalFound, totalNew },
    'HUNT run completed'
  );

  return {
    searchRunId: searchRun.id,
    status: SearchRunStatus.COMPLETED,
    coveragePercent,
    sourcesSucceeded,
    sourcesFailed,
    totalOpportunitiesFound: totalFound,
    totalOpportunitiesNew: totalNew,
  };
}
