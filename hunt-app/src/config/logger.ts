import pino from 'pino';
import { env } from './env';

const transport = env.LOG_PRETTY
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

// Rule 16: never log access tokens or secrets. Applies to any bound field
// or nested field ending in one of these names, wherever it appears in the
// log object graph (recruiter email bodies, Graph payloads, AI requests).
export const REDACT_PATHS = [
  '*.accessToken',
  '*.refreshToken',
  '*.access_token',
  '*.refresh_token',
  '*.clientSecret',
  '*.client_secret',
  '*.authorization',
  '*.password',
  '*.idempotencyKey',
  '*.encryptionKey',
  'req.headers.authorization',
  'req.headers.cookie',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: {
    service: 'hunt-contract-acquisition-os',
    version: '1.0.0',
  },
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}