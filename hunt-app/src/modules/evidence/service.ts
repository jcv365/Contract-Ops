import { EvidenceState as PrismaEvidenceState } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { CITABLE_EVIDENCE_STATES, EvidenceState } from '../../domain/types';

export interface AddEvidenceInput {
  profileId: string;
  claim: string;
  source: string;
  sourceLocation?: string;
  confidence: number;
  // Only SOURCE_REPORTED/INFERRED/UNKNOWN may originate from AI research —
  // enforced at the AI boundary (see modules/ai/structured-output.ts). A
  // human/deterministic verification step is the only path to VERIFIED.
  state: EvidenceState;
}

export function isCitable(state: EvidenceState): boolean {
  return CITABLE_EVIDENCE_STATES.has(state);
}

export class EvidenceService {
  async add(input: AddEvidenceInput) {
    const evidence = await prisma.evidence.create({
      data: {
        profileId: input.profileId,
        claim: input.claim,
        source: input.source,
        sourceLocation: input.sourceLocation,
        confidence: input.confidence,
        state: input.state as unknown as PrismaEvidenceState,
      },
    });
    logger.info({ evidenceId: evidence.id, state: input.state }, 'Evidence recorded');
    return evidence;
  }

  // The only path to EvidenceState.VERIFIED — a human or an independent
  // verification step confirms the claim against its stated source, and
  // must say how (per ADR-003's insistence on a recorded verification
  // method, applied here to evidence generally, not just email).
  async markVerified(evidenceId: string, verifiedBy: string) {
    const evidence = await prisma.evidence.update({
      where: { id: evidenceId },
      data: { state: PrismaEvidenceState.VERIFIED },
    });
    await prisma.auditEvent.create({
      data: {
        actor: verifiedBy,
        action: 'evidence.verify',
        entityType: 'Evidence',
        entityId: evidenceId,
        metadata: { previousState: 'checked_by_caller' },
      },
    });
    return evidence;
  }

  async markConflicted(evidenceId: string) {
    return prisma.evidence.update({ where: { id: evidenceId }, data: { state: PrismaEvidenceState.CONFLICTED } });
  }

  async listCitable(profileId: string) {
    const evidence = await prisma.evidence.findMany({
      where: { profileId, state: { in: [PrismaEvidenceState.VERIFIED, PrismaEvidenceState.SOURCE_REPORTED] } },
      orderBy: { confidence: 'desc' },
    });
    return evidence;
  }
}

export const evidenceService = new EvidenceService();
