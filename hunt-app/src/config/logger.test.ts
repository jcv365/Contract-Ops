import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { REDACT_PATHS } from './logger';

// Mandatory test #16 (docs-pack/docs/18): "Tokens never appear in logs."
// Exercises the ACTUAL redact configuration exported from logger.ts
// against a real pino instance and a captured write stream — not a
// hand-copied list that could silently drift from the real one, and not
// just eyeballing the config, but proving a token string genuinely does
// not reach the output.
function loggerWithCapture() {
  const chunks: string[] = [];
  const stream = { write: (chunk: string) => chunks.push(chunk) };
  const logger = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { logger, chunks };
}

describe('logger redaction', () => {
  it('never writes a raw accessToken value to the log output', () => {
    const { logger, chunks } = loggerWithCapture();
    const secretToken = 'ey.super.secret.access.token';
    logger.info({ token: { accessToken: secretToken } }, 'token issued');

    const output = chunks.join('');
    expect(output).not.toContain(secretToken);
    expect(output).toContain('[REDACTED]');
  });

  it('never writes a raw refreshToken or clientSecret value', () => {
    const { logger, chunks } = loggerWithCapture();
    logger.info({ token: { refreshToken: 'refresh-secret-xyz', clientSecret: 'client-secret-abc' } }, 'token refreshed');

    const output = chunks.join('');
    expect(output).not.toContain('refresh-secret-xyz');
    expect(output).not.toContain('client-secret-abc');
  });

  it('never writes a raw Authorization header', () => {
    const { logger, chunks } = loggerWithCapture();
    logger.info({ req: { headers: { authorization: 'Bearer secret-bearer-token' } } }, 'request');

    expect(chunks.join('')).not.toContain('secret-bearer-token');
  });

  it('still logs non-secret fields normally', () => {
    const { logger, chunks } = loggerWithCapture();
    logger.info({ draftId: 'abc-123' }, 'draft created');

    expect(chunks.join('')).toContain('abc-123');
  });
});
