// §84 company_target_score. Reuses company-intelligence/scoring.ts's
// scoreCompany() output as INPUT, but converts its three neutral-5
// dimensions (remoteDelivery, companySizeMarket, transformationActivity —
// scored neutral there for lack of an evidence source) into explicit
// unknowns here, since §84 forbids awarding points for unknown
// information and scoreCompany()'s neutral-5 convention would otherwise
// silently leak points into a score that's supposed to be zero-for-unknown.
//
// Documented conflict (rule 20): scoreCompany() itself is left unchanged
// and relabelled "capability profile score" in the UI — this is a
// SEPARATE score, not a replacement.
import { CompanyScores } from '../company-intelligence/scoring';
import { ExplainableScore, ScoreComponent, assemble } from './types';

const UNKNOWN_DIMENSIONS = new Set<keyof CompanyScores>(['remoteDelivery', 'companySizeMarket', 'transformationActivity']);

export interface CompanyTargetInput {
  companyScores: CompanyScores;
  hasValidContactChannel: boolean;
  hasNamedContact: boolean;
}

export function scoreCompanyTarget(input: CompanyTargetInput): ExplainableScore {
  const dimensionComponents: ScoreComponent[] = (Object.entries(input.companyScores) as Array<[keyof CompanyScores, number]>)
    .filter(([key]) => key !== 'overall')
    .map(([key, value]) => {
      const known = !UNKNOWN_DIMENSIONS.has(key);
      return {
        name: key,
        points: known ? value : 0,
        max: 10,
        evidence: known ? `scoreCompany().${key} = ${value}` : 'no evidence source for this dimension yet (see scoring.ts)',
        known,
      };
    });

  const components: ScoreComponent[] = [
    ...dimensionComponents,
    {
      name: 'valid_contact_channel',
      points: input.hasValidContactChannel ? 10 : 0,
      max: 10,
      evidence: input.hasValidContactChannel ? 'a verified contact channel is on file' : 'no verified contact channel yet',
      known: true,
    },
    {
      name: 'named_contact',
      points: input.hasNamedContact ? 10 : 0,
      max: 10,
      evidence: input.hasNamedContact ? 'a named contact is linked to this company' : 'no named contact identified yet',
      known: true,
    },
  ];

  return assemble(components);
}
