// §82 contact_quality_score — "do not award points for unknown
// information." Reuses computeRelationshipScore (0-10) as a component
// rather than reimplementing relationship weighting.
import { EmailClassification, ContactRoleCategory } from '../../domain/types';
import { computeRelationshipScore, RelationshipHistoryEntry } from '../commercial-intelligence/relationship-score';
import { ScoreComponent, ExplainableScore, assemble } from './types';

export interface ContactQualityInput {
  emailClassification?: EmailClassification;
  roleCategory: ContactRoleCategory;
  hasPublicProfile: boolean;
  recruiterSpecialisms: string[];
  profileSpecialisms: string[];
  relationshipStatus: string;
  responseHistory: RelationshipHistoryEntry[];
  opportunityHistoryCount: number;
}

// §73 — HR scores low, decision-makers and recruiters score high; UNKNOWN
// is a genuinely unknown component (0 points, known:false), not a role
// that happens to score 0.
const ROLE_POINTS: Partial<Record<ContactRoleCategory, number>> = {
  [ContactRoleCategory.COMPANY_DECISION_ROLE]: 20,
  [ContactRoleCategory.RECRUITER_ROLE]: 18,
  [ContactRoleCategory.OTHER]: 8,
  [ContactRoleCategory.HR_ROLE]: 4,
};

const EMAIL_CLASSIFICATION_POINTS: Partial<Record<EmailClassification, number>> = {
  [EmailClassification.VERIFIED_NAMED]: 20,
  [EmailClassification.VERIFIED_TEAM]: 12,
  [EmailClassification.VERIFIED_COMPANY]: 8,
};

export function scoreContactQuality(input: ContactQualityInput): ExplainableScore {
  const components: ScoreComponent[] = [];

  const emailKnown = input.emailClassification != null;
  components.push({
    name: 'email_classification',
    points: emailKnown ? (EMAIL_CLASSIFICATION_POINTS[input.emailClassification!] ?? 0) : 0,
    max: 20,
    evidence: emailKnown ? `classification=${input.emailClassification}` : 'no email on file',
    known: emailKnown,
  });

  const roleKnown = input.roleCategory !== ContactRoleCategory.UNKNOWN;
  components.push({
    name: 'role_relevance',
    points: roleKnown ? (ROLE_POINTS[input.roleCategory] ?? 0) : 0,
    max: 20,
    evidence: `roleCategory=${input.roleCategory}`,
    known: roleKnown,
  });

  components.push({
    name: 'public_profile',
    points: input.hasPublicProfile ? 10 : 0,
    max: 10,
    evidence: input.hasPublicProfile ? 'public profile URL on file' : 'no public profile on file',
    known: true,
  });

  const specialismKnown = input.recruiterSpecialisms.length > 0;
  const overlap = input.recruiterSpecialisms.filter((s) => input.profileSpecialisms.some((p) => p.toLowerCase() === s.toLowerCase()));
  components.push({
    name: 'specialism_overlap',
    points: specialismKnown ? Math.min(20, overlap.length * 5) : 0,
    max: 20,
    evidence: specialismKnown ? `${overlap.length} overlapping specialism(s)` : 'no specialisms recorded for this contact',
    known: specialismKnown,
  });

  const relationshipScore = computeRelationshipScore({
    relationshipStatus: input.relationshipStatus,
    responseHistory: input.responseHistory,
    opportunityHistoryCount: input.opportunityHistoryCount,
  });
  components.push({
    name: 'relationship_history',
    points: relationshipScore * 3, // rescale the 0-10 relationship score onto this 0-30 component
    max: 30,
    evidence: `relationship score ${relationshipScore}/10`,
    known: true,
  });

  return assemble(components);
}
