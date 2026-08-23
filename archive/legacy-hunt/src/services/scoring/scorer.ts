import { Opportunity, ScoringModel } from '../../models';

export class OpportunityScorer {
  private model: ScoringModel;

  constructor(model: ScoringModel) {
    this.model = model;
  }

  async score(opportunity: Opportunity): Promise<Opportunity> {
    const scores = await this.calculateScores(opportunity);

    opportunity.fitScores = {
      technical: scores.technical,
      contract: scores.contract,
      remote: scores.remote,
      eligibility: scores.eligibility,
      commercial: scores.commercial,
      recruiterAccessibility: scores.recruiterAccessibility,
      overall: scores.overall,
    };

    opportunity.status = 'scored';
    opportunity.lastUpdated = new Date();

    return opportunity;
  }

  private async calculateScores(opportunity: Opportunity): Promise<{
    technical: number;
    contract: number;
    remote: number;
    eligibility: number;
    commercial: number;
    recruiterAccessibility: number;
    overall: number;
  }> {
    const weights = this.model.weights;

    // Technical fit (based on title and description)
    const technicalScore = await this.calculateTechnicalFit(opportunity);

    // Contract fit
    const contractScore = this.calculateContractFit(opportunity);

    // Remote fit
    const remoteScore = opportunity.eligibility.remote ? 10 : 0;

    // Eligibility score
    const eligibilityScore = await this.calculateEligibilityScore(opportunity);

    // Commercial fit (rate and currency)
    const commercialScore = this.calculateCommercialFit(opportunity);

    // Recruiter accessibility
    const recruiterScore = opportunity.recruiter?.relationshipScore || 0;

    // Calculate weighted scores
    const technical = Math.round(technicalScore * weights.technical);
    const contract = Math.round(contractScore * weights.contract);
    const remote = Math.round(remoteScore * weights.remote);
    const eligibility = Math.round(eligibilityScore * weights.eligibility);
    const commercial = Math.round(commercialScore * weights.commercial);
    const recruiterAccessibility = Math.round(recruiterScore * weights.recruiterAccessibility);

    const overall = Math.round(
      (technical + contract + remote + eligibility + commercial + recruiterAccessibility) / 6
    );

    return {
      technical,
      contract,
      remote,
      eligibility,
      commercial,
      recruiterAccessibility,
      overall,
    };
  }

  private async calculateTechnicalFit(opportunity: Opportunity): Promise<number> {
    // Simplified technical fit calculation
    // In production, this would use AI to analyze the opportunity against technical requirements
    const titleKeywords = [
      'architect', 'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker',
      'microservices', 'system', 'infrastructure', 'devops', 'security',
      'ai', 'machine learning', 'data', 'database', 'network', 'security'
    ];

    const description = (opportunity.description || '').toLowerCase();
    const title = opportunity.title.toLowerCase();

    let score = 0;
    for (const keyword of titleKeywords) {
      if (title.includes(keyword) || description.includes(keyword)) {
        score += 2;
      }
    }

    return Math.min(score, 10);
  }

  private calculateContractFit(opportunity: Opportunity): number {
    const contractTypes = ['freelance', 'contract', 'sow', 'project'];
    const fitScore = contractTypes.includes(opportunity.contractType) ? 10 : 5;

    return fitScore;
  }

  private async calculateEligibilityScore(opportunity: Opportunity): Promise<number> {
    let score = 0;

    if (opportunity.eligibility.remote) score += 3;
    if (opportunity.eligibility.contract) score += 3;
    if (opportunity.eligibility.seniority) score += 2;
    if (opportunity.eligibility.architectureRelevant) score += 2;
    if (opportunity.eligibility.workAuthorization) score += 2;

    return Math.min(score, 10);
  }

  private calculateCommercialFit(opportunity: Opportunity): number {
    // Simplified commercial fit based on rate
    const rate = opportunity.rate || 0;
    const zarRate = opportunity.zarRate || 0;

    // Assume a good rate is >= $100/hr or equivalent in ZAR
    const goodRate = 100;
    const fitScore = rate >= goodRate ? 10 : Math.round((rate / goodRate) * 10);

    return Math.min(fitScore, 10);
  }

  async scoreAll(opportunities: Opportunity[]): Promise<Opportunity[]> {
    const scored: Opportunity[] = [];

    for (const opportunity of opportunities) {
      const scoredOpportunity = await this.score(opportunity);
      scored.push(scoredOpportunity);
    }

    return scored;
  }
}

export const opportunityScorer = new OpportunityScorer({
  id: 'default',
  name: 'Default Scoring Model',
  weights: {
    technical: 0.2,
    contract: 0.15,
    remote: 0.15,
    eligibility: 0.2,
    commercial: 0.15,
    recruiterAccessibility: 0.15,
  },
  thresholds: {
    high: 8,
    medium: 5,
    low: 3,
  },
  description: 'Default scoring model for opportunities',
});