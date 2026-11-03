import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { submitForApproval, approveDraft, rejectDraft, ApprovalError } from '../../modules/approval/service';
import { sendApprovedDraft, SendError } from '../../modules/graph/send-service';
import { getGraphTransport } from '../../modules/graph/transport';
import { DraftStatus } from '../../domain/types';

export const outreachRouter = Router();

// docs-pack/docs/15: GET /outreach/queue — docs/16's "pending approvals"
// list, with the full detail the approval screen needs (recipient,
// greeting, evidence used, attachments — "no hidden send action").
outreachRouter.get('/queue', async (req, res, next) => {
  try {
    const drafts = await prisma.outreachDraft.findMany({
      where: { status: DraftStatus.AWAITING_APPROVAL },
      include: {
        draftEvidence: { include: { evidence: true } },
        draftAttachments: { include: { attachment: true } },
        validations: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ drafts });
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/09 state machine step: VALIDATED -> AWAITING_APPROVAL.
// Was unreachable through any route before this — submitForApproval()
// existed in modules/approval/service.ts with no caller anywhere.
outreachRouter.post('/:draftId/submit', async (req, res, next) => {
  try {
    const draft = await submitForApproval(req.params.draftId);
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

const actionSchema = z.object({
  userId: z.string().uuid(),
  notes: z.string().optional(),
});

// docs-pack/docs/15: POST /outreach/:draft_id/approve
outreachRouter.post('/:draftId/approve', async (req, res, next) => {
  try {
    const input = actionSchema.parse(req.body);
    const draft = await approveDraft({ draftId: req.params.draftId, ...input });
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: POST /outreach/:draft_id/reject
outreachRouter.post('/:draftId/reject', async (req, res, next) => {
  try {
    const input = actionSchema.parse(req.body);
    const draft = await rejectDraft({ draftId: req.params.draftId, ...input });
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: POST /outreach/:draft_id/send
outreachRouter.post('/:draftId/send', async (req, res, next) => {
  try {
    // getGraphTransport resolves the mock unless ENABLE_GRAPH_SEND=true
    // AND a stored Graph OAuth token exists for this user (transport.ts) —
    // 'default-user' matches the single-user convention used throughout
    // this deployment (portal/router.ts, db/seed.ts).
    const transport = await getGraphTransport('default-user');
    const result = await sendApprovedDraft(req.params.draftId, transport);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

outreachRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApprovalError || err instanceof SendError) {
    res.status(422).json({ error: err.message });
    return;
  }
  next(err);
});
