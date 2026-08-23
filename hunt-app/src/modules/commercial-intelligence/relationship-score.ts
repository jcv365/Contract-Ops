// docs-pack/docs/17 lists "recruiter verification rate" and relationship
// tracking among the required metrics. This scores how valuable an
// existing relationship is for prioritising follow-up, distinct from
// modules/recruiter-intelligence's outreach *readiness* gate (which is a
// binary can-we-send-to-them check, not a value score).
const STATUS_BASE_SCORE: Record<string, number> = {
  UNKNOWN: 2,
  CONTACTED: 4,
  RESPONDED: 6,
  ENGAGED: 8,
  PARTNER: 10,
  DO_NOT_CONTACT: 0,
};

export interface RelationshipHistoryEntry {
  respondedAt?: string | Date | null;
}

export interface RelationshipScoreInput {
  relationshipStatus: string;
  responseHistory: RelationshipHistoryEntry[];
  opportunityHistoryCount: number;
}

export function computeRelationshipScore(input: RelationshipScoreInput): number {
  const base = STATUS_BASE_SCORE[input.relationshipStatus] ?? 2;
  if (input.relationshipStatus === 'DO_NOT_CONTACT') return 0;

  const responded = input.responseHistory.filter((h) => h.respondedAt != null).length;
  const responseBonus = input.responseHistory.length > 0 ? (responded / input.responseHistory.length) * 2 : 0;
  const opportunityBonus = Math.min(2, input.opportunityHistoryCount * 0.5);

  return Math.min(10, Math.round((base + responseBonus + opportunityBonus) * 100) / 100);
}
