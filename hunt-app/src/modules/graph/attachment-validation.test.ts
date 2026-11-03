import { describe, it, expect } from 'vitest';
import { validateAttachment, sniffFileType } from './attachment-validation';

const PDF_BYTES = Buffer.from('%PDF-1.7\n%fake pdf body for testing');
const ZIP_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]); // DOCX is a zip container
const TEXT_BYTES = Buffer.from('this is not a pdf or a zip, just plain text');

describe('validateAttachment', () => {
  it('accepts a PDF within the size limit', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', sizeBytes: 1024 }).valid).toBe(true);
  });

  it('accepts a DOCX within the size limit', () => {
    expect(
      validateAttachment({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 1024,
      }).valid
    ).toBe(true);
  });

  it('rejects a disallowed mime type (e.g. an executable)', () => {
    const result = validateAttachment({ mimeType: 'application/x-msdownload', sizeBytes: 1024 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not an allowed attachment type');
  });

  it('rejects a file over the size limit', () => {
    const result = validateAttachment({ mimeType: 'application/pdf', sizeBytes: 11 * 1024 * 1024 });
    expect(result.valid).toBe(false);
  });

  it('rejects a zero-byte file', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', sizeBytes: 0 }).valid).toBe(false);
  });

  it('rejects an attachment owned by someone other than the sender', () => {
    const result = validateAttachment({ mimeType: 'application/pdf', sizeBytes: 1024, ownerId: 'user-a' }, 'user-b');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('owner');
  });

  it('accepts when ownership matches', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', sizeBytes: 1024, ownerId: 'user-a' }, 'user-a').valid).toBe(true);
  });

  // Content sniffing — the audit found this module previously trusted the
  // declared mimeType alone and never looked at the actual bytes.
  it('accepts a PDF whose content genuinely starts with the PDF signature', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', sizeBytes: PDF_BYTES.length }, undefined, PDF_BYTES).valid).toBe(true);
  });

  it('rejects a file declared as PDF whose content is plain text, not real PDF bytes', () => {
    const result = validateAttachment({ mimeType: 'application/pdf', sizeBytes: TEXT_BYTES.length }, undefined, TEXT_BYTES);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('PDF signature');
  });

  it('accepts a DOCX whose content is a genuine zip container', () => {
    expect(
      validateAttachment(
        { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: ZIP_BYTES.length },
        undefined,
        ZIP_BYTES
      ).valid
    ).toBe(true);
  });

  it('rejects a file declared as DOCX whose content is not a zip container', () => {
    const result = validateAttachment(
      { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: TEXT_BYTES.length },
      undefined,
      TEXT_BYTES
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('zip container');
  });

  it('does not content-sniff when no buffer is supplied (metadata-only check preserved)', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', sizeBytes: 1024 }).valid).toBe(true);
  });
});

describe('sniffFileType', () => {
  it('recognises the PDF signature', () => {
    expect(sniffFileType(PDF_BYTES)).toBe('pdf');
  });
  it('recognises a zip container (DOCX)', () => {
    expect(sniffFileType(ZIP_BYTES)).toBe('docx-zip');
  });
  it('returns unknown for anything else', () => {
    expect(sniffFileType(TEXT_BYTES)).toBe('unknown');
  });
});
