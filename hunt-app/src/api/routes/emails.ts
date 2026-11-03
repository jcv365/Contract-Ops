import { Router, Request, Response, NextFunction } from 'express';
import { verifyRecruiterEmail, listVerifications, EmailNotFoundError } from '../../modules/email-intelligence/service';

export const emailsRouter = Router();

// POST /emails/:id/verify — runs the §78/§79 deterministic failover chain
// against this address (DNS/MX + domain ownership + published-source
// proof) and persists every attempt as a §75 record. This sits alongside
// (does not replace) the existing manual-assertion routes on
// /recruiters/:id/verify-email and /companies/:id/verify-email — both
// paths now produce a comparable EmailVerification record and derived
// classification.
emailsRouter.post('/:id/verify', async (req, res, next) => {
  try {
    const result = await verifyRecruiterEmail(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /emails/:id/verifications — the full §75 history for one address.
emailsRouter.get('/:id/verifications', async (req, res, next) => {
  try {
    const verifications = await listVerifications(req.params.id);
    res.json({ verifications });
  } catch (err) {
    next(err);
  }
});

emailsRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof EmailNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  next(err);
});
