import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { research, draftOutreach, reviewDraft, BidopsError } from '../../modules/bidops/service';
import { AiValidationError } from '../../modules/ai/structured-output';
import { AiTransportError } from '../../modules/ai/transport';
import { prisma } from '../../db/client';
import { TargetType, GreetingMode } from '../../domain/types';

export const bidopsRouter = Router();

const researchSchema = z.object({
  recruiterId: z.string().uuid(),
  contextText: z.string().min(1),
  contextSource: z.string().min(1),
});

// docs-pack/docs/15: POST /bidops/research
bidopsRouter.post('/research', async (req, res, next) => {
  try {
    const input = researchSchema.parse(req.body);
    const findings = await research(input);
    res.json(findings);
  } catch (err) {
    next(err);
  }
});

const draftSchema = z.object({
  targetType: z.nativeEnum(TargetType),
  recruiterId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  profileId: z.string().uuid(),
  recipientEmail: z.string().email(),
  greetingMode: z.nativeEnum(GreetingMode),
});

// docs-pack/docs/15: POST /bidops/draft
bidopsRouter.post('/draft', async (req, res, next) => {
  try {
    const input = draftSchema.parse(req.body);
    const draft = await draftOutreach(input);
    res.status(201).json(draft);
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({ draftId: z.string().uuid() });

// docs-pack/docs/15: POST /bidops/review
bidopsRouter.post('/review', async (req, res, next) => {
  try {
    const { draftId } = reviewSchema.parse(req.body);
    const result = await reviewDraft(draftId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: GET /bidops — lists outreach drafts (BIDOPS output)
bidopsRouter.get('/', async (req, res, next) => {
  try {
    const drafts = await prisma.outreachDraft.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ drafts });
  } catch (err) {
    next(err);
  }
});

// Surfaces AI/evidence failures as 422 (semantically valid request, AI
// output rejected) rather than a generic 500 — this is a deliberate
// business rule failing, not a server bug.
bidopsRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AiValidationError || err instanceof BidopsError || err instanceof AiTransportError) {
    res.status(422).json({ error: err.message });
    return;
  }
  next(err);
});
