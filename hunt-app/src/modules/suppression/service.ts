import { SuppressionReason } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { extractDomain, registrableDomain } from '../email-intelligence/domain';

export interface CreateSuppressionInput {
  email: string;
  reason: SuppressionReason;
  notes?: string;
}

export interface SuppressionMatch {
  suppressed: boolean;
  reason?: SuppressionReason;
  scope?: 'email' | 'domain';
}

// The do-not-contact hard gate (docs/28, §91). Found in the recovery audit:
// Suppression.domain was indexed but never actually queried anywhere — a
// suppressed PERSON's individual address blocked sending to them, but a
// suppressed DOMAIN (e.g. a company that asked never to be contacted
// again) did nothing, because every caller matched on exact email only.
export class SuppressionService {
  async create(input: CreateSuppressionInput) {
    const normalisedEmail = input.email.toLowerCase();
    const domain = extractDomain(normalisedEmail);
    const suppression = await prisma.suppression.upsert({
      where: { email: normalisedEmail },
      update: { reason: input.reason, notes: input.notes },
      create: {
        email: normalisedEmail,
        domain: domain ? registrableDomain(domain) : undefined,
        reason: input.reason,
        notes: input.notes,
      },
    });
    logger.info({ suppressionId: suppression.id, reason: input.reason }, 'Suppression recorded');
    return suppression;
  }

  async list(limit = 100) {
    return prisma.suppression.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  async delete(id: string) {
    return prisma.suppression.delete({ where: { id } });
  }

  // Matches an exact address OR its registrable domain against a
  // domain-level suppression. Callers must not fall back to a bare
  // `prisma.suppression.findUnique({ where: { email } })` — that silently
  // skips the domain check this method exists to enforce.
  async check(email: string): Promise<SuppressionMatch> {
    const normalised = email.toLowerCase();
    const domain = extractDomain(normalised);
    const registrable = domain ? registrableDomain(domain) : undefined;

    const byEmail = await prisma.suppression.findUnique({ where: { email: normalised } });
    if (byEmail) return { suppressed: true, reason: byEmail.reason, scope: 'email' };

    if (registrable) {
      const byDomain = await prisma.suppression.findFirst({ where: { domain: registrable } });
      if (byDomain) return { suppressed: true, reason: byDomain.reason, scope: 'domain' };
    }

    return { suppressed: false };
  }

  // Convenience for callers checking several addresses on one entity
  // (a Recruiter/Company can have more than one RecruiterEmail row).
  async checkAny(emails: string[]): Promise<SuppressionMatch> {
    for (const email of emails) {
      const result = await this.check(email);
      if (result.suppressed) return result;
    }
    return { suppressed: false };
  }
}

export const suppressionService = new SuppressionService();
