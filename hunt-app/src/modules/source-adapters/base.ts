import { Opportunity, ContractType, RemotePolicy, RatePeriod, ClearanceLevel, WorkAuthorisation, uuid } from '../../domain/types';

export interface RawOpportunity {
  externalId: string;
  url: string;
  title: string;
  companyName?: string;
  companyWebsite?: string;
  recruiterName?: string;
  recruiterProfileUrl?: string;
  postedAt?: Date;
  contractType?: ContractType;
  duration?: string;
  remotePolicy?: RemotePolicy;
  location?: string;
  language?: string;
  clearance?: ClearanceLevel;
  workAuthorisation?: WorkAuthorisation;
  originalRate?: number;
  originalCurrency?: string;
  ratePeriod?: RatePeriod;
  description?: string;
  skills?: string[];
  rawData: Record<string, unknown>;
}

export interface SearchParams {
  keywords?: string[];
  countries?: string[];
  regions?: string[];
  contractTypes?: ContractType[];
  remoteOnly?: boolean;
  seniority?: string[];
  excludedKeywords?: string[];
  maxResults?: number;
  since?: Date;
}

export interface SearchResult {
  opportunities: RawOpportunity[];
  totalFound: number;
  searchedAt: Date;
  sourceId: string;
  errors: string[];
}

export interface AdapterCapabilities {
  supportsApi: boolean;
  supportsRss: boolean;
  supportsBrowserSearch: boolean;
  supportsMcp: boolean;
  rateLimit?: number;
  requiresAuth: boolean;
  authType?: 'api_key' | 'oauth' | 'basic' | 'session';
}

export abstract class BaseSourceAdapter {
  abstract readonly sourceId: string;
  abstract readonly name: string;
  abstract readonly capabilities: AdapterCapabilities;

  protected abstract doSearch(params: SearchParams): Promise<SearchResult>;
  protected abstract doHealthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }>;

  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();
    try {
      const result = await this.doSearch(params);
      return {
        ...result,
        searchedAt: new Date(),
      };
    } catch (error) {
      return {
        opportunities: [],
        totalFound: 0,
        searchedAt: new Date(),
        sourceId: this.sourceId,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.doHealthCheck();
      return {
        ...result,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  protected mapToCanonical(raw: RawOpportunity, sourceId: string): Opportunity {
    return {
      id: uuid(crypto.randomUUID()),
      sourceId: uuid(sourceId),
      externalId: raw.externalId,
      url: raw.url,
      title: raw.title,
      companyId: undefined, // Will be resolved later
      recruiterId: undefined, // Will be resolved later
      postedAt: raw.postedAt,
      discoveredAt: new Date(),
      contractType: raw.contractType,
      duration: raw.duration,
      remotePolicy: raw.remotePolicy,
      location: raw.location,
      language: raw.language,
      clearance: raw.clearance,
      workAuthorisation: raw.workAuthorisation,
      originalRate: raw.originalRate,
      originalCurrency: raw.originalCurrency,
      ratePeriod: raw.ratePeriod,
      zarRate: undefined, // Will be calculated later
      fxSource: undefined,
      fxTimestamp: undefined,
      scores: {},
      status: 'DISCOVERED',
      eligibilityNotes: undefined,
      fitScore: undefined,
      reasons: [],
      gaps: [],
      provenance: {
        sourceId,
        rawData: raw.rawData,
        adapterVersion: '1.0',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class AdapterRegistry {
  private adapters: Map<string, BaseSourceAdapter> = new Map();

  register(adapter: BaseSourceAdapter): void {
    this.adapters.set(adapter.sourceId, adapter);
  }

  get(sourceId: string): BaseSourceAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  getAll(): BaseSourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  getActive(): BaseSourceAdapter[] {
    return this.getAll().filter(a => a.capabilities.supportsApi || a.capabilities.supportsRss || a.capabilities.supportsBrowserSearch);
  }

  async searchAll(params: SearchParams): Promise<SearchResult[]> {
    const activeAdapters = this.getActive();
    const results = await Promise.allSettled(
      activeAdapters.map(adapter => adapter.search(params))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          opportunities: [],
          totalFound: 0,
          searchedAt: new Date(),
          sourceId: activeAdapters[index].sourceId,
          errors: [result.reason?.message ?? 'Unknown error'],
        };
      }
    });
  }

  async healthCheckAll(): Promise<Map<string, { healthy: boolean; latencyMs?: number; error?: string }>> {
    const results = new Map();
    const adapters = this.getAll();

    await Promise.allSettled(
      adapters.map(async (adapter) => {
        const result = await adapter.healthCheck();
        results.set(adapter.sourceId, result);
      })
    );

    return results;
  }
}

export const adapterRegistry = new AdapterRegistry();