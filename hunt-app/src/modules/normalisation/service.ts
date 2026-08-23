import crypto from 'node:crypto';
import { Prisma, Source as PrismaSource } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { RawOpportunity } from '../source-adapters/base';

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
