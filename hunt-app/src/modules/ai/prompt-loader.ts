import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../../db/client';

// docs-pack/docs/14 and /17 mandate recording the prompt version used for
// every AI-driven output. The prompt files themselves
// (docs-pack/prompts/*.md) have no version string, so this content-hashes
// them: editing a prompt's wording changes its version automatically,
// and every past OutreachDraft stays traceable to the exact text that
// produced it (via PromptTemplate.version), without a human remembering
// to bump anything.
const DOCS_PACK_PROMPTS_DIR = join(__dirname, '../../../../docs-pack/prompts');

const PROMPT_FILES: Record<string, string> = {
  'recruiter-research': 'recruiter-research.md',
  'email-generation': 'email-generation.md',
  'email-review': 'email-review.md',
  'hallucination-check': 'hallucination-check.md',
  'reply-classification': 'reply-classification.md',
  'opportunity-extraction': 'opportunity-extraction.md',
  'cv-extraction': 'cv-extraction.md',
};

export interface LoadedPrompt {
  name: string;
  version: string;
  content: string;
}

const cache = new Map<string, LoadedPrompt>();

export function loadPrompt(name: keyof typeof PROMPT_FILES): LoadedPrompt {
  const cached = cache.get(name);
  if (cached) return cached;

  const filePath = join(DOCS_PACK_PROMPTS_DIR, PROMPT_FILES[name]);
  const content = readFileSync(filePath, 'utf-8');
  const version = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);

  const loaded: LoadedPrompt = { name, version, content };
  cache.set(name, loaded);
  return loaded;
}

export async function ensurePromptTemplateRecorded(prompt: LoadedPrompt): Promise<void> {
  await prisma.promptTemplate.upsert({
    where: { name_version: { name: prompt.name, version: prompt.version } },
    update: {},
    create: { name: prompt.name, version: prompt.version, content: prompt.content },
  });
}
