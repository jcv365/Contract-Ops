import { env } from './env';
import { logger } from './logger';

export class PreflightError extends Error {}

// docs-pack/docs/25: "a mock is not proof" — this refuses to boot in a
// state that would look ready but silently violate a safety rule.
// DATABASE_URL itself is already enforced by env.ts's zod schema (the
// process throws before this ever runs if it's missing) — this covers the
// conditions env.ts can't express: fields required only when a *feature*
// is turned on, not always.
export function runStartupPreflight(): void {
  const errors: string[] = [];

  if (env.ENABLE_GRAPH_SEND && !env.ENCRYPTION_KEY) {
    errors.push('ENABLE_GRAPH_SEND=true but ENCRYPTION_KEY is not set — Graph tokens cannot be encrypted at rest (rule 16)');
  }
  if (env.ENABLE_GRAPH_SEND && (!env.AZURE_TENANT_ID || !env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET)) {
    errors.push('ENABLE_GRAPH_SEND=true but AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET are not fully set');
  }
  if (env.ENABLE_REPLY_INGESTION && !env.ENABLE_GRAPH_SEND) {
    // Not a hard requirement in every deployment topology, but reply
    // ingestion with no way to have ever sent anything is very likely a
    // misconfiguration worth refusing rather than silently accepting.
    errors.push('ENABLE_REPLY_INGESTION=true but ENABLE_GRAPH_SEND=false — Mail.Read without Mail.Send is an unusual combination, refusing to boot; set both deliberately if this is intended');
  }

  if (errors.length > 0) {
    for (const e of errors) logger.error({ preflight: e }, 'Startup preflight failed');
    throw new PreflightError(`Startup preflight failed:\n${errors.join('\n')}`);
  }

  if (!env.FREELLMAPI_API_KEY) {
    logger.warn('FREELLMAPI_API_KEY is not set — BIDOPS and reply-classification AI calls will fail closed (422) until it is configured; HUNT search, scoring and approval are unaffected');
  }
  if (!env.ENABLE_GRAPH_SEND) {
    logger.warn('ENABLE_GRAPH_SEND=false — outreach send uses MockGraphTransport (NOT VERIFIED IN THIS ENVIRONMENT, no real mailbox involved)');
  }

  logger.info('Startup preflight passed');
}
