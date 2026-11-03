import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { ingestReply, classifyReply, promoteReplyToOpportunity, ReplyIntelligenceError } from '../../modules/reply-intelligence/service';
import { AiTransportError } from '../../modules/ai/transport';
import { AiValidationError } from '../../modules/ai/structured-output';

export const repliesRouter = Router();

// docs-pack/docs/15: GET /replies
repliesRouter.get('/', async (req, res, next) => {
  try {
    const replies = await prisma.reply.findMany({ orderBy: { receivedAt: 'desc' }, take: 100, include: { thread: true } });
    res.json({ replies });
  } catch (err) {
    next(err);
  }
});

const ingestSchema = z.object({
  providerThreadId: z.string().min(1),
  graphMessageId: z.string().min(1),
  participants: z.array(z.unknown()).default([]),
  receivedAt: z.coerce.date(),
  linkedRecruiterId: z.string().uuid().optional(),
  linkedCompanyId: z.string().uuid().optional(),
  linkedOpportunityId: z.string().uuid().optional(),
});

// Manual/API ingestion stand-in for the live Graph mailbox poller this
// build cannot exercise without an Entra app registration (same blocker
// as Sprint 4's Graph send).
repliesRouter.post('/', async (req, res, next) => {
  try {
    const input = ingestSchema.parse(req.body);
    const reply = await ingestReply(input);
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});

const classifySchema = z.object({ bodyText: z.string().min(1) });

// docs-pack/docs/15: POST /replies/:id/classify
repliesRouter.post('/:id/classify', async (req, res, next) => {
  try {
    const { bodyText } = classifySchema.parse(req.body);
    const reply = await classifyReply(req.params.id, bodyText);
    res.json(reply);
  } catch (err) {
    next(err);
  }
});

const promoteSchema = z.object({ bodyText: z.string().min(1) });

// docs-pack/docs/15: POST /replies/:id/promote-to-opportunity
repliesRouter.post('/:id/promote-to-opportunity', async (req, res, next) => {
  try {
    const { bodyText } = promoteSchema.parse(req.body);
    const opportunity = await promoteReplyToOpportunity(req.params.id, bodyText);
    res.status(201).json(opportunity);
  } catch (err) {
    next(err);
  }
});

// Gap fix: this router only mapped ReplyIntelligenceError, unlike
// bidops.ts's equivalent handler — a missing FREELLMAPI_API_KEY on
// /:id/classify or /:id/promote-to-opportunity fell through to the global
// 500 handler instead of the semantically-correct 422 (deliberate business
// rule failing, not a server bug).
repliesRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ReplyIntelligenceError || err instanceof AiTransportError || err instanceof AiValidationError) {
    res.status(422).json({ error: err.message });
    return;
  }
  next(err);
});
