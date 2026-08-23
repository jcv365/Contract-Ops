// docs-pack/docs/09: "Validate file type, size and ownership before send."
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface AttachmentToValidate {
  mimeType: string;
  sizeBytes: number;
  ownerId?: string | null;
}

export interface AttachmentValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAttachment(attachment: AttachmentToValidate, expectedOwnerId?: string): AttachmentValidationResult {
  if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
    return { valid: false, reason: `Mime type ${attachment.mimeType} is not an allowed attachment type (PDF/DOCX only)` };
  }
  if (attachment.sizeBytes <= 0 || attachment.sizeBytes > MAX_SIZE_BYTES) {
    return { valid: false, reason: `File size ${attachment.sizeBytes} bytes is outside the allowed 0-${MAX_SIZE_BYTES} range` };
  }
  if (expectedOwnerId && attachment.ownerId && attachment.ownerId !== expectedOwnerId) {
    return { valid: false, reason: 'Attachment owner does not match the sender — refusing to attach another user\'s file' };
  }
  return { valid: true };
}
