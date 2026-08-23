import { z } from 'zod';
import { aiProposableEvidenceState } from '../ai/structured-output';

// Structured output for prompts/recruiter-research.md. Deliberately has NO
// email field — ADR-003 keeps email discovery/verification entirely out
// of the free-text AI path; it is only ever set through the deterministic
// verify-email flow in modules/recruiter-intelligence.
export const researchFindingsSchema = z.object({
  findings: z.array(
    z.object({
      claim: z.string().min(1),
      state: aiProposableEvidenceState,
      evidenceQuote: z.string().min(1),
    })
  ),
  recommendedOutreachAngle: z.string().min(1),
  missingInformation: z.array(z.string()),
});
export type ResearchFindings = z.infer<typeof researchFindingsSchema>;

// Structured output for prompts/email-generation.md.
export const draftOutputSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  // Every evidenceId here must be one this build actually supplied in the
  // prompt context — anything else is a fabricated citation and is
  // rejected by modules/bidops/service.ts, not silently dropped.
  evidenceIds: z.array(z.string()),
  recommendedAttachment: z.enum(['CV', 'COMPANY_PROFILE', 'BOTH', 'NONE']),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;

// Structured output for prompts/email-review.md and
// prompts/hallucination-check.md — same shape, different prompt content.
export const reviewOutputSchema = z.object({
  result: z.enum(['PASS', 'FAIL']),
  issues: z.array(z.string()),
});
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
