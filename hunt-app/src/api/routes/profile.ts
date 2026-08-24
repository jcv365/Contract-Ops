import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/client';

export const profileRouter = Router();

const DEFAULT_USER_ID = 'default-user';

// GET /profile
profileRouter.get('/', async (req, res, next) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: DEFAULT_USER_ID } });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  domains: z.array(z.string()).optional(),
  projects: z.array(z.unknown()).optional(),
  achievements: z.array(z.unknown()).optional(),
  contractPreferences: z.record(z.unknown()).optional(),
});

// PUT /profile — docs-pack/docs/01: "The approved profile and evidence
// must come from the user's actual profile repository/data." This is the
// path for that — previously the only way to touch this row was a direct
// DB write, and the Sprint 0 seed deliberately left it empty rather than
// carry forward the original scaffold's fabricated biography.
profileRouter.put('/', async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const profile = await prisma.profile.upsert({
      where: { userId: DEFAULT_USER_ID },
      update: {
        ...input,
        projects: input.projects as Prisma.InputJsonValue | undefined,
        achievements: input.achievements as Prisma.InputJsonValue | undefined,
        contractPreferences: input.contractPreferences as Prisma.InputJsonValue | undefined,
      },
      create: {
        userId: DEFAULT_USER_ID,
        skills: input.skills ?? [],
        certifications: input.certifications ?? [],
        domains: input.domains ?? [],
        projects: (input.projects ?? []) as Prisma.InputJsonValue,
        achievements: (input.achievements ?? []) as Prisma.InputJsonValue,
        contractPreferences: (input.contractPreferences ?? {}) as Prisma.InputJsonValue,
        headline: input.headline,
        summary: input.summary,
      },
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});
