import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdapterStatus } from '@prisma/client';
import { listCompliancePolicies, updateCompliancePolicy, CompliancePolicyActivationError } from '../../modules/web-fetch/compliance';

export const siteComplianceRouter = Router();

// GET /site-compliance — the docs/22 record per domain, previously invisible
// (this is a new subsystem, Sprint C of the email-engine build).
siteComplianceRouter.get('/', async (req, res, next) => {
  try {
    const policies = await listCompliancePolicies();
    res.json({ policies });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  termsUrl: z.string().url().optional(),
  licence: z.string().optional(),
  permittedMethod: z.string().optional(),
  attributionRequired: z.boolean().optional(),
  redistributionNotes: z.string().optional(),
  privacyNotes: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(AdapterStatus).optional(),
  markReviewed: z.boolean().optional(),
});

siteComplianceRouter.post('/:domain', async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const policy = await updateCompliancePolicy(req.params.domain, input);
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

siteComplianceRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CompliancePolicyActivationError) {
    res.status(422).json({ error: err.message });
    return;
  }
  next(err);
});
