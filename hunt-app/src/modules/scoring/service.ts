import { Opportunity, OpportunityStatus, RemotePolicy, Actionability } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { HuntSettings } from '../eligibility/service';

// Weights sum to 1.0 and every component is already on a 0-10 scale, so
// the weighted sum is directly a 0-10 overallPriority — no further
// division. The legacy HUNT scorer (archive/legacy-hunt/src/services/
// scoring/scorer.ts) divided this same kind of weighted sum by 6 again,
// which made "medium" fit (threshold 5) mathematically unreachable. Fixed
// here by not doing that.
const WEIGHTS = {
  technicalFit: 0.2,
  contractFit: 0.15,
  remoteFit: 0.15,
  eligibility: 0.2,
  commercialFit: 0.15,
  recruiterAccessibility: 0.15,
} as const;

export interface ScoreComponents {
  technicalFit: number;
  contractFit: number;
  remoteFit: number;
  eligibility: number;
  commercialFit: number;
  recruiterAccessibility: number;
  overallPriority: number;
}

function scoreTechnicalFit(title: string, requiredSkills: string[], preferredSkills: string[]): number {
  const haystack = title.toLowerCase();
  const requiredHits = requiredSkills.filter((s) => haystack.includes(s.toLowerCase())).length;
  const preferredHits = preferredSkills.filter((s) => haystack.includes(s.toLowerCase())).length;
  const requiredScore = requiredSkills.length > 0 ? (requiredHits / requiredSkills.length) * 7 : 0;
  const preferredScore = preferredSkills.length > 0 ? (preferredHits / preferredSkills.length) * 3 : 0;
  return Math.min(10, requiredScore + preferredScore);
}

function scoreContractFit(contractType: Opportunity['contractType'], configured: string[]): number {
  if (!contractType || contractType === 'UNKNOWN') return 5;
  return configured.includes(contractType) ? 10 : 0;
}

function scoreRemoteFit(remotePolicy: RemotePolicy | null): number {
  switch (remotePolicy) {
    case RemotePolicy.FULLY_REMOTE:
      return 10;
    case RemotePolicy.REMOTE_FIRST:
      return 9;
    case RemotePolicy.HYBRID:
      return 3;
    case RemotePolicy.ONSITE:
      return 0;
    default:
      return 5;
  }
}

function scoreEligibilityDimension(status: OpportunityStatus, gaps: string[]): number {
  if (status === OpportunityStatus.INELIGIBLE) return 0;
  return Math.max(0, 10 - gaps.length * 1.5);
}

// No configured target rate range exists yet (Sprint 0 decision: the
// fabricated rate range was stripped, and no real profile has been
// imported). Scored neutral rather than guessed — this is exactly the
// kind of "explicit unknown, never fabricated" rule 8/doc 27 requires.
// Revisit once Profile.contractPreferences.rateRangeZAR is populated from
// real, approved evidence.
function scoreCommercialFit(): number {
  return 5;
}

// No recruiter is linked to an opportunity discovered directly from a job
// board (Sprint 2 builds recruiter/company intelligence). Neutral until then.
function scoreRecruiterAccessibility(): number {
  return 5;
}

export function computeScores(
  opportunity: Pick<Opportunity, 'title' | 'contractType' | 'remotePolicy' | 'status' | 'gaps'>,
  settings: HuntSettings
): ScoreComponents {
  const technicalFit = scoreTechnicalFit(opportunity.title, settings.requiredSkills, settings.preferredSkills);
  const contractFit = scoreContractFit(opportunity.contractType, settings.contractTypes);
  const remoteFit = scoreRemoteFit(opportunity.remotePolicy);
  const eligibility = scoreEligibilityDimension(opportunity.status, opportunity.gaps);
  const commercialFit = scoreCommercialFit();
  const recruiterAccessibility = scoreRecruiterAccessibility();

  const overallPriority =
    technicalFit * WEIGHTS.technicalFit +
    contractFit * WEIGHTS.contractFit +
    remoteFit * WEIGHTS.remoteFit +
    eligibility * WEIGHTS.eligibility +
    commercialFit * WEIGHTS.commercialFit +
    recruiterAccessibility * WEIGHTS.recruiterAccessibility;

  return { technicalFit, contractFit, remoteFit, eligibility, commercialFit, recruiterAccessibility, overallPriority };
}

// Must run after eligibility evaluation. A hard-filter failure (status
// INELIGIBLE) can never reach ACTIONABLE (rule 13), regardless of how the
// other six components score — enforced structurally below, not just by a
// low number that a future weight change could accidentally overcome.
export async function scoreOpportunity(opportunityId: string, settings: HuntSettings): Promise<void> {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });

  if (opportunity.status === OpportunityStatus.INELIGIBLE) {
    logger.info({ opportunityId }, 'Skipping scoring: opportunity already excluded by hard filters');
    return;
  }

  const scores = computeScores(opportunity, settings);
  const fitScore = Math.round(scores.overallPriority * 100) / 100;

  const actionability =
    opportunity.status === OpportunityStatus.ELIGIBLE && opportunity.gaps.length === 0
      ? Actionability.ACTIONABLE
      : opportunity.status === OpportunityStatus.ELIGIBLE
        ? Actionability.REVIEW
        : Actionability.UNKNOWN;

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      scores: scores as unknown as object,
      fitScore,
      actionability,
      actionabilityReason:
        actionability === Actionability.REVIEW
          ? `Eligible but has unresolved gaps: ${opportunity.gaps.join('; ')}`
          : actionability === Actionability.ACTIONABLE
            ? 'Passed hard filters with no unresolved gaps; fit score computed'
            : undefined,
    },
  });

  logger.info({ opportunityId, fitScore, actionability }, 'Opportunity scored');
}
