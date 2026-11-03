import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { companyIntelligenceService } from '../../modules/company-intelligence/service';
import { discoverCompanyEmails, CompanyNotFoundError } from '../../modules/email-intelligence/service';
import { CompanyType, EmailType } from '../../domain/types';

export const companiesRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().optional(),
  country: z.string().optional(),
  regions: z.array(z.string()).optional(),
  type: z.nativeEnum(CompanyType).optional(),
  specialisms: z.array(z.string()).optional(),
});

// docs-pack/docs/15: GET /companies
companiesRouter.get('/', async (req, res, next) => {
  try {
    const { type, country, limit, offset } = req.query;
    const result = await companyIntelligenceService.list({
      type: type as CompanyType | undefined,
      country: country as string | undefined,
      tenantId: req.tenantId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: POST /companies
companiesRouter.post('/', async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const company = await companyIntelligenceService.create({ ...input, tenantId: req.tenantId });
    res.status(201).json(company);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: GET /companies/:id
companiesRouter.get('/:id', async (req, res, next) => {
  try {
    const company = await companyIntelligenceService.get(req.params.id, req.tenantId);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json(company);
  } catch (err) {
    next(err);
  }
});

const targetingSchema = z.object({
  targetingReason: z.string().min(1),
  proposition: z.string().min(1),
});

companiesRouter.post('/:id/targeting', async (req, res, next) => {
  try {
    const input = targetingSchema.parse(req.body);
    await companyIntelligenceService.setTargeting(req.params.id, input);
    const company = await companyIntelligenceService.get(req.params.id, req.tenantId);
    res.json(company);
  } catch (err) {
    next(err);
  }
});

const addEmailSchema = z.object({
  email: z.string().email(),
  emailType: z.nativeEnum(EmailType),
});

companiesRouter.post('/:id/emails', async (req, res, next) => {
  try {
    const input = addEmailSchema.parse(req.body);
    const email = await companyIntelligenceService.addEmail(req.params.id, input.email, input.emailType);
    res.status(201).json(email);
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  emailId: z.string().uuid(),
  verificationSource: z.string().min(3),
});

companiesRouter.post('/:id/verify-email', async (req, res, next) => {
  try {
    const input = verifySchema.parse(req.body);
    const email = await companyIntelligenceService.verifyEmail(req.params.id, input.emailId, input.verificationSource);
    res.json(email);
  } catch (err) {
    next(err);
  }
});

// POST /companies/:id/discover-emails — Sprint E: org-website discovery.
// Gated on ENABLE_WEB_DISCOVERY inside the provider itself (returns
// UNAVAILABLE, not an error, when the flag is off).
companiesRouter.post('/:id/discover-emails', async (req, res, next) => {
  try {
    const result = await discoverCompanyEmails(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

companiesRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CompanyNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  next(err);
});
