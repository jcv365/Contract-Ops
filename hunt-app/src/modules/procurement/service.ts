import { Prisma, ProcurementStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';

export interface CreateProcurementInput {
  buyer: string;
  procurementPortal: string;
  closingDate?: Date;
  scope: string;
  eligibility?: string;
  frameworkDuration?: string;
  supplierRequirements?: string;
  sourceUrl: string;
}

// docs-pack/docs/13: "These are discovery and intelligence features, not
// autonomous bid submission. Human approval is required for any external
// response." This service only ever records what was found — nothing here
// submits a response to a procurement portal.
export class ProcurementService {
  async create(input: CreateProcurementInput) {
    const record = await prisma.procurementOpportunity.create({ data: input });
    logger.info({ procurementId: record.id, buyer: input.buyer }, 'Procurement opportunity recorded');
    return record;
  }

  async list(filters: { status?: ProcurementStatus; limit?: number; offset?: number } = {}) {
    const where: Prisma.ProcurementOpportunityWhereInput = filters.status ? { status: filters.status } : {};
    const [opportunities, total] = await Promise.all([
      prisma.procurementOpportunity.findMany({
        where,
        orderBy: { closingDate: 'asc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      prisma.procurementOpportunity.count({ where }),
    ]);
    return { opportunities, total };
  }

  async setStatus(id: string, status: ProcurementStatus) {
    return prisma.procurementOpportunity.update({ where: { id }, data: { status } });
  }
}

export const procurementService = new ProcurementService();
