import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseStructuredResponse, AiValidationError } from './structured-output';

const schema = z.object({ claim: z.string(), state: z.enum(['SOURCE_REPORTED', 'INFERRED', 'UNKNOWN']) });

describe('parseStructuredResponse', () => {
  it('parses a plain JSON response', () => {
    const result = parseStructuredResponse(schema, '{"claim":"x","state":"SOURCE_REPORTED"}');
    expect(result.claim).toBe('x');
  });

  it('strips a ```json fence some models add despite instructions not to', () => {
    const raw = '```json\n{"claim":"x","state":"INFERRED"}\n```';
    expect(parseStructuredResponse(schema, raw).state).toBe('INFERRED');
  });

  // docs-pack/docs/24: model failure or invalid output fails closed.
  it('fails closed on malformed JSON rather than guessing', () => {
    expect(() => parseStructuredResponse(schema, 'not json at all')).toThrow(AiValidationError);
  });

  it('fails closed when the response does not match the schema', () => {
    expect(() => parseStructuredResponse(schema, '{"claim":"x","state":"VERIFIED"}')).toThrow(AiValidationError);
  });

  it('fails closed on an empty response', () => {
    expect(() => parseStructuredResponse(schema, '')).toThrow(AiValidationError);
  });
});
