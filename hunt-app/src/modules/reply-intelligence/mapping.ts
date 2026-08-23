import { ExtractionOutput } from './schemas';

// docs-pack/docs/10: "Never invent missing values." A field only maps into
// the proposed Opportunity when the model both supplied a non-null value
// AND met a minimum confidence — a low-confidence guess is treated the
// same as a missing one, not fabricated into the record. This is the
// enforcement behind mandatory test #14 ("reply with no rate does not
// invent one").
const MIN_CONFIDENCE = 0.5;

function take<T>(field: { value: T | null; confidence: number }): T | undefined {
  return field.value != null && field.confidence >= MIN_CONFIDENCE ? field.value : undefined;
}

export interface MappedOpportunityFields {
  title?: string;
  location?: string;
  remotePolicy?: 'FULLY_REMOTE' | 'REMOTE_FIRST' | 'HYBRID' | 'ONSITE';
  originalRate?: number;
  originalCurrency?: string;
  gaps: string[];
}

export function mapExtractionToOpportunityFields(extraction: ExtractionOutput): MappedOpportunityFields {
  const gaps: string[] = [];

  const role = take(extraction.role);
  const location = take(extraction.location);
  const remotePolicy = take(extraction.remotePolicy);
  const rate = take(extraction.rate);
  const currency = take(extraction.currency);

  if (!role) gaps.push('Role not confidently extracted from reply');
  if (!location) gaps.push('Location not confidently extracted from reply');
  if (!remotePolicy) gaps.push('Remote policy not confidently extracted from reply');
  // Rate and currency are a pair — never report a rate with no currency,
  // or a currency with no rate; both or neither.
  if ((rate && !currency) || (!rate && currency)) {
    gaps.push('Rate and currency were not both confidently extracted — reported as unknown rather than partial');
  }

  return {
    title: role,
    location,
    remotePolicy,
    originalRate: rate && currency ? rate : undefined,
    originalCurrency: rate && currency ? currency : undefined,
    gaps,
  };
}
