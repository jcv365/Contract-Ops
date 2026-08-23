import crypto from 'node:crypto';
import { Prisma, Source as PrismaSource, ConflictStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { RawOpportunity } from '../source-adapters/base';
import { detectConflict, CONFLICT_TRACKED_FIELDS, ConflictCandidate } from './conflict';

function normaliseText(value?: string): string {
  return (value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Cross-source dedup key: same title + company + location clusters
// regardless of which source found it. This is deliberately coarse — two
// genuinely different roles that happen to share these three fields will
// over-cluster, but the alternative (fuzzy matching) risks silently
// merging two distinct opportunities, which is worse. Rule 4/doc 02: keep
// it simple and correct over clever and wrong.
export function computeFingerprint(raw: RawOpportunity): string {
  const key = [normaliseText(raw.title), normaliseText(raw.companyName), normaliseText(raw.location)].join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}

export interface NormaliseResult {
  opportunityId: string;
  created: boolean;
}

// docs-pack/docs/27: when two sources describing the same clustered
// opportunity disagree on a tracked field, preserve both values (never
// silently prefer one) and mark it CONFLICTED. Idempotent across repeated
// hunt runs — an already-recorded value pair is not duplicated, only a
// genuinely new disagreement appends to the existing OPEN conflict.
async function recordFieldConflicts(
  clusterId: string,
  incomingSourceId: string,
  incoming: Record<string, unknown>,
  other: { sourceId: string; url: string } & Record<string, unknown>
): Promise<void> {
  for (const field of CONFLICT_TRACKED_FIELDS) {
    const incomingCandidate: ConflictCandidate = {
      value: incoming[field],
      source: incomingSourceId,
      retrievedAt: new Date().toISOString(),
    };
    const otherCandidate: ConflictCandidate = {
      value: other[field],
      source: other.sourceId,
      sourceUrl: other.url,
      retrievedAt: new Date().toISOString(),
    };

    if (!detectConflict(otherCandidate, incomingCandidate)) continue;

    const existingConflict = await prisma.claimConflict.findFirst({
      where: { entityType: 'OpportunityCluster', entityId: clusterId, field, status: ConflictStatus.OPEN },
    });

    if (existingConflict) {
      const values = existingConflict.values as unknown as ConflictCandidate[];
      const alreadyRecorded = values.some((v) => JSON.stringify(v.value) === JSON.stringify(incomingCandidate.value));
      if (!alreadyRecorded) {
        await prisma.claimConflict.update({
          where: { id: existingConflict.id },
          data: { values: [...values, incomingCandidate] as unknown as Prisma.InputJsonValue },
        });
      }
    } else {
      await prisma.claimConflict.create({
        data: {
          entityType: 'OpportunityCluster',
          entityId: clusterId,
          field,
          values: [otherCandidate, incomingCandidate] as unknown as Prisma.InputJsonValue,
          status: ConflictStatus.OPEN,
        },
      });
      logger.warn({ clusterId, field }, 'Claim conflict recorded between sources');
    }
  }
}

// Upserts a RawOpportunity into the canonical Opportunity table for a
// given (already-persisted) Source row, and assigns it to a cross-source
// OpportunityCluster by fingerprint. This is the layer the original
// scaffold's BaseSourceAdapter.mapToCanonical tried to be, but couldn't —
// it never had access to the real Source DB row, only the adapter's own
// slug.
export async function normaliseOpportunity(
  source: PrismaSource,
  raw: RawOpportunity
): Promise<NormaliseResult> {
  const fingerprint = computeFingerprint(raw);

  let cluster = await prisma.opportunityCluster.findFirst({ where: { fingerprint } });
  if (!cluster) {
    cluster = await prisma.opportunityCluster.create({ data: { fingerprint } });
  } else {
    // Another source may have already contributed a member to this
    // cluster — compare tracked fields against it before this record is
    // written, so a genuine disagreement is preserved rather than the
    // newer write silently overwriting the older one's version of events.
    const otherMember = await prisma.opportunity.findFirst({
      where: { clusterId: cluster.id, sourceId: { not: source.id } },
    });
    if (otherMember) {
      const otherSourceSlug = (otherMember.provenance as { sourceId?: string } | null)?.sourceId ?? otherMember.sourceId;
      await recordFieldConflicts(cluster.id, source.sourceId, raw as unknown as Record<string, unknown>, {
        sourceId: otherSourceSlug,
        url: otherMember.url,
        originalRate: otherMember.originalRate,
        originalCurrency: otherMember.originalCurrency,
        remotePolicy: otherMember.remotePolicy,
        contractType: otherMember.contractType,
      });
    }
  }

  const existing = await prisma.opportunity.findUnique({
    where: { sourceId_externalId: { sourceId: source.id, externalId: raw.externalId } },
  });

  const data = {
    title: raw.title,
    url: raw.url,
    postedAt: raw.postedAt,
    contractType: raw.contractType,
    duration: raw.duration,
    remotePolicy: raw.remotePolicy,
    location: raw.location,
    language: raw.language,
    clearance: raw.clearance,
    workAuthorisation: raw.workAuthorisation,
    originalRate: raw.originalRate,
    originalCurrency: raw.originalCurrency,
    ratePeriod: raw.ratePeriod,
    rateSource: raw.rateSource,
    clusterId: cluster.id,
    provenance: {
      sourceId: source.sourceId,
      sourceDbId: source.id,
      rawData: raw.rawData as Prisma.InputJsonValue,
      normalisedAt: new Date().toISOString(),
    } satisfies Prisma.InputJsonValue,
  };

  if (existing) {
    const updated = await prisma.opportunity.update({ where: { id: existing.id }, data });
    return { opportunityId: updated.id, created: false };
  }

  const created = await prisma.opportunity.create({
    data: {
      ...data,
      sourceId: source.id,
      externalId: raw.externalId,
    },
  });

  if (!cluster.canonicalOpportunityId) {
    await prisma.opportunityCluster.update({
      where: { id: cluster.id },
      data: { canonicalOpportunityId: created.id },
    });
  }

  logger.info({ opportunityId: created.id, sourceId: source.sourceId }, 'Opportunity normalised');
  return { opportunityId: created.id, created: true };
}
