import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResult {
  content: string;
  provider: string;
  model: string;
}

export class AiTransportError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AiTransportError';
  }
}

export interface AiTransport {
  readonly provider: string;
  readonly verified: boolean; // docs-pack/docs/25: honest, not a claim of production-readiness
  complete(messages: ChatMessage[]): Promise<ChatCompletionResult>;
}

// Speaks the OpenAI-compatible /v1/chat/completions endpoint that
// freellmapi exposes, mirroring the pattern in AEOS's
// src/core/freellmapi-adapter.ts (CLAUDE.md rule 4: reuse existing
// infrastructure rather than reinventing it). This build has not been run
// against a live freellmapi instance with a real API key (none was
// available while building this) — the `verified` flag below is false
// until that happens, and callers must surface that honestly rather than
// claiming the AI path is production-proven (doc 25).
export class HttpAiTransport implements AiTransport {
  readonly provider = 'freellmapi';
  readonly verified = false;

  async complete(messages: ChatMessage[]): Promise<ChatCompletionResult> {
    if (!env.FREELLMAPI_API_KEY) {
      throw new AiTransportError('FREELLMAPI_API_KEY is not configured — AI calls fail closed, never proceed unauthenticated');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.FREELLMAPI_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.FREELLMAPI_API_KEY}`,
          'User-Agent': env.USER_AGENT,
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          messages,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new AiTransportError(`freellmapi returned HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
      }

      const data = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new AiTransportError('freellmapi response missing choices[0].message.content');
      }

      return { content, provider: this.provider, model: data.model ?? env.AI_MODEL };
    } catch (err) {
      if (err instanceof AiTransportError) throw err;
      throw new AiTransportError('freellmapi request failed', err);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Test/offline transport — never used in production code paths, only
// wired in by tests that construct it explicitly.
export class StubAiTransport implements AiTransport {
  readonly provider = 'stub';
  readonly verified = false;
  constructor(private readonly response: ChatCompletionResult | (() => ChatCompletionResult)) {}

  async complete(): Promise<ChatCompletionResult> {
    return typeof this.response === 'function' ? this.response() : this.response;
  }
}

let defaultTransport: AiTransport | undefined;
export function getAiTransport(): AiTransport {
  if (!defaultTransport) {
    defaultTransport = new HttpAiTransport();
    logger.warn(
      { provider: defaultTransport.provider, baseUrl: env.FREELLMAPI_BASE_URL },
      'AI transport initialised — NOT VERIFIED IN THIS ENVIRONMENT (no live call has been proven against this router with a real key during development)'
    );
  }
  return defaultTransport;
}
