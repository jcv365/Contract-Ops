import { Router } from 'express';
import { z } from 'zod';
import { sourceRegistryService } from '../../modules/source-registry/service';
import { adapterRegistry } from '../../modules/source-adapters';
import { prisma } from '../../db/client';
import { SourceType, AdapterStatus, HealthStatus } from '../../domain/types';

export const sourcesRouter = Router();

const listQuerySchema = z.object({
  type: z.nativeEnum(SourceType).optional(),
  adapterStatus: z.nativeEnum(AdapterStatus).optional(),
  country: z.string().optional(),
  global: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// docs-pack/docs/15: GET /sources
sourcesRouter.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await sourceRegistryService.list(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: POST /sources/health-check
sourcesRouter.post('/health-check', async (req, res, next) => {
  try {
    const sources = await prisma.source.findMany();
    const results = await Promise.all(
      sources.map(async (source) => {
        const adapter = adapterRegistry.get(source.sourceId);
        if (!adapter) {
          return { sourceId: source.sourceId, healthy: false, error: 'No adapter registered' };
        }
        const result = await adapter.healthCheck();
        await sourceRegistryService.recordHealthCheck(
          source.id,
          result.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
          result.latencyMs,
          result.error
        );
        return { sourceId: source.sourceId, ...result };
      })
    );
    res.json({ results });
  } catch (err) {
    next(err);
  }
});
