import { Router } from 'express';
import { z } from 'zod';
import { benchmarkZarRates, scoreRecruiterRelationship, listPartnerCandidates } from '../../modules/commercial-intelligence/service';
import { procurementService } from '../../modules/procurement/service';
import { ProcurementStatus } from '../../domain/types';

export const commercialRouter = Router();

const benchmarkQuerySchema = z.object({ technology: z.string().optional(), location: z.string().optional() });

// Not in the docs/15 literal endpoint list (that predates the addendum's
// commercial-intelligence sprint) but implements docs/12's benchmarking
// requirement.
commercialRouter.get('/benchmark', async (req, res, next) => {
  try {
    const query = benchmarkQuerySchema.parse(req.query);
    const benchmark = await benchmarkZarRates(query);
    res.json(benchmark);
  } catch (err) {
    next(err);
  }
});

commercialRouter.get('/recruiters/:id/relationship-score', async (req, res, next) => {
  try {
    const score = await scoreRecruiterRelationship(req.params.id);
    res.json({ recruiterId: req.params.id, score });
  } catch (err) {
    next(err);
  }
});

commercialRouter.get('/partner-candidates', async (req, res, next) => {
  try {
    const companies = await listPartnerCandidates(req.query.limit ? Number(req.query.limit) : undefined);
    res.json({ companies });
  } catch (err) {
    next(err);
  }
});

const createProcurementSchema = z.object({
  buyer: z.string().min(1),
  procurementPortal: z.string().min(1),
  closingDate: z.coerce.date().optional(),
  scope: z.string().min(1),
  eligibility: z.string().optional(),
  frameworkDuration: z.string().optional(),
  supplierRequirements: z.string().optional(),
  sourceUrl: z.string().url(),
});

commercialRouter.get('/procurement', async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const result = await procurementService.list({
      status: status as ProcurementStatus | undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

commercialRouter.post('/procurement', async (req, res, next) => {
  try {
    const input = createProcurementSchema.parse(req.body);
    const record = await procurementService.create(input);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});
