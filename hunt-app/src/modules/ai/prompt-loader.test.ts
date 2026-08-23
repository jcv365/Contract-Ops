import { describe, it, expect } from 'vitest';
import { loadPrompt } from './prompt-loader';

describe('loadPrompt', () => {
  it('loads the email-generation prompt from docs-pack/prompts and content-hashes it', () => {
    const prompt = loadPrompt('email-generation');
    expect(prompt.content.length).toBeGreaterThan(0);
    expect(prompt.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('returns a stable version for the same content across calls', () => {
    const a = loadPrompt('recruiter-research');
    const b = loadPrompt('recruiter-research');
    expect(a.version).toBe(b.version);
  });

  it('loads all six prompt files referenced by docs-pack/docs/00-23', () => {
    for (const name of [
      'recruiter-research',
      'email-generation',
      'email-review',
      'hallucination-check',
      'reply-classification',
      'opportunity-extraction',
    ] as const) {
      expect(() => loadPrompt(name)).not.toThrow();
    }
  });
});
