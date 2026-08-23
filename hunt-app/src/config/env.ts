import { z } from 'zod';

// z.coerce.boolean() treats any non-empty string as true — "false" would
// enable ENABLE_GRAPH_SEND. This only accepts the literal strings.
const strictBoolean = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((v) => v === 'true');

// Environment configuration schema
export const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Microsoft Graph / Entra ID
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  // docker-compose's ${VAR:-} interpolation yields an empty string, not an
  // absent key, when the .env value is blank — z.string().url().optional()
  // rejects "" (it's a defined value that fails .url(), not `undefined`),
  // which crashed the container on first deploy. Treat blank as absent.
  GRAPH_REDIRECT_URI: z
    .union([z.literal(''), z.string().url()])
    .optional()
    .transform((v) => (v ? v : undefined)),

  // AI Provider — routed through freellmapi (CLAUDE.md rule 4: reuse
  // existing model routing/infrastructure rather than adding a fourth AI
  // vendor). openai/anthropic/local are kept only as an escape hatch for
  // local dev against a different router; freellmapi is the default and
  // the only path this build actually exercises.
  AI_PROVIDER: z.enum(['freellmapi', 'openai', 'anthropic', 'local']).default('freellmapi'),
  FREELLMAPI_BASE_URL: z.string().url().default('http://host.docker.internal:3010'),
  FREELLMAPI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),

  // Search/Scraping
  USER_AGENT: z.string().default('HUNT-Contract-Acquisition-OS/1.0'),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  MAX_CONCURRENT_REQUESTS: z.coerce.number().default(5),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: strictBoolean(true),

  // Security
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().length(32).optional(),

  // Feature Flags — safety-critical: must fail closed, never coerce a
  // truthy-string bug into enabling autonomous sending (ADR-002).
  ENABLE_REPLY_INGESTION: strictBoolean(false),
  ENABLE_GRAPH_SEND: strictBoolean(false),
  ENABLE_BIDOPS: strictBoolean(true),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export const env = getEnv();