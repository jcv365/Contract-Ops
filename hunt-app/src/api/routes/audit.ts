import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';

export const auditRouter = Router();

const querySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// docs-pack/docs/15: GET /audit
auditRouter.get('/', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const where = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({ where, orderBy: { timestamp: 'desc' }, take: query.limit, skip: query.offset }),
      prisma.auditEvent.count({ where }),
    ]);
    res.json({ events, total });
  } catch (err) {
    next(err);
  }
});
