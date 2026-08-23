import { DraftStatus, ApprovalDecision } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';

export class ApprovalError extends Error {}

// docs-pack/docs/09 state machine step: VALIDATED -> AWAITING_APPROVAL.
// Explicit, not automatic on review pass — the operator decides when a
// validated draft actually goes into their approval queue (docs/16's
// "pending approvals" list).
export async function submitForApproval(draftId: string) {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({ where: { id: draftId } });
  if (draft.status !== DraftStatus.VALIDATED) {
    throw new ApprovalError(`Draft ${draftId} is ${draft.status}, not VALIDATED — cannot submit for approval`);
  }
  return prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.AWAITING_APPROVAL } });
}

export interface ApprovalActionInput {
  draftId: string;
  userId: string;
  notes?: string;
}

// ADR-002: "AI may not autonomously send external email. Every outbound
// message requires explicit human approval immediately before sending."
// This function IS that explicit approval — it never runs automatically,
// and docs/16's "no hidden send action" means approving here does not
// itself send; sendApprovedDraft() (modules/graph/send-service.ts) is a
// separate, later call.
export async function approveDraft(input: ApprovalActionInput) {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({ where: { id: input.draftId } });
  if (draft.status !== DraftStatus.AWAITING_APPROVAL) {
    throw new ApprovalError(`Draft ${input.draftId} is ${draft.status}, not AWAITING_APPROVAL — cannot approve`);
  }

  await prisma.outreachApproval.create({
    data: { draftId: input.draftId, decision: ApprovalDecision.APPROVED, userId: input.userId, notes: input.notes },
  });
  const updated = await prisma.outreachDraft.update({
    where: { id: input.draftId },
    data: { status: DraftStatus.APPROVED },
  });

  await prisma.auditEvent.create({
    data: {
      actor: input.userId,
      actorUserId: input.userId,
      action: 'outreach.approve',
      entityType: 'OutreachDraft',
      entityId: input.draftId,
      metadata: { recipient: draft.recipientEmail, subject: draft.subject, notes: input.notes },
    },
  });

  logger.info({ draftId: input.draftId, userId: input.userId }, 'Draft approved');
  return updated;
}

export async function rejectDraft(input: ApprovalActionInput) {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({ where: { id: input.draftId } });
  if (draft.status !== DraftStatus.AWAITING_APPROVAL) {
    throw new ApprovalError(`Draft ${input.draftId} is ${draft.status}, not AWAITING_APPROVAL — cannot reject`);
  }

  await prisma.outreachApproval.create({
    data: { draftId: input.draftId, decision: ApprovalDecision.REJECTED, userId: input.userId, notes: input.notes },
  });
  const updated = await prisma.outreachDraft.update({
    where: { id: input.draftId },
    data: { status: DraftStatus.REJECTED },
  });

  await prisma.auditEvent.create({
    data: {
      actor: input.userId,
      actorUserId: input.userId,
      action: 'outreach.reject',
      entityType: 'OutreachDraft',
      entityId: input.draftId,
      metadata: { recipient: draft.recipientEmail, subject: draft.subject, notes: input.notes },
    },
  });

  logger.info({ draftId: input.draftId, userId: input.userId }, 'Draft rejected');
  return updated;
}
