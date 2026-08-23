// Deliberately typed on plain strings rather than either @prisma/client's
// or domain/types' CompanyType enum: this module is called from the DB
// service layer (Prisma's enum) and tested with domain/types' enum, which
// are structurally identical at runtime but nominally distinct TS enum
// types. Comparing by string value avoids friction between the two
// without introducing a third mapping layer.
//
// docs-pack/docs/06 — 8 company scoring dimensions. Several (size/market,
// current transformation activity, remote-delivery capability) have no
// evidence source this build currently has access to and are scored
// neutral (5) rather than guessed — the same "never fabricate, explicit
// unknown" discipline used in modules/scoring for opportunities.
export interface CompanyScores {
  cloudRelevance: number;
  azureRelevance: number;
  contractUsage: number;
  remoteDelivery: number;
  internationalWork: number;
  subcontractingPotential: number;
  companySizeMarket: number;
  transformationActivity: number;
  overall: number;
}

const CLOUD_KEYWORDS = ['cloud', 'azure', 'aws', 'gcp', 'kubernetes', 'infrastructure', 'devops', 'platform'];

// Types most likely to subcontract specialist architects (docs-pack/docs/06:
// "companies likely to subcontract specialist architects").
const HIGH_SUBCONTRACT_TYPES = new Set<string>([
  'CLOUD_CONSULTANCY',
  'SYSTEMS_INTEGRATOR',
  'DELIVERY_PARTNER',
  'SPECIALIST_TECH_CONSULTANCY',
]);

const HIGH_CONTRACT_USAGE_TYPES = new Set<string>([
  'CLOUD_CONSULTANCY',
  'SYSTEMS_INTEGRATOR',
  'DELIVERY_PARTNER',
  'MANAGED_SERVICES',
]);

export interface ScoreCompanyInput {
  type?: string | null;
  specialisms: string[];
  regions: string[];
}

export function scoreCompany(company: ScoreCompanyInput): CompanyScores {
  const specialismsText = company.specialisms.join(' ').toLowerCase();
  const cloudHits = CLOUD_KEYWORDS.filter((k) => specialismsText.includes(k)).length;
  const cloudRelevance = Math.min(10, (cloudHits / CLOUD_KEYWORDS.length) * 20);
  const azureRelevance = specialismsText.includes('azure') ? 10 : 0;

  const contractUsage = company.type && HIGH_CONTRACT_USAGE_TYPES.has(company.type) ? 8 : 5;

  const internationalWork = company.regions.length >= 2 ? 10 : company.regions.length === 1 ? 5 : 0;
  const remoteDelivery = 5; // no evidence source yet — neutral, not guessed

  const subcontractingPotential = !company.type
    ? 5
    : HIGH_SUBCONTRACT_TYPES.has(company.type)
      ? 10
      : company.type === 'DIRECT_CLIENT'
        ? 2
        : company.type === 'RECRUITMENT_AGENCY'
          ? 6
          : 5;

  const companySizeMarket = 5; // no evidence source yet — neutral, not guessed
  const transformationActivity = 5; // no evidence source yet — neutral, not guessed

  const overall =
    (cloudRelevance +
      azureRelevance +
      contractUsage +
      remoteDelivery +
      internationalWork +
      subcontractingPotential +
      companySizeMarket +
      transformationActivity) /
    8;

  return {
    cloudRelevance,
    azureRelevance,
    contractUsage,
    remoteDelivery,
    internationalWork,
    subcontractingPotential,
    companySizeMarket,
    transformationActivity,
    overall: Math.round(overall * 100) / 100,
  };
}
