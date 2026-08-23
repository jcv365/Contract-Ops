import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import {
  Source,
  SourceType,
  AdapterStatus,
  HealthStatus,
  SourceHealthCheck,
  uuid,
} from '../../domain/types';

export interface CreateSourceInput {
  sourceId: string;
  name: string;
  type: SourceType;
  url?: string;
  country?: string;
  region?: string;
  global?: boolean;
  local?: boolean;
  apiAvailable?: boolean;
  rssAvailable?: boolean;
  browserSearchAvailable?: boolean;
  mcpAvailable?: boolean;
  reliabilityScore?: number;
  contractRelevance?: number;
  remoteRelevance?: number;
  internationalRelevance?: number;
  termsUrl?: string;
  licence?: string;
  attributionRequired?: boolean;
  rateLimit?: number;
  notes?: string;
}

export interface UpdateSourceInput {
  name?: string;
  type?: SourceType;
  url?: string;
  country?: string;
  region?: string;
  global?: boolean;
  local?: boolean;
  apiAvailable?: boolean;
  rssAvailable?: boolean;
  browserSearchAvailable?: boolean;
  mcpAvailable?: boolean;
  adapterStatus?: AdapterStatus;
  reliabilityScore?: number;
  contractRelevance?: number;
  remoteRelevance?: number;
  internationalRelevance?: number;
  termsUrl?: string;
  licence?: string;
  attributionRequired?: boolean;
  rateLimit?: number;
  notes?: string;
}

export interface SourceFilters {
  type?: SourceType;
  adapterStatus?: AdapterStatus;
  country?: string;
  global?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class SourceRegistryService {
  async create(input: CreateSourceInput): Promise<Source> {
    const source = await prisma.source.create({
      data: {
        sourceId: input.sourceId,
        name: input.name,
        type: input.type,
        url: input.url,
        country: input.country,
        region: input.region,
        global: input.global ?? false,
        local: input.local ?? false,
        apiAvailable: input.apiAvailable ?? false,
        rssAvailable: input.rssAvailable ?? false,
        browserSearchAvailable: input.browserSearchAvailable ?? false,
        mcpAvailable: input.mcpAvailable ?? false,
        adapterStatus: AdapterStatus.PENDING,
        reliabilityScore: input.reliabilityScore ?? 0.5,
        contractRelevance: input.contractRelevance ?? 0.5,
        remoteRelevance: input.remoteRelevance ?? 0.5,
        internationalRelevance: input.internationalRelevance ?? 0.5,
        termsUrl: input.termsUrl,
        licence: input.licence,
        attributionRequired: input.attributionRequired ?? false,
        rateLimit: input.rateLimit,
        notes: input.notes,
      },
    });

    logger.info({ sourceId: source.sourceId }, 'Source created');
    return this.mapToDomain(source);
  }

  async getById(id: string): Promise<Source | null> {
    const source = await prisma.source.findUnique({
      where: { id },
    });
    return source ? this.mapToDomain(source) : null;
  }

  async getBySourceId(sourceId: string): Promise<Source | null> {
    const source = await prisma.source.findUnique({
      where: { sourceId },
    });
    return source ? this.mapToDomain(source) : null;
  }

  async list(filters: SourceFilters = {}): Promise<{ sources: Source[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.type) where.type = filters.type;
    if (filters.adapterStatus) where.adapterStatus = filters.adapterStatus;
    if (filters.country) where.country = filters.country;
    if (filters.global !== undefined) where.global = filters.global;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sourceId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      prisma.source.count({ where }),
    ]);

    return {
      sources: sources.map(this.mapToDomain),
      total,
    };
  }

  async update(id: string, input: UpdateSourceInput): Promise<Source | null> {
    const source = await prisma.source.update({
      where: { id },
      data: input,
    });

    logger.info({ sourceId: source.sourceId }, 'Source updated');
    return this.mapToDomain(source);
  }

  async delete(id: string): Promise<boolean> {
    await prisma.source.delete({ where: { id } });
    logger.info({ sourceId: id }, 'Source deleted');
    return true;
  }

  async recordHealthCheck(
    sourceId: string,
    status: HealthStatus,
    latencyMs?: number,
    error?: string
  ): Promise<SourceHealthCheck> {
    const source = await prisma.source.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error('Source not found');

    const healthCheck = await prisma.sourceHealthCheck.create({
      data: {
        sourceId,
        status,
        latencyMs,
        error,
      },
    });

    // Update source last health check and status
    const updateData: Record<string, unknown> = {
      lastHealthCheck: new Date(),
    };

    if (status === HealthStatus.HEALTHY) {
      updateData.lastSuccessfulSearch = new Date();
      updateData.adapterStatus = AdapterStatus.ACTIVE;
    } else if (status === HealthStatus.UNHEALTHY) {
      updateData.adapterStatus = AdapterStatus.FAILED;
    } else if (status === HealthStatus.DEGRADED) {
      updateData.adapterStatus = AdapterStatus.DEGRADED;
    }

    await prisma.source.update({
      where: { id: sourceId },
      data: updateData,
    });

    logger.info({ sourceId, status }, 'Source health check recorded');
    return this.mapHealthCheckToDomain(healthCheck);
  }

  async getHealthChecks(sourceId: string, limit = 10): Promise<SourceHealthCheck[]> {
    const checks = await prisma.sourceHealthCheck.findMany({
      where: { sourceId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
    return checks.map(this.mapHealthCheckToDomain);
  }

  async getHealthSummary(): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    byType: Record<string, { total: number; healthy: number }>;
  }> {
    const sources = await prisma.source.findMany({
      select: { id: true, type: true, adapterStatus: true },
    });

    const summary = {
      total: sources.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      byType: {} as Record<string, { total: number; healthy: number }>,
    };

    for (const source of sources) {
      switch (source.adapterStatus) {
        case AdapterStatus.ACTIVE:
          summary.healthy++;
          break;
        case AdapterStatus.DEGRADED:
          summary.degraded++;
          break;
        case AdapterStatus.FAILED:
          summary.unhealthy++;
          break;
        default:
          summary.unknown++;
      }

      const typeKey = source.type;
      if (!summary.byType[typeKey]) {
        summary.byType[typeKey] = { total: 0, healthy: 0 };
      }
      summary.byType[typeKey].total++;
      if (source.adapterStatus === AdapterStatus.ACTIVE) {
        summary.byType[typeKey].healthy++;
      }
    }

    return summary;
  }

  private mapToDomain(source: Record<string, unknown>): Source {
    return {
      id: uuid(source.id as string),
      sourceId: source.sourceId as string,
      name: source.name as string,
      type: source.type as SourceType,
      url: source.url as string | undefined,
      country: source.country as string | undefined,
      region: source.region as string | undefined,
      global: source.global as boolean,
      local: source.local as boolean,
      apiAvailable: source.apiAvailable as boolean,
      rssAvailable: source.rssAvailable as boolean,
      browserSearchAvailable: source.browserSearchAvailable as boolean,
      mcpAvailable: source.mcpAvailable as boolean,
      adapterStatus: source.adapterStatus as AdapterStatus,
      reliabilityScore: source.reliabilityScore as number,
      contractRelevance: source.contractRelevance as number,
      remoteRelevance: source.remoteRelevance as number,
      internationalRelevance: source.internationalRelevance as number,
      termsUrl: source.termsUrl as string | undefined,
      licence: source.licence as string | undefined,
      attributionRequired: source.attributionRequired as boolean,
      rateLimit: source.rateLimit as number | undefined,
      lastHealthCheck: source.lastHealthCheck as Date | undefined,
      lastSuccessfulSearch: source.lastSuccessfulSearch as Date | undefined,
      notes: source.notes as string | undefined,
      createdAt: source.createdAt as Date,
      updatedAt: source.updatedAt as Date,
    };
  }

  private mapHealthCheckToDomain(check: Record<string, unknown>): SourceHealthCheck {
    return {
      id: uuid(check.id as string),
      sourceId: uuid(check.sourceId as string),
      status: check.status as HealthStatus,
      latencyMs: check.latencyMs as number | undefined,
      error: check.error as string | undefined,
      checkedAt: check.checkedAt as Date,
    };
  }
}

export const sourceRegistryService = new SourceRegistryService();