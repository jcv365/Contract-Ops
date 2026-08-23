import { Source, Recruiter, Company } from '../../models';
import { query } from '../../database';

export class SourceRegistry {
  private sources: Map<string, Source> = new Map();
  private recruiters: Map<string, Recruiter> = new Map();
  private companies: Map<string, Company> = new Map();

  async initialize() {
    const result = await query('SELECT * FROM sources WHERE enabled = true');
    for (const row of result.rows) {
      this.sources.set(row.id, row as Source);
    }
    console.log(`Loaded ${this.sources.size} enabled sources`);
  }

  async addSource(source: Source) {
    await query(
      `INSERT INTO sources (id, name, type, url, enabled, last_checked, health_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         url = EXCLUDED.url,
         enabled = EXCLUDED.enabled,
         last_checked = EXCLUDED.last_checked,
         health_status = EXCLUDED.health_status`,
      [source.id, source.name, source.type, source.url, source.enabled, source.lastChecked, source.healthStatus]
    );
    this.sources.set(source.id, source);
  }

  async getSource(id: string): Promise<Source | undefined> {
    if (!this.sources.has(id)) {
      const result = await query('SELECT * FROM sources WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        this.sources.set(id, result.rows[0] as Source);
      }
    }
    return this.sources.get(id);
  }

  async getAllSources(): Promise<Source[]> {
    return Array.from(this.sources.values());
  }

  async getEnabledSources(): Promise<Source[]> {
    return Array.from(this.sources.values()).filter(s => s.enabled);
  }

  async updateSourceHealth(id: string, status: 'healthy' | 'degraded' | 'unhealthy') {
    await query(
      'UPDATE sources SET health_status = $1, last_checked = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );
    const source = this.sources.get(id);
    if (source) {
      source.healthStatus = status;
    }
  }

  async addRecruiter(recruiter: Recruiter) {
    await query(
      `INSERT INTO recruiters (id, name, company, email, phone, website, linkedin, verified, verification_date, source_id, source_provenance, last_contacted, contact_count, relationship_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         company = EXCLUDED.company,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         website = EXCLUDED.website,
         linkedin = EXCLUDED.linkedin,
         verified = EXCLUDED.verified,
         verification_date = EXCLUDED.verification_date,
         source_id = EXCLUDED.source_id,
         source_provenance = EXCLUDED.source_provenance,
         last_contacted = EXCLUDED.last_contacted,
         contact_count = EXCLUDED.contact_count,
         relationship_score = EXCLUDED.relationship_score,
         notes = EXCLUDED.notes`,
      [
        recruiter.id,
        recruiter.name,
        recruiter.company,
        recruiter.email,
        recruiter.phone,
        recruiter.website,
        recruiter.linkedin,
        recruiter.verified,
        recruiter.verificationDate,
        recruiter.sourceId,
        recruiter.sourceProvenance,
        recruiter.lastContacted,
        recruiter.contactCount,
        recruiter.relationshipScore,
        recruiter.notes,
      ]
    );
    this.recruiters.set(recruiter.id, recruiter);
  }

  async getRecruiter(id: string): Promise<Recruiter | undefined> {
    if (!this.recruiters.has(id)) {
      const result = await query('SELECT * FROM recruiters WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        this.recruiters.set(id, result.rows[0] as Recruiter);
      }
    }
    return this.recruiters.get(id);
  }

  async getAllRecruiters(): Promise<Recruiter[]> {
    return Array.from(this.recruiters.values());
  }

  async addCompany(company: Company) {
    await query(
      `INSERT INTO companies (id, name, industry, website, linkedin, size, location, description, verified, verification_date, source_id, source_provenance, last_contacted, contact_count, relationship_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         industry = EXCLUDED.industry,
         website = EXCLUDED.website,
         linkedin = EXCLUDED.linkedin,
         size = EXCLUDED.size,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         verified = EXCLUDED.verified,
         verification_date = EXCLUDED.verification_date,
         source_id = EXCLUDED.source_id,
         source_provenance = EXCLUDED.source_provenance,
         last_contacted = EXCLUDED.last_contacted,
         contact_count = EXCLUDED.contact_count,
         relationship_score = EXCLUDED.relationship_score,
         notes = EXCLUDED.notes`,
      [
        company.id,
        company.name,
        company.industry,
        company.website,
        company.linkedin,
        company.size,
        company.location,
        company.description,
        company.verified,
        company.verificationDate,
        company.sourceId,
        company.sourceProvenance,
        company.lastContacted,
        company.contactCount,
        company.relationshipScore,
        company.notes,
      ]
    );
    this.companies.set(company.id, company);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    if (!this.companies.has(id)) {
      const result = await query('SELECT * FROM companies WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        this.companies.set(id, result.rows[0] as Company);
      }
    }
    return this.companies.get(id);
  }

  async getAllCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }
}

export const sourceRegistry = new SourceRegistry();