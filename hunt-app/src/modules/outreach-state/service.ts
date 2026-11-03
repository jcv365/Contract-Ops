import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { EmailType, EmailClassification, DraftStatus, OutreachState } from '../../domain/types';
import { deriveOutreachState, transition, ContactFacts } from './machine';
import { selectBestEmail } from '../recruiter-intelligence/readiness';
import { suppressionService } from '../suppression/service';

async function buildRecruiterFacts(recruiterId: string): Promise<ContactFacts> {
  const recruiter = await prisma.recruiter.findUniqueOrThrow({ where: { id: recruiterId }, include: { emails: true } });
  const suppression = await suppressionService.checkAny(recruiter.emails.map((e) => e.email));
  const bestEmail = selectBestEmail(
    recruiter.emails.map((e) => ({
      emailType: e.emailType as unknown as EmailType,
      verified: e.verified,
      verificationSource: e.verificationSource,
      verifiedAt: e.verifiedAt,
      classification: e.classification as unknown as EmailClassification,
    }))
  );
  const latestDraft = await prisma.outreachDraft.findFirst({ where: { recruiterId }, orderBy: { createdAt: 'desc' } });
  const hasOpenFollowUp = (await prisma.followUp.count({ where: { targetId: recruiterId, status: { in: ['PENDING', 'DRAFTED', 'APPROVED'] } } })) > 0;
  const hasReply = (await prisma.reply.count({ where: { thread: { linkedRecruiterId: recruiterId } } })) > 0;

  return {
    suppressed: suppression.suppressed,
    hasContact: true, // a Recruiter row existing means a person/role has been identified
    bestEmailClassification: bestEmail?.classification,
    hasAnyEmail: recruiter.emails.length > 0,
    readinessReady: (recruiter.outreachReadiness as unknown as string) === 'EMAIL_READY',
    discoveryExhausted: false, // only the discovery service itself knows this — see the override param below
    latestDraftStatus: latestDraft?.status as unknown as DraftStatus | undefined,
    hasReply,
    hasOpenFollowUp,
  };
}

async function buildCompanyFacts(companyId: string): Promise<ContactFacts> {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { emails: true } });
  const suppression = await suppressionService.checkAny(company.emails.map((e) => e.email));
  const bestEmail = selectBestEmail(
    company.emails.map((e) => ({
      emailType: e.emailType as unknown as EmailType,
      verified: e.verified,
      verificationSource: e.verificationSource,
      verifiedAt: e.verifiedAt,
      classification: e.classification as unknown as EmailClassification,
    }))
  );
  const latestDraft = await prisma.outreachDraft.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  const hasOpenFollowUp = (await prisma.followUp.count({ where: { targetId: companyId, status: { in: ['PENDING', 'DRAFTED', 'APPROVED'] } } })) > 0;
  const hasReply = (await prisma.reply.count({ where: { thread: { linkedCompanyId: companyId } } })) > 0;

  return {
    suppressed: suppression.suppressed,
    hasContact: company.type != null,
    bestEmailClassification: bestEmail?.classification,
    hasAnyEmail: company.emails.length > 0,
    readinessReady: (company.outreachReadiness as unknown as string) === 'OUTREACH_READY',
    contactFormUrl: company.contactFormUrl ?? undefined,
    discoveryExhausted: false,
    latestDraftStatus: latestDraft?.status as unknown as DraftStatus | undefined,
    hasReply,
    hasOpenFollowUp,
  };
}

export interface RecomputeOutreachStateInput {
  entityType: 'Recruiter' | 'Company';
  entityId: string;
  trigger: string;
  // The caller may know something the generic fact-builders above can't
  // see (e.g. email-intelligence/service.ts knows a discovery attempt just
  // returned zero candidates) — merged over the built facts.
  overrides?: Partial<ContactFacts>;
}

// The Prisma-touching orchestration behind machine.ts's pure
// deriveOutreachState/transition: builds real facts, refuses a transition
// SUPPRESSED forbids, and only writes (Recruiter/Company + an append-only
// OutreachStateEvent) when the state actually changed.
export async function recomputeOutreachState(input: RecomputeOutreachStateInput): Promise<void> {
  const facts = input.entityType === 'Recruiter' ? await buildRecruiterFacts(input.entityId) : await buildCompanyFacts(input.entityId);
  const mergedFacts: ContactFacts = { ...facts, ...input.overrides };

  const currentRow =
    input.entityType === 'Recruiter'
      ? await prisma.recruiter.findUniqueOrThrow({ where: { id: input.entityId }, select: { outreachState: true } })
      : await prisma.company.findUniqueOrThrow({ where: { id: input.entityId }, select: { outreachState: true } });
  const current = currentRow.outreachState as unknown as OutreachState;

  const derived = deriveOutreachState(mergedFacts);
  const check = transition(current, derived.state, input.trigger);
  const finalState = check.ok ? derived.state : current;

  if (finalState === current) return;

  await prisma.outreachStateEvent.create({
    data: { entityType: input.entityType, entityId: input.entityId, fromState: current as never, toState: finalState as never, trigger: input.trigger, reason: derived.reason },
  });

  if (input.entityType === 'Recruiter') {
    await prisma.recruiter.update({ where: { id: input.entityId }, data: { outreachState: finalState as never, outreachStateReason: derived.reason, outreachStateAt: new Date() } });
  } else {
    await prisma.company.update({ where: { id: input.entityId }, data: { outreachState: finalState as never, outreachStateReason: derived.reason, outreachStateAt: new Date() } });
  }

  logger.info({ entityType: input.entityType, entityId: input.entityId, from: current, to: finalState, trigger: input.trigger }, 'Outreach state transitioned');
}
