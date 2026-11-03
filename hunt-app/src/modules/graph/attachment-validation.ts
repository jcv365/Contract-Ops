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

// Content sniffing — found in the recovery audit: this module previously
// trusted the DB's declared mimeType alone and never inspected the actual
// bytes. PDF's signature is exact; DOCX is a zip container, so this is a
// necessary-but-not-sufficient check (any zip passes) — combined with the
// mimeType allowlist above, it still catches the common failure mode of a
// mislabelled or corrupted upload.
export function sniffFileType(buffer: Buffer): 'pdf' | 'docx-zip' | 'unknown' {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return 'docx-zip';
  return 'unknown';
}

export function validateAttachment(attachment: AttachmentToValidate, expectedOwnerId?: string, buffer?: Buffer): AttachmentValidationResult {
  if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
    return { valid: false, reason: `Mime type ${attachment.mimeType} is not an allowed attachment type (PDF/DOCX only)` };
  }
  if (attachment.sizeBytes <= 0 || attachment.sizeBytes > MAX_SIZE_BYTES) {
    return { valid: false, reason: `File size ${attachment.sizeBytes} bytes is outside the allowed 0-${MAX_SIZE_BYTES} range` };
  }
  if (expectedOwnerId && attachment.ownerId && attachment.ownerId !== expectedOwnerId) {
    return { valid: false, reason: 'Attachment owner does not match the sender — refusing to attach another user\'s file' };
  }
  if (buffer) {
    const sniffed = sniffFileType(buffer);
    if (attachment.mimeType === 'application/pdf' && sniffed !== 'pdf') {
      return { valid: false, reason: 'Declared as PDF but the file content does not start with the PDF signature (%PDF-)' };
    }
    if (attachment.mimeType !== 'application/pdf' && sniffed !== 'docx-zip') {
      return { valid: false, reason: 'Declared as DOCX but the file content is not a valid zip container' };
    }
  }
  return { valid: true };
}
