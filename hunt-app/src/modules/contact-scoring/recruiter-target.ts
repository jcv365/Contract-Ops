// §83 recruiter_target_score. Contact quality is reused as a component
// (not reimplemented — see contact-quality.ts); relevance keywords are
// matched against the recruiter's own recorded specialisms only, never
// inferred from company data or guessed.
import { ExplainableScore, ScoreComponent, assemble } from './types';

export interface RecruiterTargetInput {
  contactQuality: ExplainableScore;
  specialisms: string[];
}

const RELEVANCE_KEYWORDS: ReadonlyArray<{ name: string; keywords: string[] }> = [
  { name: 'azure_relevance', keywords: ['azure'] },
  { name: 'cloud_relevance', keywords: ['cloud'] },
  { name: 'architecture_relevance', keywords: ['architecture', 'architect'] },
  { name: 'contract_relevance', keywords: ['contract', 'freelance', 'interim', 'consulting'] },
  { name: 'remote_relevance', keywords: ['remote'] },
  { name: 'international_relevance', keywords: ['international', 'global', 'worldwide'] },
];

function keywordComponent(name: string, keywords: string[], specialisms: string[]): ScoreComponent {
  const known = specialisms.length > 0;
  const matched = known && specialisms.some((s) => keywords.some((k) => s.toLowerCase().includes(k)));
  return {
    name,
    points: matched ? 10 : 0,
    max: 10,
    evidence: known ? (matched ? `specialisms matched: ${keywords.join('/')}` : 'no matching specialism recorded') : 'no specialisms recorded for this recruiter',
    known,
  };
}

export function scoreRecruiterTarget(input: RecruiterTargetInput): ExplainableScore {
  const contactQualityRatio = input.contactQuality.max > 0 ? input.contactQuality.score / input.contactQuality.max : 0;
  const components: ScoreComponent[] = [
    {
      name: 'contact_quality',
      points: Math.round(contactQualityRatio * 30),
      max: 30,
      evidence: `contact quality score ${input.contactQuality.score}/${input.contactQuality.max}`,
      known: true,
    },
    ...RELEVANCE_KEYWORDS.map((r) => keywordComponent(r.name, r.keywords, input.specialisms)),
  ];
  return assemble(components);
}
