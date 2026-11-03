import { DraftStatus, EvidenceState as PrismaEvidenceState, ValidationCheckResult, AttachmentKind } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { AiTransport, getAiTransport } from '../ai/transport';
import { wrapUntrustedContent } from '../ai/untrusted-content';
import { parseStructuredResponse, AiValidationError } from '../ai/structured-output';
import { loadPrompt, ensurePromptTemplateRecorded } from '../ai/prompt-loader';
import { researchFindingsSchema, draftOutputSchema, reviewOutputSchema, ResearchFindings } from './schemas';
import { checkWordCount } from './word-count';
import { findHallucinatedEvidenceIds, evaluateDuplicateContact } from './evidence-check';
import { TargetType, GreetingMode } from '../../domain/types';
import { latestAttachmentByKind } from '../attachments/service';

export class BidopsError extends Error {}

export interface ResearchInput {
  recruiterId: string;
  contextText: string;
  contextSource: string;
}

// Advisory only — never writes directly into the Recruiter row. Findings
// are returned to the caller, who applies whatever they judge correct
// through the normal recruiter-update path. This keeps free-text AI
// output out of the database write path entirely (docs-pack/docs/24:
// "deterministic code controls ... permissions"), and never lets the AI
// propose an email address (ADR-003) — researchFindingsSchema has no email
// field at all.
export async function research(input: ResearchInput, transport: AiTransport = getAiTransport()): Promise<ResearchFindings> {
  const recruiter = await prisma.recruiter.findUniqueOrThrow({ where: { id: input.recruiterId } });
  const prompt = loadPrompt('recruiter-research');
  await ensurePromptTemplateRecorded(prompt);

  const userMessage = [
    `Recruiter on file: ${recruiter.name}${recruiter.title ? `, ${recruiter.title}` : ''}.`,
    wrapUntrustedContent(input.contextSource, input.contextText),
    'Return ONLY JSON matching: {"findings":[{"claim":string,"state":"SOURCE_REPORTED"|"INFERRED"|"UNKNOWN","evidenceQuote":string}],"recommendedOutreachAngle":string,"missingInformation":string[]}. Never include an email address in your response.',
  ].join('\n\n');

  const completion = await transport.complete([
    { role: 'system', content: prompt.content },
    { role: 'user', content: userMessage },
  ]);

  const findings = parseStructuredResponse(researchFindingsSchema, completion.content);

  await prisma.auditEvent.create({
    data: {
      actor: 'system',
      action: 'bidops.research',
      entityType: 'Recruiter',
      entityId: input.recruiterId,
      metadata: { promptVersion: prompt.version, model: completion.model, provider: completion.provider, findingCount: findings.findings.length },
    },
  });

  return findings;
}

export interface DraftInput {
  targetType: TargetType;
  recruiterId?: string;
  companyId?: string;
  opportunityId?: string;
  profileId: string;
  recipientEmail: string;
  greetingMode: GreetingMode; // supplied by the caller from the readiness gate (modules/recruiter-intelligence / company-intelligence) — draft() does not re-derive it, to avoid two sources of truth
}

// Builds the "who am I writing to" context block. Audit finding (this
// session): draftOutreach() previously never dereferenced recruiterId/
// companyId/opportunityId at all — the model was drafting completely
// blind to who it was actually writing to. Returns a plain string, not
// structured data, since it only ever becomes prompt text.
async function buildTargetContext(input: DraftInput): Promise<string> {
  const lines: string[] = [];
  if (input.recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { id: input.recruiterId }, include: { company: true } });
    if (recruiter) {
      lines.push(`Recruiter: ${recruiter.name}${recruiter.title ? `, ${recruiter.title}` : ''}${recruiter.company ? ` at ${recruiter.company.name}` : ''}.`);
      if (recruiter.specialisms.length > 0) lines.push(`Recruiter specialisms: ${recruiter.specialisms.join(', ')}.`);
    }
  }
  if (input.companyId) {
    const company = await prisma.company.findUnique({ where: { id: input.companyId } });
    if (company) {
      lines.push(`Company: ${company.name}${company.type ? ` (${company.type})` : ''}.`);
      if (company.specialisms.length > 0) lines.push(`Company specialisms: ${company.specialisms.join(', ')}.`);
      const provenance = company.provenance as { targetingReason?: string; proposition?: string } | null;
      if (provenance?.targetingReason) lines.push(`Why this is a target: ${provenance.targetingReason}.`);
      if (provenance?.proposition) lines.push(`Proposition to lead with: ${provenance.proposition}.`);
    }
  }
  if (input.opportunityId) {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: input.opportunityId } });
    if (opportunity) {
      lines.push(`Opportunity: "${opportunity.title}"${opportunity.location ? ` (${opportunity.location})` : ''}.`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : 'No further recruiter/company/opportunity context is on file.';
}

// Fails closed (throws BidopsError) rather than creating a draft with
// hallucinated evidence: any evidenceId the model returns that wasn't in
// the citable set actually supplied is treated as a fabricated citation.
export async function draftOutreach(input: DraftInput, transport: AiTransport = getAiTransport()) {
  const [citableEvidence, profile, targetContext] = await Promise.all([
    prisma.evidence.findMany({
      where: { profileId: input.profileId, state: { in: [PrismaEvidenceState.VERIFIED, PrismaEvidenceState.SOURCE_REPORTED] } },
    }),
    prisma.profile.findUnique({ where: { id: input.profileId } }),
    buildTargetContext(input),
  ]);

  if (citableEvidence.length === 0) {
    throw new BidopsError(
      'No citable evidence exists for this profile (state VERIFIED or SOURCE_REPORTED) — BIDOPS cannot draft an evidence-backed email with nothing approved to cite (ADR-004)'
    );
  }

  const prompt = loadPrompt('email-generation');
  await ensurePromptTemplateRecorded(prompt);

  // Audit finding: previously the ONLY thing sent to the model was the
  // evidence list — no Profile (headline/summary/skills/domains), no
  // recruiter/company/opportunity context. Four of the six inputs
  // docs-pack/prompts/email-generation.md itself declares were never
  // populated. This is what actually makes a draft "positioned" rather
  // than a generic evidence quote.
  const profileSummary = profile
    ? [
        profile.headline ? `Headline: ${profile.headline}.` : null,
        profile.summary ? `Summary: ${profile.summary}.` : null,
        profile.skills.length > 0 ? `Skills: ${profile.skills.join(', ')}.` : null,
        profile.domains.length > 0 ? `Domains: ${profile.domains.join(', ')}.` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : null;

  const evidenceList = citableEvidence.map((e) => `[${e.id}] ${e.claim} (source: ${e.source})`).join('\n');
  const userMessage = [
    `Target type: ${input.targetType}. Greeting mode: ${input.greetingMode} (already determined by deterministic code, per ADR-003 — do not address by name unless FIRST_NAME, and do not propose a different greeting).`,
    `About the candidate:\n${profileSummary ?? 'No profile headline/summary/skills recorded yet.'}`,
    `About the recipient:\n${targetContext}`,
    `Available evidence (cite ONLY these IDs, never invent a new one):\n${evidenceList}`,
    'Return ONLY JSON matching: {"subject":string,"body":string,"evidenceIds":string[],"recommendedAttachment":"CV"|"COMPANY_PROFILE"|"BOTH"|"NONE"}. Target 120-180 words for the body.',
  ].join('\n\n');

  const completion = await transport.complete([
    { role: 'system', content: prompt.content },
    { role: 'user', content: userMessage },
  ]);

  const output = parseStructuredResponse(draftOutputSchema, completion.content);

  const citableIds = new Set(citableEvidence.map((e) => e.id));
  const hallucinatedIds = findHallucinatedEvidenceIds(output.evidenceIds, citableIds);
  if (hallucinatedIds.length > 0) {
    throw new AiValidationError(`AI cited evidence IDs that were never supplied: ${hallucinatedIds.join(', ')}`);
  }

  const wordCheck = checkWordCount(output.body);
  if (!wordCheck.withinHardBounds) {
    throw new AiValidationError(`Draft body word count (${wordCheck.count}) is outside the sane bound — refusing to create a draft from it`);
  }

  // Audit finding: output.recommendedAttachment was parsed and then
  // silently discarded — no DraftAttachment row was ever created from it.
  // Resolves to the most recent real Attachment of the requested kind(s)
  // for this profile's owner; a kind with nothing uploaded yet is simply
  // omitted rather than failing the whole draft (docs/16: attachments are
  // shown and can be adjusted before approval, not a hard blocker here).
  const attachmentKinds: AttachmentKind[] =
    output.recommendedAttachment === 'BOTH'
      ? [AttachmentKind.CV, AttachmentKind.COMPANY_PROFILE]
      : output.recommendedAttachment === 'NONE'
        ? []
        : [AttachmentKind[output.recommendedAttachment]];

  const ownerId = profile?.userId ?? 'default-user';
  const resolvedAttachments = (
    await Promise.all(attachmentKinds.map((kind) => latestAttachmentByKind(ownerId, kind)))
  ).filter((a): a is NonNullable<typeof a> => a != null);

  const draft = await prisma.outreachDraft.create({
    data: {
      targetType: input.targetType,
      targetId: input.recruiterId ?? input.companyId ?? input.opportunityId ?? '',
      recruiterId: input.recruiterId,
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      recipientEmail: input.recipientEmail,
      greetingMode: input.greetingMode,
      subject: output.subject,
      body: output.body,
      promptVersion: prompt.version,
      status: DraftStatus.DRAFT,
      draftEvidence: { create: output.evidenceIds.map((evidenceId) => ({ evidenceId })) },
      draftAttachments: { create: resolvedAttachments.map((a) => ({ attachmentId: a.id })) },
    },
  });

  if (attachmentKinds.length > 0 && resolvedAttachments.length < attachmentKinds.length) {
    logger.warn(
      { draftId: draft.id, recommended: output.recommendedAttachment, resolved: resolvedAttachments.map((a) => a.kind) },
      'BIDOPS recommended an attachment kind with nothing uploaded yet for this profile — draft created without it'
    );
  }

  logger.info({ draftId: draft.id, wordCount: wordCheck.count, attachmentCount: resolvedAttachments.length }, 'Outreach draft created');
  return draft;
}

// Runs the deterministic checks this build CAN verify mechanically, plus
// the two AI-driven prompt checks (email-review's 14 checks,
// hallucination-check). A FAIL on any check blocks DRAFT -> VALIDATED.
// Nothing here silently rewrites the draft — per prompts/email-review.md,
// issues are reported for a human/BIDOPS caller to act on.
export async function reviewDraft(draftId: string, transport: AiTransport = getAiTransport()) {
  const draft = await prisma.outreachDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { draftEvidence: { include: { evidence: true } } },
  });

  const checks: Array<{ checkName: string; result: ValidationCheckResult; issues: string[] }> = [];

  const wordCheck = checkWordCount(draft.body);
  checks.push({
    checkName: 'deterministic-length',
    result: wordCheck.withinHardBounds ? ValidationCheckResult.PASS : ValidationCheckResult.FAIL,
    issues: wordCheck.withinHardBounds ? [] : [`Word count ${wordCheck.count} outside sane bounds`],
  });

  const unciteableEvidence = draft.draftEvidence.filter(
    (de) => de.evidence.state !== 'VERIFIED' && de.evidence.state !== 'SOURCE_REPORTED'
  );
  checks.push({
    checkName: 'deterministic-evidence-citability',
    result: unciteableEvidence.length === 0 ? ValidationCheckResult.PASS : ValidationCheckResult.FAIL,
    issues: unciteableEvidence.map((de) => `Evidence ${de.evidenceId} is state ${de.evidence.state}, not citable as fact`),
  });

  const duplicateRecent = await prisma.outreachDraft.findFirst({
    where: {
      recipientEmail: draft.recipientEmail,
      status: DraftStatus.SENT,
      id: { not: draft.id },
    },
  });
  const duplicateCheck = evaluateDuplicateContact(draft.recipientEmail, duplicateRecent?.id ?? null);
  checks.push({
    checkName: 'deterministic-duplicate-contact',
    result: ValidationCheckResult[duplicateCheck.result],
    issues: duplicateCheck.issues,
  });

  for (const [checkName, promptName] of [
    ['ai-email-review', 'email-review'],
    ['ai-hallucination-check', 'hallucination-check'],
  ] as const) {
    const prompt = loadPrompt(promptName);
    await ensurePromptTemplateRecorded(prompt);
    try {
      const completion = await transport.complete([
        { role: 'system', content: prompt.content },
        {
          role: 'user',
          content: `Review this draft. Subject: ${draft.subject}\nBody:\n${draft.body}\n\nReturn ONLY JSON matching: {"result":"PASS"|"FAIL","issues":string[]}.`,
        },
      ]);
      const output = parseStructuredResponse(reviewOutputSchema, completion.content);
      checks.push({ checkName, result: ValidationCheckResult[output.result], issues: output.issues });
    } catch (err) {
      // docs-pack/docs/24: model failure fails closed — an AI check that
      // errors is recorded as FAIL, never silently skipped.
      checks.push({ checkName, result: ValidationCheckResult.FAIL, issues: [err instanceof Error ? err.message : 'AI check failed'] });
    }
  }

  await prisma.$transaction(
    checks.map((c) =>
      prisma.draftValidation.create({
        data: { draftId: draft.id, checkName: c.checkName, result: c.result, issues: c.issues },
      })
    )
  );

  const allPassed = checks.every((c) => c.result === ValidationCheckResult.PASS);
  if (allPassed) {
    await prisma.outreachDraft.update({ where: { id: draft.id }, data: { status: DraftStatus.VALIDATED } });
  }

  logger.info({ draftId: draft.id, allPassed, checks: checks.map((c) => c.checkName) }, 'Draft reviewed');
  return { allPassed, checks };
}
