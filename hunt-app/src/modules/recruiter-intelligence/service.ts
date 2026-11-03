import { Prisma, RecruiterReadiness } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { EmailType, EmailClassification, EmailVerificationResult } from '../../domain/types';
import { evaluateRecruiterReadiness, selectBestEmail } from './readiness';
import { suppressionService } from '../suppression/service';
import { classifyEmail } from '../email-intelligence/classification';
import { recomputeOutreachState } from '../outreach-state/service';

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

  async list(filters: { companyId?: string; region?: string; tenantId?: string; limit?: number; offset?: number } = {}) {
    const where: Prisma.RecruiterWhereInput = {
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
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

  // The manual-assertion path by which verified/verificationSource/
  // verifiedAt get set — never called automatically by discovery or AI
  // research, only a human or an explicit external verification step. The
  // deterministic chain (email-intelligence/service.ts:verifyRecruiterEmail)
  // is the OTHER path to the same fields; both write a real
  // EmailVerification row and derive classification the same way, so a
  // recruiter verified either way is treated identically by the §74 gate
  // in readiness.ts — a manual assertion isn't a second-class citizen,
  // but it also isn't silently exempted from having an audit record.
  async verifyEmail(recruiterId: string, input: VerifyEmailInput) {
    const existing = await prisma.recruiterEmail.findUniqueOrThrow({ where: { id: input.emailId } });
    const checkedAt = new Date();

    await prisma.emailVerification.create({
      data: {
        recruiterEmailId: input.emailId,
        address: existing.email,
        providerId: 'operator-assertion',
        result: EmailVerificationResult.VALID as never,
        checkedAt,
        method: 'manual-operator-assertion',
        confidence: 0.5, // asserted, not independently machine-checked — lower than the deterministic verifier's 0.95
        conclusive: true,
        chainPosition: 0,
        detail: { verificationSource: input.verificationSource },
      },
    });

    const classification = classifyEmail({ emailType: existing.emailType as unknown as EmailType, latestResult: EmailVerificationResult.VALID });

    const email = await prisma.recruiterEmail.update({
      where: { id: input.emailId },
      data: {
        verified: true,
        verificationSource: input.verificationSource,
        verifiedAt: checkedAt,
        classification: classification as never,
        classifiedAt: checkedAt,
      },
    });
    await this.recomputeReadiness(recruiterId);
    logger.info({ recruiterId, emailId: input.emailId, classification }, 'Recruiter email verified');
    return email;
  }

  async recomputeReadiness(recruiterId: string): Promise<void> {
    const recruiter = await prisma.recruiter.findUniqueOrThrow({
      where: { id: recruiterId },
      include: { emails: true },
    });

    // Matches both an exact address and its registrable domain (R-08 gap
    // fix — Suppression.domain was indexed but never queried before this).
    const suppression = await suppressionService.checkAny(recruiter.emails.map((e) => e.email));

    const bestEmail = selectBestEmail(
      recruiter.emails.map((e) => ({
        emailType: e.emailType as unknown as EmailType,
        verified: e.verified,
        verificationSource: e.verificationSource,
        verifiedAt: e.verifiedAt,
        // §74 — once email-intelligence/service.ts has run a real
        // verification chain on this address, its classification becomes
        // the authority (readiness.ts's gate), not just the legacy
        // verified boolean an operator could previously set by typing any
        // string into a form.
        classification: e.classification as unknown as EmailClassification,
      }))
    );

    const result = evaluateRecruiterReadiness({
      hasCompany: recruiter.companyId != null,
      relationshipStatus: recruiter.relationshipStatus as never,
      suppressed: suppression.suppressed,
      bestEmail,
    });

    await prisma.recruiter.update({
      where: { id: recruiterId },
      data: {
        outreachReadiness: result.ready ? RecruiterReadiness.EMAIL_READY : RecruiterReadiness.NOT_READY,
        outreachReadinessReason: result.reason,
      },
    });

    await recomputeOutreachState({ entityType: 'Recruiter', entityId: recruiterId, trigger: 'readiness.recompute' });
  }
}

export const recruiterIntelligenceService = new RecruiterIntelligenceService();
