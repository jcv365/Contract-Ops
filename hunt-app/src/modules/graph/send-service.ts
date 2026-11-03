import crypto from 'node:crypto';
import { DraftStatus, SendStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { GraphTransport, getMockGraphTransport } from './transport';
import { decideSend, ExistingSendStatus } from './idempotency';
import { validateAttachment } from './attachment-validation';
import { suppressionService } from '../suppression/service';
import { recomputeOutreachState } from '../outreach-state/service';
import { readAttachmentBuffer } from '../attachments/service';
import { OutboundAttachment } from './transport';

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
  // Matches both the exact address and its registrable domain (a company
  // that asked never to be contacted again previously fell through this
  // check if the specific address hadn't itself been suppressed).
  const suppression = await suppressionService.check(draft.recipientEmail);
  if (suppression.suppressed) {
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.FAILED } });
    throw new SendError(`Recipient ${draft.recipientEmail} is on the suppression list (${suppression.reason}, matched by ${suppression.scope}) — refusing to send`);
  }

  const decision = decideSend((draft.emailSend?.status as ExistingSendStatus) ?? null);
  if (!decision.shouldSend) {
    logger.info({ draftId, reason: decision.reason }, 'Send skipped — idempotency guard');
    return draft.emailSend;
  }

  // Audit finding (this session): this loop validated metadata only and
  // then the send below hardcoded `attachments: []` regardless — the file
  // was never actually read or sent. Now reads each file once here (real
  // content sniffing, not just the declared mimeType) and reuses the same
  // buffer below rather than reading twice.
  const outboundAttachments: OutboundAttachment[] = [];
  for (const link of draft.draftAttachments) {
    const { attachment, buffer } = await readAttachmentBuffer(link.attachmentId);
    const result = validateAttachment(attachment, undefined, buffer);
    if (!result.valid) {
      throw new SendError(`Attachment ${link.attachment.id} failed validation: ${result.reason}`);
    }
    outboundAttachments.push({ fileName: attachment.fileName, mimeType: attachment.mimeType, contentBase64: buffer.toString('base64') });
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
      attachments: outboundAttachments,
      idempotencyKey,
    });

    const sentSend = await prisma.emailSend.update({
      where: { id: emailSend.id },
      data: { status: SendStatus.SENT, graphMessageId: result.graphMessageId, sentAt: new Date(), error: null },
    });
    await prisma.outreachDraft.update({ where: { id: draftId }, data: { status: DraftStatus.SENT } });

    if (draft.recruiterId) {
      await recomputeOutreachState({ entityType: 'Recruiter', entityId: draft.recruiterId, trigger: 'draft.sent' });
    } else if (draft.companyId) {
      await recomputeOutreachState({ entityType: 'Company', entityId: draft.companyId, trigger: 'draft.sent' });
    }

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
