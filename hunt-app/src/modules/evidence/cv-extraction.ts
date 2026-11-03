import { z } from 'zod';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { AiTransport, getAiTransport } from '../ai/transport';
import { wrapUntrustedContent } from '../ai/untrusted-content';
import { parseStructuredResponse, aiProposableEvidenceState } from '../ai/structured-output';
import { loadPrompt, ensurePromptTemplateRecorded } from '../ai/prompt-loader';

export class CvExtractionError extends Error {}

// A parsed CV/document is untrusted content the same way an inbound email
// or advert is (docs/24) — it's a file you provided, but still run
// through the same wrapUntrustedContent boundary as anything else that
// reaches the model, so embedded text designed to look like instructions
// is never treated as one.
export async function extractTextFromDocument(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new CvExtractionError(`Unsupported document type for text extraction: ${mimeType}`);
}

// Deliberately reuses the SAME state restriction as recruiter research
// (aiProposableEvidenceState) — the AI can propose SOURCE_REPORTED,
// INFERRED or UNKNOWN, and can never self-assign VERIFIED. The proposed
// state (SOURCE_REPORTED vs INFERRED vs UNKNOWN) is preserved through to
// the review screen rather than collapsed to one value — an inferred
// claim staying visibly INFERRED is the whole point of the 5-state model
// (docs/24). A human still approves or rejects every claim before any of
// it becomes real Evidence (portal/router.ts's review screen) — this
// function never writes to the database itself.
export const cvExtractionOutputSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string().min(1),
      state: aiProposableEvidenceState,
      evidenceQuote: z.string().min(1),
    })
  ),
});
export type CvExtractionOutput = z.infer<typeof cvExtractionOutputSchema>;

export interface ProposedClaim {
  claim: string;
  source: string;
  sourceLocation?: string;
  state: 'SOURCE_REPORTED' | 'INFERRED' | 'UNKNOWN';
}

// Returns claims for a human to review — never writes to the database
// itself (matches modules/bidops/service.ts:research()'s advisory-only
// pattern). The caller is responsible for what happens after review.
export async function proposeClaimsFromCv(rawText: string, sourceFileName: string, transport: AiTransport = getAiTransport()): Promise<ProposedClaim[]> {
  const prompt = loadPrompt('cv-extraction');
  await ensurePromptTemplateRecorded(prompt);

  const userMessage = [
    wrapUntrustedContent(`uploaded-document:${sourceFileName}`, rawText),
    'Return ONLY JSON matching: {"claims":[{"claim":string,"state":"SOURCE_REPORTED"|"INFERRED"|"UNKNOWN","evidenceQuote":string}]}. Each claim should be one discrete, checkable fact (a skill, a certification, a role, a project, a domain) — never a paragraph, never a summary of the whole document.',
  ].join('\n\n');

  const completion = await transport.complete([
    { role: 'system', content: prompt.content },
    { role: 'user', content: userMessage },
  ]);

  const output = parseStructuredResponse(cvExtractionOutputSchema, completion.content);

  return output.claims.map((c) => ({
    claim: c.claim,
    source: `CV import: ${sourceFileName}`,
    sourceLocation: c.evidenceQuote,
    state: c.state,
  }));
}
