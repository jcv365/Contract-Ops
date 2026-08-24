import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { evidenceService } from '../../modules/evidence/service';
import { EvidenceState } from '../../domain/types';

export const evidenceRouter = Router();

const DEFAULT_USER_ID = 'default-user';

async function getOrCreateProfileId(): Promise<string> {
  const profile = await prisma.profile.upsert({
    where: { userId: DEFAULT_USER_ID },
    update: {},
    create: { userId: DEFAULT_USER_ID, skills: [], certifications: [], domains: [], projects: [], achievements: [], contractPreferences: {} },
  });
  return profile.id;
}

// GET /evidence — the full list, including non-citable states, so the
// portal can show INFERRED/UNKNOWN/CONFLICTED with their labels rather
// than silently hiding them (doc 24: INFERRED must be visibly labelled,
// never hidden or upgraded).
evidenceRouter.get('/', async (req, res, next) => {
  try {
    const profileId = await getOrCreateProfileId();
    const evidence = await prisma.evidence.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' } });
    res.json({ evidence });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  claim: z.string().min(1),
  source: z.string().min(1),
  sourceLocation: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  // A human adding evidence through the portal may directly assert
  // VERIFIED (they know their own CV is accurate) — unlike the AI
  // boundary (aiProposableEvidenceState), which is restricted to
  // SOURCE_REPORTED/INFERRED/UNKNOWN. This route is human-only input.
  state: z.nativeEnum(EvidenceState).default(EvidenceState.SOURCE_REPORTED),
});

// POST /evidence — closes the Sprint 3 gap: this is the first path by
// which real CV/profile data can enter the system as evidence BIDOPS is
// allowed to cite (ADR-004).
evidenceRouter.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const profileId = await getOrCreateProfileId();
    const evidence = await evidenceService.add({ profileId, ...input });
    res.status(201).json(evidence);
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({ verifiedBy: z.string().min(1).default('portal-operator') });

// POST /evidence/:id/verify
evidenceRouter.post('/:id/verify', async (req, res, next) => {
  try {
    const { verifiedBy } = verifySchema.parse(req.body ?? {});
    const evidence = await evidenceService.markVerified(req.params.id, verifiedBy);
    res.json(evidence);
  } catch (err) {
    next(err);
  }
});

// POST /evidence/:id/conflict
evidenceRouter.post('/:id/conflict', async (req, res, next) => {
  try {
    const evidence = await evidenceService.markConflicted(req.params.id);
    res.json(evidence);
  } catch (err) {
    next(err);
  }
});
