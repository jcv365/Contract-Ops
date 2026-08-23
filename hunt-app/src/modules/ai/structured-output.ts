import { z, ZodSchema } from 'zod';

export class AiValidationError extends Error {
  constructor(message: string, readonly issues?: unknown) {
    super(message);
    this.name = 'AiValidationError';
  }
}

// docs-pack/docs/24: "Model failure, invalid output or insufficient
// evidence fails closed." Every AI response that is supposed to be
// structured data goes through this — malformed JSON or a schema mismatch
// throws AiValidationError, which callers must treat as a blocking
// failure (never a partial/best-effort acceptance of the response).
export function parseStructuredResponse<T>(schema: ZodSchema<T>, raw: string): T {
  let candidate: unknown;
  // Models sometimes wrap JSON in a ```json fence despite instructions not
  // to — strip it defensively rather than fail on formatting alone, but
  // still fail closed on genuinely malformed content.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = (fenced ? fenced[1] : raw).trim();

  try {
    candidate = JSON.parse(jsonText);
  } catch (err) {
    throw new AiValidationError('AI response was not valid JSON', err);
  }

  const result = schema.safeParse(candidate);
  if (!result.success) {
    throw new AiValidationError('AI response did not match the required schema', result.error.issues);
  }
  return result.data;
}

// Shared building block: an AI-proposed evidence state is deliberately
// restricted to SOURCE_REPORTED / INFERRED / UNKNOWN. VERIFIED is reserved
// for deterministic, independently-verified facts (e.g. a confirmed email
// verification) and CONFLICTED is set by conflict-detection logic — the AI
// itself is never trusted to self-assign either of those two.
export const aiProposableEvidenceState = z.enum(['SOURCE_REPORTED', 'INFERRED', 'UNKNOWN']);
