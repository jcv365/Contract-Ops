import crypto from 'node:crypto';
import { DraftStatus, SendStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { GraphTransport, getMockGraphTransport } from './transport';
import { decideSend, ExistingSendStatus } from './idempotency';
import { validateAttachment } from './attachment-validation';

export class SendError extends Error {}

// The one function that actually calls out to Graph (or its mock). Every
// safety control from CLAUDE.md rules 5/16/17 and docs 09/28 converges
// here: approval gate, suppression re-check, idempotency, attachment
// validation, full audit trail. Nothing upstream of this can cause an
// email to leave the system — this is the single choke point.
export async function sendApprovedDraft(draftId: string, transport: GraphTransport = getMockGraphTransport()) {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { draftAttachments: { include: { attachment: true } }, emailSend: true },
  });

  if (draft.status !== DraftStatus.APPROVED) {
    throw new SendError(`Draft ${draftId} is ${draft.status}, not APPROVED — no hidden send action, approval is required first`);
  }

  // Defence in depth: re-check suppression at send time, not just at
  // review/approval time — a suppression could have been added in between.
  const suppressed = await prisma.suppression.findUnique({ where: { email: draft.recipientEmail } });
  if (suppressed) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.FAILED } });
    throw new SendError(`Recipient ${draft.recipientEmail} is on the suppression list (${suppressed.reason}) — refusing to send`);
  }

  const decision = decideSend((draft.emailSend?.status as ExistingSendStatus) ?? null);
  if (!decision.shouldSend) {
    logger.info({ draftId, reason: decision.reason }, 'Send skipped — idempotency guard');
    return draft.emailSend;
  }

  for (const link of draft.draftAttachments) {
    const result = validateAttachment(link.attachment);
    if (!result.valid) {
      throw new SendError(`Attachment ${link.attachment.id} failed validation: ${result.reason}`);
    }
  }

  const idempotencyKey = draft.emailSend?.idempotencyKey ?? crypto.randomUUID();
  const emailSend = await prisma.emailSend.upsert({
    where: { draftId },
    update: { status: SendStatus.SENDING },
    create: { draftId, idempotencyKey, status: SendStatus.SENDING },
  });

  await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.SENDING } });

  try {
    const result = await transport.sendMail({
      to: draft.recipientEmail,
      subject: draft.subject,
      bodyText: draft.body,
      attachments: [], // attachment binary retrieval from storageRef is a Sprint 7+ concern; validated above but not yet fetched/encoded here
      idempotencyKey,
    });

    const sentSend = await prisma.emailSend.update({
      where: { id: emailSend.id },
      data: { status: SendStatus.SENT, graphMessageId: result.graphMessageId, sentAt: new Date(), error: null },
    });
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.SENT } });

    await prisma.auditEvent.create({
      data: {
        actor: 'system',
        action: 'outreach.send',
        entityType: 'OutreachDraft',
        entityId: draftId,
        metadata: {
          recipient: draft.recipientEmail,
          subject: draft.subject,
          attachmentIds: draft.draftAttachments.map((l) => l.attachmentId),
          graphMessageId: result.graphMessageId,
          idempotencyKey,
          sendResult: 'SENT',
          transportVerified: transport.verified,
        },
      },
    });

    logger.info({ draftId, graphMessageId: result.graphMessageId, verified: transport.verified }, 'Draft sent');
    return sentSend;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown send error';
    const failedSend = await prisma.emailSend.update({
      where: { id: emailSend.id },
      data: { status: SendStatus.FAILED, error: message },
    });
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.FAILED } });

    await prisma.auditEvent.create({
      data: {
        actor: 'system',
        action: 'outreach.send',
        entityType: 'OutreachDraft',
        entityId: draftId,
        metadata: { recipient: draft.recipientEmail, subject: draft.subject, idempotencyKey, sendResult: 'FAILED', error: message },
      },
    });

    logger.error({ draftId, err: message }, 'Draft send failed');
    return failedSend;
  }
}
