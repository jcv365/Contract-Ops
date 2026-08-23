import { ReplyClassification, SourceType, AdapterStatus, Actionability, OpportunityStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { AiTransport, getAiTransport } from '../ai/transport';
import { wrapUntrustedContent } from '../ai/untrusted-content';
import { parseStructuredResponse } from '../ai/structured-output';
import { loadPrompt, ensurePromptTemplateRecorded } from '../ai/prompt-loader';
import { classificationOutputSchema, extractionOutputSchema } from './schemas';
import { isPromotableClassification } from './promotion';
import { mapExtractionToOpportunityFields } from './mapping';

export class ReplyIntelligenceError extends Error {}

function assertReplyIngestionEnabled(): void {
  if (!env.ENABLE_REPLY_INGESTION) {
    throw new ReplyIntelligenceError('ENABLE_REPLY_INGESTION is false — reply intelligence is disabled (rule 5/doc 09: Mail.Read only when explicitly enabled)');
  }
}

export interface IngestReplyInput {
  providerThreadId: string;
  graphMessageId: string;
  participants: unknown[];
  receivedAt: Date;
  linkedRecruiterId?: string;
  linkedCompanyId?: string;
  linkedOpportunityId?: string;
}

// This is a manual/API ingestion path, not a live Graph mailbox poller —
// building the actual Mail.Read subscription requires the same Entra app
// registration Sprint 4's Graph send is blocked on. Structurally this is
// where a webhook or polling job would call in once that exists.
export async function ingestReply(input: IngestReplyInput) {
  assertReplyIngestionEnabled();

  let thread = await prisma.emailThread.findUnique({ where: { providerThreadId: input.providerThreadId } });
  if (!thread) {
    thread = await prisma.emailThread.create({
      data: {
        providerThreadId: input.providerThreadId,
        participants: input.participants as never,
        linkedRecruiterId: input.linkedRecruiterId,
        linkedCompanyId: input.linkedCompanyId,
        linkedOpportunityId: input.linkedOpportunityId,
      },
    });
  }

  const reply = await prisma.reply.create({
    data: {
      threadId: thread.id,
      graphMessageId: input.graphMessageId,
      receivedAt: input.receivedAt,
      classification: ReplyClassification.UNKNOWN,
    },
  });

  logger.info({ replyId: reply.id, threadId: thread.id }, 'Reply ingested');
  return reply;
}

export async function classifyReply(replyId: string, bodyText: string, transport: AiTransport = getAiTransport()) {
  assertReplyIngestionEnabled();
  const prompt = loadPrompt('reply-classification');
  await ensurePromptTemplateRecorded(prompt);

  const completion = await transport.complete([
    { role: 'system', content: prompt.content },
    {
      role: 'user',
      content: [
        wrapUntrustedContent('inbound-email', bodyText),
        'Return ONLY JSON matching: {"classification":"INTERESTED"|"OPPORTUNITY"|"REQUEST_CV"|"REQUEST_PROFILE"|"REQUEST_RATE"|"REQUEST_CALL"|"NOT_SUITABLE"|"FUTURE_OPPORTUNITY"|"OUT_OF_OFFICE"|"REJECTED"|"DO_NOT_CONTACT"|"UNKNOWN","confidence":number}.',
      ].join('\n\n'),
    },
  ]);

  // parseStructuredResponse throws (fails closed) on malformed/mismatched
  // output — deliberately NOT caught here, so a genuine classifier failure
  // propagates as an error rather than being recorded as if UNKNOWN were a
  // real assessment of the content.
  const output = parseStructuredResponse(classificationOutputSchema, completion.content);

  const updated = await prisma.reply.update({
    where: { id: replyId },
    data: { classification: output.classification, confidence: output.confidence },
  });

  await prisma.auditEvent.create({
    data: {
      actor: 'system',
      action: 'reply.classify',
      entityType: 'Reply',
      entityId: replyId,
      metadata: { classification: output.classification, confidence: output.confidence, promptVersion: prompt.version },
    },
  });

  return updated;
}

async function getOrCreateEmailReplySource() {
  const existing = await prisma.source.findUnique({ where: { sourceId: 'email-replies' } });
  if (existing) return existing;
  return prisma.source.create({
    data: {
      sourceId: 'email-replies',
      name: 'Email Replies',
      type: SourceType.SOURCE_CATALOGUE,
      adapterStatus: AdapterStatus.ACTIVE,
      notes: 'Synthetic provenance source for opportunities proposed from inbound mailbox replies (docs-pack/docs/10).',
    },
  });
}

// docs-pack/docs/10: "Human review may be required before promoting it to
// an actionable opportunity." The created Opportunity is deliberately left
// at Actionability.REVIEW, never ACTIONABLE — this function proposes, it
// does not decide.
export async function promoteReplyToOpportunity(replyId: string, bodyText: string, transport: AiTransport = getAiTransport()) {
  assertReplyIngestionEnabled();
  const reply = await prisma.reply.findUniqueOrThrow({ where: { id: replyId }, include: { thread: true } });

  if (!isPromotableClassification(reply.classification)) {
    throw new ReplyIntelligenceError(`Reply ${replyId} is classified ${reply.classification}, which is never promoted to an opportunity`);
  }

  const prompt = loadPrompt('opportunity-extraction');
  await ensurePromptTemplateRecorded(prompt);

  const completion = await transport.complete([
    { role: 'system', content: prompt.content },
    {
      role: 'user',
      content: [
        wrapUntrustedContent('inbound-email', bodyText),
        'Return ONLY JSON matching the extraction schema. Use null for anything not stated. Never guess a value.',
      ].join('\n\n'),
    },
  ]);

  const extraction = parseStructuredResponse(extractionOutputSchema, completion.content);
  const mapped = mapExtractionToOpportunityFields(extraction);

  const source = await getOrCreateEmailReplySource();

  const opportunity = await prisma.opportunity.create({
    data: {
      sourceId: source.id,
      externalId: reply.id,
      url: `graph-message:${reply.graphMessageId}`,
      title: mapped.title ?? 'Opportunity proposed from email reply (title not confidently extracted)',
      location: mapped.location,
      remotePolicy: mapped.remotePolicy,
      originalRate: mapped.originalRate,
      originalCurrency: mapped.originalCurrency,
      rateSource: mapped.originalRate ? 'email-reply-extraction' : undefined,
      companyId: reply.thread.linkedCompanyId,
      recruiterId: reply.thread.linkedRecruiterId,
      status: OpportunityStatus.DISCOVERED,
      actionability: Actionability.REVIEW,
      actionabilityReason: 'Proposed from an email reply — requires human review before becoming actionable (doc 10)',
      gaps: mapped.gaps,
      provenance: {
        source: 'email-reply',
        replyId: reply.id,
        threadId: reply.threadId,
        graphMessageId: reply.graphMessageId,
        receivedAt: reply.receivedAt.toISOString(),
        rawExtraction: extraction as unknown as object,
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actor: 'system',
      action: 'reply.promote_to_opportunity',
      entityType: 'Opportunity',
      entityId: opportunity.id,
      metadata: { replyId, promptVersion: prompt.version },
    },
  });

  logger.info({ replyId, opportunityId: opportunity.id }, 'Reply promoted to proposed opportunity');
  return opportunity;
}
