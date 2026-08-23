import { describe, it, expect } from 'vitest';
import { validateAttachment } from './attachment-validation';

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
});
