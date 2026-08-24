import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sourceRegistryService, SourceActivationError } from '../../modules/source-registry/service';
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

// GET /sources/:id — not in the original docs/15 list (which only had the
// collection endpoint), added for the portal's per-source edit view.
sourcesRouter.get('/:id', async (req, res, next) => {
  try {
    const source = await prisma.source.findUnique({ where: { id: req.params.id } });
    if (!source) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }
    res.json(source);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  adapterStatus: z.nativeEnum(AdapterStatus).optional(),
  notes: z.string().optional(),
  termsUrl: z.string().url().optional(),
  licence: z.string().optional(),
  rateLimit: z.coerce.number().int().positive().optional(),
});

// PATCH /sources/:id — enable/disable a source and edit its docs/22
// compliance fields. sourceRegistryService.update() (Sprint 1) existed
// but nothing routed to it until now.
sourcesRouter.patch('/:id', async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const updated = await sourceRegistryService.update(req.params.id, input);
    if (!updated) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

sourcesRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SourceActivationError) {
    res.status(422).json({ error: err.message });
    return;
  }
  next(err);
});
