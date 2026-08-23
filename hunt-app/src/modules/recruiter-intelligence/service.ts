import { Prisma, RecruiterReadiness } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { EmailType } from '../../domain/types';
import { evaluateRecruiterReadiness, selectBestEmail } from './readiness';

export interface CreateRecruiterInput {
  companyId?: string;
  name: string;
  title?: string;
  specialisms?: string[];
  region?: string;
  publicProfileUrl?: string;
}

export interface AddRecruiterEmailInput {
  email: string;
  // Recorded as INFERRED for a guessed address rather than silently
  // rejecting the write — CLAUDE.md rule 6 governs what may be SENT TO,
  // not what may be recorded for audit visibility (see base.ts comment
  // on RecruiterEmail in the schema for the same reasoning).
  emailType: EmailType;
}

export interface VerifyEmailInput {
  emailId: string;
  // ADR-003: "Never guess or infer an email address." verificationSource
  // must name a real, independent check (e.g. "linkedin-cross-check",
  // "domain-mx-check", "recruiter-confirmed-by-reply") — this function
  // does not itself perform verification, it only records that a caller
  // asserts one occurred, with what evidence.
  verificationSource: string;
}

export class RecruiterIntelligenceService {
  async create(input: CreateRecruiterInput) {
    const recruiter = await prisma.recruiter.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        title: input.title,
        specialisms: input.specialisms ?? [],
        region: input.region,
        publicProfileUrl: input.publicProfileUrl,
      },
    });
    logger.info({ recruiterId: recruiter.id }, 'Recruiter created');
    return recruiter;
  }

  async get(id: string) {
    return prisma.recruiter.findUnique({ where: { id }, include: { emails: true, company: true } });
  }

  async list(filters: { companyId?: string; region?: string; limit?: number; offset?: number } = {}) {
    const where: Prisma.RecruiterWhereInput = {
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.region ? { region: filters.region } : {}),
    };
    const [recruiters, total] = await Promise.all([
      prisma.recruiter.findMany({
        where,
        include: { emails: true },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recruiter.count({ where }),
    ]);
    return { recruiters, total };
  }

  async addEmail(recruiterId: string, input: AddRecruiterEmailInput) {
    const email = await prisma.recruiterEmail.create({
      data: { recruiterId, email: input.email, emailType: input.emailType },
    });
    await this.recomputeReadiness(recruiterId);
    return email;
  }

  // The only path by which verified/verificationSource/verifiedAt get
  // set. Never called automatically by discovery or AI research — a human
  // or an explicit external verification step must call this.
  async verifyEmail(recruiterId: string, input: VerifyEmailInput) {
    const email = await prisma.recruiterEmail.update({
      where: { id: input.emailId },
      data: { verified: true, verificationSource: input.verificationSource, verifiedAt: new Date() },
    });
    await this.recomputeReadiness(recruiterId);
    logger.info({ recruiterId, emailId: input.emailId }, 'Recruiter email verified');
    return email;
  }

  async recomputeReadiness(recruiterId: string): Promise<void> {
    const recruiter = await prisma.recruiter.findUniqueOrThrow({
      where: { id: recruiterId },
      include: { emails: true },
    });

    const suppressed = await prisma.suppression.findFirst({
      where: { email: { in: recruiter.emails.map((e) => e.email) } },
    });

    const bestEmail = selectBestEmail(
      recruiter.emails.map((e) => ({
        emailType: e.emailType as unknown as EmailType,
        verified: e.verified,
        verificationSource: e.verificationSource,
        verifiedAt: e.verifiedAt,
      }))
    );

    const result = evaluateRecruiterReadiness({
      hasCompany: recruiter.companyId != null,
      relationshipStatus: recruiter.relationshipStatus as never,
      suppressed: suppressed != null,
      bestEmail,
    });

    await prisma.recruiter.update({
      where: { id: recruiterId },
      data: {
        outreachReadiness: result.ready ? RecruiterReadiness.EMAIL_READY : RecruiterReadiness.NOT_READY,
        outreachReadinessReason: result.reason,
      },
    });
  }
}

export const recruiterIntelligenceService = new RecruiterIntelligenceService();
