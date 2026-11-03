import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { recruiterIntelligenceService } from '../../modules/recruiter-intelligence/service';
import { discoverRecruiterEmails, RecruiterNotFoundError } from '../../modules/email-intelligence/service';
import { EmailType } from '../../domain/types';

export const recruitersRouter = Router();

const createSchema = z.object({
  companyId: z.string().uuid().optional(),
  name: z.string().min(1),
  title: z.string().optional(),
  specialisms: z.array(z.string()).optional(),
  region: z.string().optional(),
  publicProfileUrl: z.string().url().optional(),
});

// docs-pack/docs/15: GET /recruiters
recruitersRouter.get('/', async (req, res, next) => {
  try {
    const { companyId, region, limit, offset } = req.query;
    const result = await recruiterIntelligenceService.list({
      companyId: companyId as string | undefined,
      region: region as string | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: POST /recruiters
recruitersRouter.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const recruiter = await recruiterIntelligenceService.create(input);
    res.status(201).json(recruiter);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: GET /recruiters/:id
recruitersRouter.get('/:id', async (req, res, next) => {
  try {
    const recruiter = await recruiterIntelligenceService.get(req.params.id);
    if (!recruiter) {
      res.status(404).json({ error: 'Recruiter not found' });
      return;
    }
    res.json(recruiter);
  } catch (err) {
    next(err);
  }
});

const addEmailSchema = z.object({
  email: z.string().email(),
  emailType: z.nativeEnum(EmailType),
});

recruitersRouter.post('/:id/emails', async (req, res, next) => {
  try {
    const input = addEmailSchema.parse(req.body);
    const email = await recruiterIntelligenceService.addEmail(req.params.id, input);
    res.status(201).json(email);
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  emailId: z.string().uuid(),
  // ADR-003: never a system-generated guess — this must name a real,
  // independent verification method.
  verificationSource: z.string().min(3),
});

// docs-pack/docs/15: POST /recruiters/:id/verify-email
recruitersRouter.post('/:id/verify-email', async (req, res, next) => {
  try {
    const input = verifySchema.parse(req.body);
    const email = await recruiterIntelligenceService.verifyEmail(req.params.id, input);
    res.json(email);
  } catch (err) {
    next(err);
  }
});

// POST /recruiters/:id/discover-emails — Sprint E: finds this recruiter's
// email on their linked company's own site.
recruitersRouter.post('/:id/discover-emails', async (req, res, next) => {
  try {
    const result = await discoverRecruiterEmails(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

recruitersRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof RecruiterNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  next(err);
});
