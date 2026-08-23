import { z } from 'zod';

// Structured output for prompts/reply-classification.md.
export const classificationOutputSchema = z.object({
  classification: z.enum([
    'INTERESTED',
    'OPPORTUNITY',
    'REQUEST_CV',
    'REQUEST_PROFILE',
    'REQUEST_RATE',
    'REQUEST_CALL',
    'NOT_SUITABLE',
    'FUTURE_OPPORTUNITY',
    'OUT_OF_OFFICE',
    'REJECTED',
    'DO_NOT_CONTACT',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
});
export type ClassificationOutput = z.infer<typeof classificationOutputSchema>;

// Structured output for prompts/opportunity-extraction.md. Every field is
// an object with an explicit nullable value plus a confidence — "use null
// for missing values, never guess, return confidence per extracted field"
// is enforced by the shape itself: there is no way to express "I'm not
// sure but I'll say something anyway" in this schema.
const extractedField = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({ value: valueSchema.nullable(), confidence: z.number().min(0).max(1) });

export const extractionOutputSchema = z.object({
  role: extractedField(z.string()),
  client: extractedField(z.string()),
  startDate: extractedField(z.string()),
  duration: extractedField(z.string()),
  rate: extractedField(z.number()),
  currency: extractedField(z.string()),
  remotePolicy: extractedField(z.enum(['FULLY_REMOTE', 'REMOTE_FIRST', 'HYBRID', 'ONSITE'])),
  location: extractedField(z.string()),
  workAuthorisation: extractedField(z.string()),
  clearance: extractedField(z.string()),
  technologies: extractedField(z.array(z.string())),
  nextAction: extractedField(z.string()),
  deadline: extractedField(z.string()),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
