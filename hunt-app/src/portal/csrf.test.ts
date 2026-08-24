import { describe, it, expect, vi } from 'vitest';
import { getOrCreateCsrfToken, requireCsrfToken } from './csrf';

describe('getOrCreateCsrfToken', () => {
  it('generates a token when the session has none', () => {
    const session: { csrfToken?: string } = {};
    const token = getOrCreateCsrfToken(session);
    expect(token).toHaveLength(64); // 32 bytes hex-encoded
    expect(session.csrfToken).toBe(token);
  });

  it('returns the same token on repeated calls for the same session', () => {
    const session: { csrfToken?: string } = {};
    const first = getOrCreateCsrfToken(session);
    const second = getOrCreateCsrfToken(session);
    expect(first).toBe(second);
  });

  it('generates different tokens for different sessions', () => {
    const a = getOrCreateCsrfToken({});
    const b = getOrCreateCsrfToken({});
    expect(a).not.toBe(b);
  });
});

describe('requireCsrfToken', () => {
  function mockReqRes(sessionToken: string | undefined, submittedToken: unknown) {
    const req = { session: { csrfToken: sessionToken }, body: { _csrf: submittedToken } } as never;
    const status = vi.fn().mockReturnThis();
    const send = vi.fn();
    const res = { status, send } as never;
    const next = vi.fn();
    return { req, res, status, send, next };
  }

  it('rejects a request with no session token at all', () => {
    const { req, res, status, next } = mockReqRes(undefined, 'anything');
    requireCsrfToken(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with a mismatched token', () => {
    const { req, res, next } = mockReqRes('real-token-value-1234567890123456789012', 'forged-token');
    requireCsrfToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with no submitted token', () => {
    const { req, res, next } = mockReqRes('real-token-value', undefined);
    requireCsrfToken(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a request whose submitted token matches the session token', () => {
    const { req, res, next } = mockReqRes('matching-token-value', 'matching-token-value');
    requireCsrfToken(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
