import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';

export const settingsRouter = Router();

// Matches modules/eligibility/service.ts's HuntSettings shape exactly —
// this is the only place that shape is validated at the API boundary,
// since previously nothing wrote to User.settings.hunt except seed.ts.
const huntSettingsSchema = z.object({
  countries: z.array(z.string()),
  regions: z.array(z.string()),
  contractTypes: z.array(z.string()),
  remoteOnly: z.boolean(),
  seniority: z.array(z.string()),
  excludedKeywords: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()),
  allowedClearanceLevels: z.array(z.string()),
});

const DEFAULT_USER_ID = 'default-user';

// GET /settings/hunt
settingsRouter.get('/hunt', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
    const hunt = (user?.settings as { hunt?: unknown } | undefined)?.hunt ?? null;
    res.json({ hunt });
  } catch (err) {
    next(err);
  }
});

// PUT /settings/hunt — the one place HUNT search preferences can actually
// be changed after initial seed; previously only editable by hand-editing
// the database.
settingsRouter.put('/hunt', async (req, res, next) => {
  try {
    const hunt = huntSettingsSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: DEFAULT_USER_ID } });
    const settings = (user.settings as Record<string, unknown>) ?? {};
    const updated = await prisma.user.update({
      where: { id: DEFAULT_USER_ID },
      data: { settings: { ...settings, hunt } },
    });
    res.json({ hunt: (updated.settings as { hunt: unknown }).hunt });
  } catch (err) {
    next(err);
  }
});
