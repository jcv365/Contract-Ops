import { Router } from 'express';
import { z } from 'zod';
import { runHunt } from '../../modules/hunt-engine/service';
import { prisma } from '../../db/client';

export const huntRouter = Router();

const runSchema = z.object({
  keywords: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().max(200).optional(),
});

// docs-pack/docs/15: POST /hunt/run
huntRouter.post('/run', async (req, res, next) => {
  try {
    const params = runSchema.parse(req.body ?? {});
    const summary = await runHunt(params);
    await prisma.auditEvent.create({
      data: {
        actor: 'system',
        action: 'hunt.run',
        entityType: 'SearchRun',
        entityId: summary.searchRunId,
        metadata: summary as unknown as object,
      },
    });
    res.status(201).json(summary);
  } catch (err) {
    next(err);
  }
});
