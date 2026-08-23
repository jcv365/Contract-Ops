import { SourceRegistry } from './registry';
import { Source, Recruiter, Company, Opportunity } from '../../models';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../database';

export class HuntDiscovery {
  constructor(private sourceRegistry: SourceRegistry) {}

  async discoverOpportunities(
    searchTerms: string[],
    maxResults: number = 50
  ): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    const enabledSources = await this.sourceRegistry.getEnabledSources();

    for (const source of enabledSources) {
      try {
        const sourceOpportunities = await this.searchSource(source, searchTerms);
        opportunities.push(...sourceOpportunities);
      } catch (error) {
        console.error(`Error searching source ${source.name}:`, error);
        await this.sourceRegistry.updateSourceHealth(source.id, 'unhealthy');
      }
    }

    // Deduplicate and limit results
    const uniqueOpportunities = this.deduplicateOpportunities(opportunities);
    return uniqueOpportunities.slice(0, maxResults);
  }

  private async searchSource(source: Source, searchTerms: string[]): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    switch (source.type) {
      case 'job-board':
        opportunities.push(...await this.searchJobBoards(source, searchTerms));
        break;
      case 'recruiter':
        opportunities.push(...await this.searchRecruiters(source, searchTerms));
        break;
      case 'company':
        opportunities.push(...await this.searchCompanies(source, searchTerms));
        break;
      case 'procurement':
        opportunities.push(...await this.searchProcurement(source, searchTerms));
        break;
      default:
        console.warn(`Unknown source type: ${source.type}`);
    }

    return opportunities;
  }

  private async searchJobBoards(source: Source, searchTerms: string[]): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    const terms = searchTerms.join(' ');

    // Example: Search Career-Ops
    if (source.name.toLowerCase().includes('career') || source.name.toLowerCase().includes('ops')) {
      const result = await query(
        `SELECT * FROM career_ops_jobs
         WHERE title ILIKE $1 OR description ILIKE $1
         AND status = 'active'
         AND remote = true
         AND contract_type IN ('freelance', 'contract', 'sow', 'project')
         ORDER BY posted_date DESC
         LIMIT 20`,
        [`%${terms}%`]
      );

      for (const row of result.rows) {
        opportunities.push(this.mapToOpportunity(row, source));
      }
    }

    // Example: Search Jobicy
    if (source.name.toLowerCase().includes('jobicy')) {
      const result = await query(
        `SELECT * FROM jobicy_jobs
         WHERE title ILIKE $1 OR description ILIKE $1
         AND remote = true
         AND contract_type IN ('freelance', 'contract', 'sow', 'project')
         ORDER BY posted_date DESC
         LIMIT 20`,
        [`%${terms}%`]
      );

      for (const row of result.rows) {
        opportunities.push(this.mapToOpportunity(row, source));
      }
    }

    // Example: Search JobsCollider
    if (source.name.toLowerCase().includes('collider')) {
      const result = await query(
        `SELECT * FROM jobscollider_jobs
         WHERE title ILIKE $1 OR description ILIKE $1
         AND remote = true
         AND contract_type IN ('freelance', 'contract', 'sow', 'project')
         ORDER BY posted_date DESC
         LIMIT 20`,
        [`%${terms}%`]
      );

      for (const row of result.rows) {
        opportunities.push(this.mapToOpportunity(row, source));
      }
    }

    return opportunities;
  }

  private async searchRecruiters(source: Source, searchTerms: string[]): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    // Search for recruiter profiles
    const result = await query(
      `SELECT * FROM recruiters
       WHERE name ILIKE $1 OR company ILIKE $1
       AND verified = true
       ORDER BY relationship_score DESC
       LIMIT 20`,
      [`%${searchTerms[0]}%`]
    );

    for (const row of result.rows) {
      opportunities.push(this.mapToRecruiterOpportunity(row, source));
    }

    return opportunities;
  }

  private async searchCompanies(source: Source, searchTerms: string[]): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    // Search for company profiles
    const result = await query(
      `SELECT * FROM companies
       WHERE name ILIKE $1 OR industry ILIKE $1
       AND verified = true
       ORDER BY relationship_score DESC
       LIMIT 20`,
      [`%${searchTerms[0]}%`]
    );

    for (const row of result.rows) {
      opportunities.push(this.mapToCompanyOpportunity(row, source));
    }

    return opportunities;
  }

  private async searchProcurement(source: Source, searchTerms: string[]): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    // Search for procurement opportunities
    const result = await query(
      `SELECT * FROM procurement_opportunities
       WHERE title ILIKE $1 OR description ILIKE $1
       AND status = 'open'
       ORDER BY posted_date DESC
       LIMIT 20`,
      [`%${searchTerms.join(' ')}%`]
    );

    for (const row of result.rows) {
      opportunities.push(this.mapToOpportunity(row, source));
    }

    return opportunities;
  }

  private mapToOpportunity(row: any, source: Source): Opportunity {
    return {
      id: uuidv4(),
      title: row.title,
      description: row.description,
      source,
      sourceUrl: row.url || source.url,
      advertisedDate: row.posted_date || new Date(),
      company: row.company_id ? undefined : undefined, // Would need to fetch company
      recruiter: row.recruiter_id ? undefined : undefined, // Would need to fetch recruiter
      location: row.location,
      remotePolicy: row.remote ? 'remote' : 'onsite',
      contractType: row.contract_type || 'contract',
      duration: row.duration,
      rate: row.rate || 0,
      currency: row.currency || 'USD',
      zarRate: row.zar_rate,
      eligibility: {
        remote: row.remote || false,
        contract: ['freelance', 'contract', 'sow', 'project'].includes(row.contract_type || ''),
        seniority: true, // Default assumption
        architectureRelevant: true, // Default assumption
        securityClearance: row.security_clearance || false,
        workAuthorization: row.work_authorization || true,
        mandatoryLanguage: row.mandatory_language,
        locationOnsite: !row.remote,
        permanent: false,
        engineerOnly: true,
      },
      fitScores: {
        technical: 0,
        contract: 0,
        remote: row.remote ? 10 : 0,
        eligibility: 0,
        commercial: 0,
        recruiterAccessibility: 0,
        overall: 0,
      },
      reasons: [],
      gaps: [],
      status: 'discovered',
      lastUpdated: new Date(),
      createdAt: new Date(),
    };
  }

  private mapToRecruiterOpportunity(row: any, source: Source): Opportunity {
    return {
      id: uuidv4(),
      title: `Contact: ${row.name} at ${row.company || 'Unknown'}`,
      description: `Recruiter profile - ${row.linkedin || 'No LinkedIn'}`,
      source,
      sourceUrl: source.url,
      advertisedDate: new Date(),
      company: row.company_id ? undefined : undefined,
      recruiter: {
        id: row.id,
        name: row.name,
        company: row.company,
        email: row.email,
        phone: row.phone,
        website: row.website,
        linkedin: row.linkedin,
        verified: row.verified,
        verificationDate: row.verification_date,
        sourceId: row.source_id,
        sourceProvenance: row.source_provenance,
        lastContacted: row.last_contacted,
        contactCount: row.contact_count,
        relationshipScore: row.relationship_score,
        notes: row.notes,
      },
      location: row.location,
      remotePolicy: 'remote',
      contractType: 'consulting',
      duration: undefined,
      rate: 0,
      currency: 'USD',
      zarRate: 0,
      eligibility: {
        remote: true,
        contract: true,
        seniority: true,
        architectureRelevant: true,
        securityClearance: false,
        workAuthorization: true,
        mandatoryLanguage: undefined,
        locationOnsite: false,
        permanent: false,
        engineerOnly: true,
      },
      fitScores: {
        technical: 0,
        contract: 0,
        remote: 10,
        eligibility: 0,
        commercial: 0,
        recruiterAccessibility: row.relationship_score || 0,
        overall: 0,
      },
      reasons: [],
      gaps: [],
      status: 'discovered',
      lastUpdated: new Date(),
      createdAt: new Date(),
    };
  }

  private mapToCompanyOpportunity(row: any, source: Source): Opportunity {
    return {
      id: uuidv4(),
      title: `Company: ${row.name}`,
      description: row.description || `Industry: ${row.industry}`,
      source,
      sourceUrl: source.url,
      advertisedDate: new Date(),
      company: {
        id: row.id,
        name: row.name,
        industry: row.industry,
        website: row.website,
        linkedin: row.linkedin,
        size: row.size,
        location: row.location,
        description: row.description,
        verified: row.verified,
        verificationDate: row.verification_date,
        sourceId: row.source_id,
        sourceProvenance: row.source_provenance,
        lastContacted: row.last_contacted,
        contactCount: row.contact_count,
        relationshipScore: row.relationship_score,
        notes: row.notes,
      },
      recruiter: undefined,
      location: row.location,
      remotePolicy: 'remote',
      contractType: 'consulting',
      duration: undefined,
      rate: 0,
      currency: 'USD',
      zarRate: 0,
      eligibility: {
        remote: true,
        contract: true,
        seniority: true,
        architectureRelevant: true,
        securityClearance: false,
        workAuthorization: true,
        mandatoryLanguage: undefined,
        locationOnsite: false,
        permanent: false,
        engineerOnly: true,
      },
      fitScores: {
        technical: 0,
        contract: 0,
        remote: 10,
        eligibility: 0,
        commercial: 0,
        recruiterAccessibility: 0,
        overall: 0,
      },
      reasons: [],
      gaps: [],
      status: 'discovered',
      lastUpdated: new Date(),
      createdAt: new Date(),
    };
  }

  private deduplicateOpportunities(opportunities: Opportunity[]): Opportunity[] {
    const seen = new Set<string>();
    const unique: Opportunity[] = [];

    for (const opp of opportunities) {
      const key = `${opp.title}-${opp.source.id}-${opp.sourceUrl}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(opp);
      }
    }

    return unique;
  }
}

export const huntDiscovery = new HuntDiscovery(sourceRegistry);