import {
  ContractType,
  RemotePolicy,
  RatePeriod,
  ClearanceLevel,
  WorkAuthorisation,
} from '../../domain/types';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// A RawOpportunity is deliberately NOT a canonical Opportunity. Mapping to
// canonical form requires the real Source DB row (its UUID, rateLimit,
// reliability score) which no individual adapter instance owns — that
// mapping happens in modules/normalisation, driven by the hunt-engine,
// which does hold the Source record. The original scaffold's
// `mapToCanonical` lived here, branded the adapter's *slug* ('jobicy') as
// the Opportunity's Source UUID, used a string literal where
// OpportunityStatus is a TS enum (didn't compile under strict), and was
// never actually called by search() — three bugs from conflating two
// different layers' responsibilities.
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
  rateSource?: string;
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
  latencyMs: number;
  // Present and non-empty only when the search genuinely failed to
  // execute (network error, non-2xx after retries, malformed response).
  // Zero opportunities with an empty errors[] means "searched
  // successfully, found nothing" — the two must stay distinguishable, or
  // coverage reporting (rule 12 / doc 25) cannot tell a dead source from a
  // quiet one.
  errors: string[];
}

export interface AdapterCapabilities {
  supportsApi: boolean;
  supportsRss: boolean;
  supportsBrowserSearch: boolean;
  supportsMcp: boolean;
  rateLimit?: number; // requests per minute
  requiresAuth: boolean;
  authType?: 'api_key' | 'oauth' | 'basic' | 'session';
}

// Distinguishes "retry me" (429/5xx/timeout/network) from "don't bother
// retrying" (4xx other than 429, malformed response) per the plan's
// requirement that retry/backoff not blindly hammer a source that has
// permanently rejected the request.
export class TransientAdapterError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TransientAdapterError';
    this.cause = cause;
  }
}

export class PermanentAdapterError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PermanentAdapterError';
    this.cause = cause;
  }
}

// A minimal per-adapter token bucket honouring Source.rateLimit
// (requests/minute). This is intentionally in-process only — Phase 1 is a
// single-instance personal system, not a distributed one, so a shared
// (Redis-backed) bucket is out of scope until that changes.
class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private lastRefill: number;

  constructor(requestsPerMinute: number) {
    this.capacity = Math.max(1, requestsPerMinute);
    this.tokens = this.capacity;
    this.refillPerMs = this.capacity / 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.max(10, (1 - this.tokens) / this.refillPerMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export abstract class BaseSourceAdapter {
  abstract readonly sourceId: string;
  abstract readonly name: string;
  abstract readonly capabilities: AdapterCapabilities;

  private rateLimiter?: RateLimiter;

  protected abstract doSearch(params: SearchParams): Promise<RawOpportunity[]>;
  protected abstract doHealthCheck(): Promise<{ healthy: boolean; error?: string }>;

  // docs-pack/docs/22: every outbound request identifies itself and
  // respects the configured timeout — no adapter should hang a search run
  // indefinitely against a slow or unresponsive source.
  protected async fetchWithDefaults(url: string, options: FetchOptions = {}): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? env.REQUEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': env.USER_AGENT,
          ...options.headers,
        },
      });

      if (response.status === 429 || response.status >= 500) {
        throw new TransientAdapterError(`${this.sourceId}: HTTP ${response.status} from ${url}`);
      }
      if (!response.ok) {
        throw new PermanentAdapterError(`${this.sourceId}: HTTP ${response.status} from ${url}`);
      }
      return response;
    } catch (err) {
      if (err instanceof TransientAdapterError || err instanceof PermanentAdapterError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TransientAdapterError(`${this.sourceId}: timed out after ${timeoutMs}ms`, err);
      }
      // Network failures (DNS, connection reset) are transient by nature.
      throw new TransientAdapterError(`${this.sourceId}: request failed`, err);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (!(err instanceof TransientAdapterError) || attempt === maxAttempts) throw err;
        const backoffMs = 250 * 2 ** (attempt - 1);
        logger.warn(
          { sourceId: this.sourceId, attempt, backoffMs },
          'Adapter request failed, retrying'
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    throw lastError;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const startedAt = Date.now();

    if (!this.rateLimiter) {
      this.rateLimiter = new RateLimiter(this.capabilities.rateLimit ?? 30);
    }

    try {
      await this.rateLimiter.acquire();
      const opportunities = await this.withRetry(() => this.doSearch(params));
      return {
        opportunities,
        totalFound: opportunities.length,
        searchedAt: new Date(),
        sourceId: this.sourceId,
        latencyMs: Date.now() - startedAt,
        errors: [],
      };
    } catch (error) {
      logger.error({ sourceId: this.sourceId, err: error }, 'Source search failed');
      return {
        opportunities: [],
        totalFound: 0,
        searchedAt: new Date(),
        sourceId: this.sourceId,
        latencyMs: Date.now() - startedAt,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.doHealthCheck();
      return { ...result, latencyMs: Date.now() - startTime };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Adapters are registered by their sourceId slug (e.g. 'jobicy'), matching
// Source.sourceId in the database — the DB row (and its adapterStatus,
// which is the authority on whether a source may run) is looked up by the
// caller (hunt-engine), not by this registry. getActive() here is a
// capability pre-filter only; the original scaffold treated it as the
// enablement check, which meant a DISABLED/FAILED source in the database
// still got searched as long as its adapter *could* do RSS/API/browser.
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

  getByCapability(): BaseSourceAdapter[] {
    return this.getAll().filter(
      (a) => a.capabilities.supportsApi || a.capabilities.supportsRss || a.capabilities.supportsBrowserSearch
    );
  }

  // Concurrency-capped fan-out honouring env.MAX_CONCURRENT_REQUESTS —
  // Promise.allSettled alone (the original implementation) fires every
  // adapter at once with no cap.
  async searchMany(sourceIds: string[], params: SearchParams): Promise<SearchResult[]> {
    const limit = Math.max(1, env.MAX_CONCURRENT_REQUESTS);
    const results: SearchResult[] = [];
    let cursor = 0;

    const worker = async () => {
      for (;;) {
        const index = cursor++;
        if (index >= sourceIds.length) return;
        const sourceId = sourceIds[index];
        const adapter = this.get(sourceId);
        if (!adapter) {
          results[index] = {
            opportunities: [],
            totalFound: 0,
            searchedAt: new Date(),
            sourceId,
            latencyMs: 0,
            errors: [`No adapter registered for source '${sourceId}'`],
          };
          continue;
        }
        results[index] = await adapter.search(params);
      }
    };

    await Promise.all(Array.from({ length: Math.min(limit, sourceIds.length) }, worker));
    return results;
  }
}

export const adapterRegistry = new AdapterRegistry();
