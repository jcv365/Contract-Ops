import { RemotePolicy, ContractType, OpportunityStatus, Actionability } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';

export interface HuntSettings {
  countries: string[];
  regions: string[];
  contractTypes: string[];
  remoteOnly: boolean;
  seniority: string[];
  excludedKeywords: string[];
  requiredSkills: string[];
  preferredSkills: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  gaps: string[];
  notes: string;
}

const FRESHNESS_WINDOW_DAYS = 30; // docs-pack/docs/03: the only explicit numeric threshold

// Hard filters per docs-pack/docs/03. Rule 13: a hard-filter failure must
// be PERSISTED as INELIGIBLE with a reason — never silently dropped, which
// is exactly what the legacy HUNT app did (see AUDIT-REPORT.md §2). Only
// filters this build has real evidence for are hard-excluding; anything
// the two current adapters (Jobicy, JobsCollider) don't supply evidence
// for (clearance, work authorisation, language) is recorded as a gap for
// human review rather than guessed at — rule 8/doc 24: never fabricate.
export interface EligibilityInput {
  title: string;
  remotePolicy: RemotePolicy | null;
  contractType: ContractType | null;
  postedAt: Date | null;
  location: string | null;
}

export function evaluateEligibility(opportunity: EligibilityInput, settings: HuntSettings): EligibilityResult {
  const reasons: string[] = [];
  const gaps: string[] = [];
  let eligible = true;

  if (settings.remoteOnly) {
    if (opportunity.remotePolicy === RemotePolicy.HYBRID || opportunity.remotePolicy === RemotePolicy.ONSITE) {
      eligible = false;
      reasons.push(`Excluded: remotePolicy is ${opportunity.remotePolicy}, remote-only is configured`);
    } else if (!opportunity.remotePolicy || opportunity.remotePolicy === RemotePolicy.UNKNOWN) {
      gaps.push('Remote policy not confirmed by source');
    }
  }

  if (opportunity.contractType === ContractType.PERMANENT && !settings.contractTypes.includes('PERMANENT')) {
    eligible = false;
    reasons.push('Excluded: permanent role, permanent not enabled in contract preferences');
  } else if (!opportunity.contractType || opportunity.contractType === ContractType.UNKNOWN) {
    gaps.push('Contract type not confirmed by source');
  }

  if (opportunity.postedAt) {
    const ageDays = (Date.now() - opportunity.postedAt.getTime()) / 86_400_000;
    if (ageDays > FRESHNESS_WINDOW_DAYS) {
      eligible = false;
      reasons.push(`Excluded: posted ${Math.round(ageDays)} days ago, outside the ${FRESHNESS_WINDOW_DAYS}-day freshness window`);
    }
  } else {
    gaps.push('Posted date not confirmed by source');
  }

  const haystack = `${opportunity.title}`.toLowerCase();
  for (const keyword of settings.excludedKeywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      eligible = false;
      reasons.push(`Excluded: title contains excluded keyword "${keyword}"`);
    }
  }

  gaps.push('Clearance requirement not evaluated (no adapter currently supplies this evidence)');
  gaps.push('Work authorisation not evaluated (no adapter currently supplies this evidence)');

  const notes = eligible
    ? gaps.length > 0
      ? `Passed hard filters; unresolved gaps: ${gaps.join('; ')}`
      : 'Passed all hard filters'
    : `Failed hard filters: ${reasons.join('; ')}`;

  return { eligible, reasons, gaps, notes };
}

export async function evaluateOpportunityEligibility(opportunityId: string, settings: HuntSettings): Promise<void> {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  const result = evaluateEligibility(opportunity, settings);

  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      status: result.eligible ? OpportunityStatus.ELIGIBLE : OpportunityStatus.INELIGIBLE,
      reasons: result.reasons,
      gaps: result.gaps,
      eligibilityNotes: result.notes,
      // A hard-filter failure can never be actionable, regardless of what
      // scoring later computes (rule 13). Scoring may still move ELIGIBLE
      // opportunities to REVIEW/UNKNOWN, but never promotes an INELIGIBLE
      // one to ACTIONABLE.
      actionability: result.eligible ? undefined : Actionability.EXCLUDED,
      actionabilityReason: result.eligible ? undefined : result.notes,
    },
  });

  logger.info({ opportunityId, eligible: result.eligible }, 'Eligibility evaluated');
}
