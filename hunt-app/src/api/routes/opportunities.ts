import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { OpportunityStatus, Actionability } from '../../domain/types';
import { evaluateOpportunityEligibility, HuntSettings } from '../../modules/eligibility/service';
import { scoreOpportunity } from '../../modules/scoring/service';
import { applyFxToOpportunity } from '../../modules/fx/service';
import { logger } from '../../config/logger';
import { scopeToTenant } from '../middleware/tenant';

export const opportunitiesRouter = Router();

const listQuerySchema = z.object({
  status: z.nativeEnum(OpportunityStatus).optional(),
  actionability: z.nativeEnum(Actionability).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// docs-pack/docs/15: GET /opportunities
opportunitiesRouter.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const where = scopeToTenant(req.tenantId, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.actionability ? { actionability: query.actionability } : {}),
    });
    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: [{ fitScore: 'desc' }, { discoveredAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.opportunity.count({ where }),
    ]);
    res.json({ opportunities, total });
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: GET /opportunities/:id
opportunitiesRouter.get('/:id', async (req, res, next) => {
  try {
    // findFirst, not findUnique-by-id-alone — an id from another tenant
    // must 404 exactly like a nonexistent one, never leak whether it exists.
    const opportunity = await prisma.opportunity.findFirst({ where: scopeToTenant(req.tenantId, { id: req.params.id }) });
    if (!opportunity) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    res.json(opportunity);
  } catch (err) {
    next(err);
  }
});

// docs-pack/docs/15: POST /opportunities/:id/revalidate
opportunitiesRouter.post('/:id/revalidate', async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!opportunity) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: 'default-user' } });
    const settings = (user?.settings as { hunt?: HuntSettings } | undefined)?.hunt;
    if (!settings) {
      res.status(500).json({ error: 'Hunt settings not configured' });
      return;
    }

    await evaluateOpportunityEligibility(opportunity.id, settings);
    await scoreOpportunity(opportunity.id, settings);
    await applyFxToOpportunity(opportunity.id);

    const updated = await prisma.opportunity.findUnique({ where: { id: opportunity.id } });
    logger.info({ opportunityId: opportunity.id }, 'Opportunity revalidated');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
