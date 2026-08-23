import { Prisma, CompanyReadiness } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { CompanyType } from '../../domain/types';
import { scoreCompany } from './scoring';
import { evaluateCompanyReadiness } from './readiness';

export interface CreateCompanyInput {
  name: string;
  website?: string;
  country?: string;
  regions?: string[];
  type?: CompanyType;
  specialisms?: string[];
  tenantId?: string;
}

export interface SetTargetingInput {
  targetingReason: string;
  proposition: string;
}

export class CompanyIntelligenceService {
  async create(input: CreateCompanyInput) {
    const company = await prisma.company.create({
      data: {
        name: input.name,
        website: input.website,
        country: input.country,
        regions: input.regions ?? [],
        type: input.type,
        specialisms: input.specialisms ?? [],
        provenance: { source: 'manual' },
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
    });
    await this.recompute(company.id);
    logger.info({ companyId: company.id }, 'Company created');
    return company;
  }

  // R-24: findFirst-by-id-plus-tenant, not findUnique-by-id-alone — an id
  // belonging to another tenant must 404, never leak via a bare lookup.
  async get(id: string, tenantId?: string) {
    return prisma.company.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: { emails: true, recruiters: true },
    });
  }

  async list(filters: { type?: CompanyType; country?: string; tenantId?: string; limit?: number; offset?: number } = {}) {
    const where: Prisma.CompanyWhereInput = {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    };
    const [companies, total] = await Promise.all([
      prisma.company.findMany({ where, take: filters.limit ?? 50, skip: filters.offset ?? 0, orderBy: { score: 'desc' } }),
      prisma.company.count({ where }),
    ]);
    return { companies, total };
  }

  // Sets the evidence-backed targeting reason and selected proposition
  // required for OUTREACH_READY (doc 27) — a human or BIDOPS research
  // step calls this explicitly; it is never inferred automatically from
  // score alone.
  async setTargeting(companyId: string, input: SetTargetingInput) {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    await prisma.company.update({
      where: { id: companyId },
      data: {
        provenance: {
          ...(company.provenance as object),
          targetingReason: input.targetingReason,
          proposition: input.proposition,
        } as Prisma.InputJsonValue,
      },
    });
    await this.recompute(companyId);
  }

  async addEmail(companyId: string, email: string, emailType: Prisma.RecruiterEmailCreateInput['emailType']) {
    const record = await prisma.recruiterEmail.create({ data: { companyId, email, emailType } });
    await this.recompute(companyId);
    return record;
  }

  async verifyEmail(companyId: string, emailId: string, verificationSource: string) {
    const record = await prisma.recruiterEmail.update({
      where: { id: emailId },
      data: { verified: true, verificationSource, verifiedAt: new Date() },
    });
    await this.recompute(companyId);
    return record;
  }

  async recompute(companyId: string): Promise<void> {
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { emails: true },
    });

    const scores = scoreCompany({ type: company.type, specialisms: company.specialisms, regions: company.regions });

    const provenance = (company.provenance as { targetingReason?: string; proposition?: string }) ?? {};
    const hasValidChannel = company.emails.some((e) => e.verified && e.emailType !== 'INFERRED');

    const readiness = evaluateCompanyReadiness({
      hasWebsite: Boolean(company.website),
      hasType: company.type != null,
      targetingReason: provenance.targetingReason,
      proposition: provenance.proposition,
      hasValidChannel,
    });

    await prisma.company.update({
      where: { id: companyId },
      data: {
        score: scores.overall,
        outreachReadiness: readiness.ready ? CompanyReadiness.OUTREACH_READY : CompanyReadiness.NOT_READY,
        outreachReadinessReason: readiness.reason,
        provenance: {
          ...(company.provenance as object),
          scoreBreakdown: scores as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export const companyIntelligenceService = new CompanyIntelligenceService();
