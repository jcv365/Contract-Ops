import { Router } from 'express';
import { z } from 'zod';
import { SuppressionReason } from '@prisma/client';
import { suppressionService } from '../../modules/suppression/service';

export const suppressionsRouter = Router();

// GET /suppressions — docs/28's "suppression list" control, previously
// invisible: the table existed but had no route of any kind.
suppressionsRouter.get('/', async (req, res, next) => {
  try {
    const suppressions = await suppressionService.list();
    res.json({ suppressions });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: z.string().email(),
  reason: z.nativeEnum(SuppressionReason).default(SuppressionReason.MANUAL),
  notes: z.string().optional(),
});

suppressionsRouter.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const suppression = await suppressionService.create(input);
    res.status(201).json(suppression);
  } catch (err) {
    next(err);
  }
});

suppressionsRouter.delete('/:id', async (req, res, next) => {
  try {
    await suppressionService.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
