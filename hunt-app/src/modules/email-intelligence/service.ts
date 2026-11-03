import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { EmailType, EmailSourceKind, EmailVerificationResult } from '../../domain/types';
import { recruiterIntelligenceService } from '../recruiter-intelligence/service';
import { companyIntelligenceService } from '../company-intelligence/service';
import { runVerificationChain, runDiscoveryChain } from './chain';
import { verificationProviders, discoveryProviders } from './registry';
import { classifyEmail } from './classification';
import { VerificationTarget } from './verification-provider';
import { DiscoveryTarget, DiscoveredEmailCandidate } from './discovery-provider';
import { domainOwnershipMatch, extractDomain } from './domain';
import { recomputeOutreachState } from '../outreach-state/service';

export class EmailNotFoundError extends Error {}
export class CompanyNotFoundError extends Error {}
export class RecruiterNotFoundError extends Error {}

export interface VerifyEmailResult {
  emailId: string;
  final: EmailVerificationResult;
  attempts: number;
  classification: string;
}

// Runs the §78/§79 failover chain for one RecruiterEmail, persists every
// attempt as a §75 EmailVerification record (append-only, chainPosition
// order), derives the §74 classification, and re-triggers the owning
// recruiter's/company's readiness gate — this is the first path by which
// classification and readiness can actually be driven by a real check
// rather than an operator's free-text assertion.
export async function verifyRecruiterEmail(emailId: string): Promise<VerifyEmailResult> {
  const email = await prisma.recruiterEmail.findUnique({
    where: { id: emailId },
    include: { observations: true, recruiter: { include: { company: true } }, company: true },
  });
  if (!email) throw new EmailNotFoundError(`RecruiterEmail ${emailId} not found`);

  const company = email.company ?? email.recruiter?.company ?? null;
  const personName = email.recruiter?.name ?? undefined;

  const target: VerificationTarget = {
    address: email.email,
    companyWebsite: company?.website ?? undefined,
    companyName: company?.name ?? 'Unknown',
    personName,
    observations: email.observations.map((o) => ({
      sourceUrl: o.sourceUrl,
      sourceKind: o.sourceKind as unknown as EmailSourceKind,
      domainMatch: o.domainMatch,
      observedAt: o.observedAt,
      personName: o.personName ?? undefined,
    })),
  };

  const chainResult = await runVerificationChain(verificationProviders, target);

  await prisma.$transaction(
    chainResult.attempts.map((attempt, index) =>
      prisma.emailVerification.create({
        data: {
          recruiterEmailId: emailId,
          address: email.email,
          providerId: attempt.providerId,
          result: attempt.result as never,
          checkedAt: attempt.checkedAt,
          method: attempt.method,
          confidence: attempt.confidence,
          sourceUrl: attempt.sourceUrl,
          conclusive: attempt.conclusive,
          chainPosition: index,
          detail: attempt.detail as never,
        },
      })
    )
  );

  const classification = classifyEmail({ emailType: email.emailType as unknown as EmailType, latestResult: chainResult.final });
  const isValid = chainResult.final === EmailVerificationResult.VALID;

  await prisma.recruiterEmail.update({
    where: { id: emailId },
    data: {
      classification: classification as never,
      classifiedAt: new Date(),
      // The legacy boolean/source/timestamp fields remain a maintained
      // denormalisation of the latest conclusive result — only overwritten
      // on an actual VALID, never regressed by an inconclusive re-check.
      ...(isValid
        ? { verified: true, verificationSource: chainResult.finalProviderId ?? 'deterministic-dns-ownership', verifiedAt: new Date() }
        : {}),
    },
  });

  if (email.recruiterId) {
    await recruiterIntelligenceService.recomputeReadiness(email.recruiterId);
  }
  if (email.companyId) {
    await companyIntelligenceService.recompute(email.companyId);
  } else if (email.recruiter?.companyId) {
    await companyIntelligenceService.recompute(email.recruiter.companyId);
  }

  logger.info({ emailId, final: chainResult.final, classification }, 'Email verification chain completed');

  return { emailId, final: chainResult.final, attempts: chainResult.attempts.length, classification };
}

export async function listVerifications(emailId: string) {
  return prisma.emailVerification.findMany({ where: { recruiterEmailId: emailId }, orderBy: { chainPosition: 'asc' } });
}

export interface DiscoverEmailsResult {
  candidatesFound: number;
  emailsCreated: number;
  emailsUpdated: number;
  attemptedProviders: string[];
  contactFormUrl?: string;
  reason?: string;
}

// Persists what runDiscoveryChain found: one RecruiterEmail row per unique
// address (RecruiterEmail.email is globally unique — a re-observation
// merges onto the existing row rather than creating a duplicate, §90),
// one EmailSourceObservation per (address, sourceUrl, extractionMethod)
// pair, and a Company.contactFormUrl when a form was found but no usable
// address was. Never itself decides VALID/INVALID — that's a separate
// verifyRecruiterEmail() call, which a human or a follow-up job triggers.
async function persistDiscoveredCandidates(
  candidates: DiscoveredEmailCandidate[],
  companyWebsite: string | null | undefined,
  link: { companyId?: string; recruiterId?: string }
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const domain = extractDomain(candidate.address);
    const ownership = domain ? domainOwnershipMatch(domain, companyWebsite) : 'NO_COMPANY_DOMAIN';
    const domainMatch = ownership === 'OWNED' || ownership === 'SUBDOMAIN';

    const existing = await prisma.recruiterEmail.findUnique({ where: { email: candidate.address } });
    let recruiterEmailId: string;

    if (existing) {
      recruiterEmailId = existing.id;
      updated += 1;
      // Link this discovery to the target entity if the row wasn't
      // already linked to one — never overwrite an existing link (§90:
      // conflicting facts are preserved, not silently reassigned).
      const linkUpdate: { companyId?: string; recruiterId?: string } = {};
      if (link.companyId && !existing.companyId) linkUpdate.companyId = link.companyId;
      if (link.recruiterId && !existing.recruiterId) linkUpdate.recruiterId = link.recruiterId;
      if (Object.keys(linkUpdate).length > 0) {
        await prisma.recruiterEmail.update({ where: { id: recruiterEmailId }, data: linkUpdate });
      }
    } else {
      const createdEmail = await prisma.recruiterEmail.create({
        data: {
          email: candidate.address,
          emailType: candidate.emailType as never,
          companyId: link.companyId,
          recruiterId: link.recruiterId,
        },
      });
      recruiterEmailId = createdEmail.id;
      created += 1;
    }

    try {
      await prisma.emailSourceObservation.create({
        data: {
          recruiterEmailId,
          sourceUrl: candidate.sourceUrl,
          sourceKind: candidate.sourceKind as never,
          observedAt: candidate.observedAt,
          extractionMethod: candidate.extractionMethod,
          pageTitle: candidate.pageTitle,
          contextSnippet: candidate.contextSnippet,
          contentHash: candidate.contentHash,
          domainMatch,
          personName: candidate.personName,
        },
      });
    } catch {
      // @@unique([recruiterEmailId, sourceUrl, extractionMethod]) — a
      // re-observation of the same fact is a no-op merge, not an error.
    }
  }

  return { created, updated };
}

export async function discoverCompanyEmails(companyId: string): Promise<DiscoverEmailsResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new CompanyNotFoundError(`Company ${companyId} not found`);

  const target: DiscoveryTarget = {
    companyId: company.id,
    companyName: company.name,
    companyWebsite: company.website ?? '',
  };

  const chainResult = await runDiscoveryChain(discoveryProviders, target);
  const { created, updated } = await persistDiscoveredCandidates(chainResult.candidates, company.website, { companyId: company.id });

  if (chainResult.contactFormUrl && !company.contactFormUrl) {
    await prisma.company.update({ where: { id: companyId }, data: { contactFormUrl: chainResult.contactFormUrl } });
  }
  if (created > 0 || updated > 0) {
    await companyIntelligenceService.recompute(companyId);
  } else {
    // Discovery ran and found nothing — the outreach state must say so
    // explicitly (NO_USABLE_CONTACT / CONTACT_FORM_AVAILABLE), never
    // silently stay at DISCOVERED as if nothing had been attempted.
    await recomputeOutreachState({
      entityType: 'Company',
      entityId: companyId,
      trigger: 'discovery.exhausted',
      overrides: { discoveryExhausted: true, contactFormUrl: chainResult.contactFormUrl },
    });
  }

  logger.info({ companyId, found: chainResult.candidates.length, created, updated }, 'Company email discovery completed');

  return {
    candidatesFound: chainResult.candidates.length,
    emailsCreated: created,
    emailsUpdated: updated,
    attemptedProviders: chainResult.attemptedProviders,
    contactFormUrl: chainResult.contactFormUrl,
    reason: chainResult.reason,
  };
}

export async function discoverRecruiterEmails(recruiterId: string): Promise<DiscoverEmailsResult> {
  const recruiter = await prisma.recruiter.findUnique({ where: { id: recruiterId }, include: { company: true } });
  if (!recruiter) throw new RecruiterNotFoundError(`Recruiter ${recruiterId} not found`);
  if (!recruiter.company) {
    return { candidatesFound: 0, emailsCreated: 0, emailsUpdated: 0, attemptedProviders: [], reason: 'Recruiter has no linked company — nothing to discover against' };
  }

  const target: DiscoveryTarget = {
    companyId: recruiter.company.id,
    companyName: recruiter.company.name,
    companyWebsite: recruiter.company.website ?? '',
    recruiterId: recruiter.id,
    recruiterName: recruiter.name,
    recruiterProfileUrl: recruiter.publicProfileUrl ?? undefined,
  };

  const chainResult = await runDiscoveryChain(discoveryProviders, target);
  const { created, updated } = await persistDiscoveredCandidates(chainResult.candidates, recruiter.company.website, {
    companyId: recruiter.company.id,
    recruiterId: recruiter.id,
  });

  if (created > 0 || updated > 0) {
    await recruiterIntelligenceService.recomputeReadiness(recruiterId);
  } else {
    await recomputeOutreachState({
      entityType: 'Recruiter',
      entityId: recruiterId,
      trigger: 'discovery.exhausted',
      overrides: { discoveryExhausted: true },
    });
  }

  logger.info({ recruiterId, found: chainResult.candidates.length, created, updated }, 'Recruiter email discovery completed');

  return {
    candidatesFound: chainResult.candidates.length,
    emailsCreated: created,
    emailsUpdated: updated,
    attemptedProviders: chainResult.attemptedProviders,
    contactFormUrl: chainResult.contactFormUrl,
    reason: chainResult.reason,
  };
}
