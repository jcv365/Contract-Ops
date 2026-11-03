import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AttachmentKind } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

export class AttachmentNotFoundError extends Error {}

export interface SaveAttachmentInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  kind: AttachmentKind;
  ownerId: string;
}

// Local filesystem storage, backed by a named Docker volume
// (docker-compose.yml: hunt_attachments -> ATTACHMENT_STORAGE_DIR) so an
// upload survives a container recreate. storageRef is a RELATIVE filename
// (never an absolute host path) — that's what keeps it portable if the
// storage root ever moves.
export async function saveAttachment(input: SaveAttachmentInput) {
  await fs.mkdir(env.ATTACHMENT_STORAGE_DIR, { recursive: true });

  const ext = path.extname(input.fileName) || (input.mimeType === 'application/pdf' ? '.pdf' : '.docx');
  const storageRef = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(env.ATTACHMENT_STORAGE_DIR, storageRef);
  const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');

  await fs.writeFile(fullPath, input.buffer);

  const attachment = await prisma.attachment.create({
    data: {
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
      storageRef,
      checksum,
      ownerId: input.ownerId,
    },
  });

  logger.info({ attachmentId: attachment.id, kind: input.kind, sizeBytes: attachment.sizeBytes }, 'Attachment saved');
  return attachment;
}

export async function listAttachments(ownerId: string) {
  return prisma.attachment.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
}

// The most recent attachment of a given kind for this owner — used by
// bidops/service.ts to resolve the AI's recommendedAttachment into a real
// DraftAttachment, and by the review flow when a newer CV should supersede
// an older one without deleting history.
export async function latestAttachmentByKind(ownerId: string, kind: AttachmentKind) {
  return prisma.attachment.findFirst({ where: { ownerId, kind }, orderBy: { createdAt: 'desc' } });
}

export async function readAttachmentBuffer(attachmentId: string): Promise<{ attachment: Awaited<ReturnType<typeof prisma.attachment.findUniqueOrThrow>>; buffer: Buffer }> {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) throw new AttachmentNotFoundError(`Attachment ${attachmentId} not found`);

  const fullPath = path.join(env.ATTACHMENT_STORAGE_DIR, attachment.storageRef);
  const buffer = await fs.readFile(fullPath);
  return { attachment, buffer };
}

export async function readAttachmentBase64(attachmentId: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
  const { attachment, buffer } = await readAttachmentBuffer(attachmentId);
  return { fileName: attachment.fileName, mimeType: attachment.mimeType, contentBase64: buffer.toString('base64') };
}
