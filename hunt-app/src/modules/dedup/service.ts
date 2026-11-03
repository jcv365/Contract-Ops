import { Prisma, ConflictStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { planMerge, ExistingRecord, IncomingRecord, ConflictEntry } from './identity';
import { registrableDomain } from '../email-intelligence/domain';

// §90: "Do not create another recruiter record simply because the source
// differs. Merge evidence while retaining all source references." This is
// the Prisma-touching orchestration behind identity.ts's pure planMerge —
// used both by normalisation (wiring RawOpportunity.companyName/
// recruiterName into real Company/Recruiter rows for the first time) and
// by anything else that discovers a company/recruiter from a new source.

async function recordClaimConflict(entityType: string, entityId: string, conflict: ConflictEntry): Promise<void> {
  const existingConflict = await prisma.claimConflict.findFirst({
    where: { entityType, entityId, field: conflict.field, status: ConflictStatus.OPEN },
  });
  const incomingValue = { value: conflict.incoming, source: conflict.incomingSource, retrievedAt: new Date().toISOString() };

  if (existingConflict) {
    const values = existingConflict.values as unknown as Array<{ value: unknown }>;
    const alreadyRecorded = values.some((v) => JSON.stringify(v.value) === JSON.stringify(conflict.incoming));
    if (!alreadyRecorded) {
      await prisma.claimConflict.update({ where: { id: existingConflict.id }, data: { values: [...values, incomingValue] as unknown as Prisma.InputJsonValue } });
    }
    return;
  }

  const existingValue = { value: conflict.existing, source: conflict.existingSource, retrievedAt: new Date().toISOString() };
  await prisma.claimConflict.create({
    data: { entityType, entityId, field: conflict.field, values: [existingValue, incomingValue] as unknown as Prisma.InputJsonValue, status: ConflictStatus.OPEN },
  });
  logger.warn({ entityType, entityId, field: conflict.field }, 'Claim conflict recorded during dedup merge');
}

async function findExistingCompanyByWebsite(website: string) {
  let host: string;
  try {
    host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
  const domain = registrableDomain(host);
  const candidates = await prisma.company.findMany({ where: { website: { not: null } }, select: { id: true, name: true, website: true } });
  return (
    candidates.find((c) => {
      if (!c.website) return false;
      try {
        return registrableDomain(new URL(c.website.startsWith('http') ? c.website : `https://${c.website}`).hostname) === domain;
      } catch {
        return false;
      }
    }) ?? null
  );
}

export interface LinkCompanyInput {
  companyName: string;
  companyWebsite?: string;
  source: string;
}

// Strong match on registrable domain when a website is present (§90's
// strongest identity signal); falls back to a case-insensitive exact name
// match. A differing website on an exact-name match becomes a conflict,
// never a silent overwrite.
export async function findOrCreateCompany(input: LinkCompanyInput): Promise<string> {
  const existing =
    (input.companyWebsite ? await findExistingCompanyByWebsite(input.companyWebsite) : null) ??
    (await prisma.company.findFirst({ where: { name: { equals: input.companyName, mode: 'insensitive' } }, select: { id: true, name: true, website: true } }));

  const existingRecord: ExistingRecord | null = existing ? { id: existing.id, fields: { name: existing.name, website: existing.website }, source: 'existing-record' } : null;
  const incoming: IncomingRecord = { fields: { name: input.companyName, website: input.companyWebsite }, source: input.source };
  const plan = planMerge(existingRecord, incoming);

  if (plan.action === 'CREATE') {
    const created = await prisma.company.create({
      data: { name: input.companyName, website: input.companyWebsite, provenance: { source: input.source, discoveredAt: new Date().toISOString() } },
    });
    logger.info({ companyId: created.id, source: input.source }, 'Company created via dedup');
    return created.id;
  }

  for (const conflict of plan.conflicts) await recordClaimConflict('Company', plan.targetId!, conflict);
  if (Object.keys(plan.fieldUpdates).length > 0) {
    await prisma.company.update({ where: { id: plan.targetId! }, data: plan.fieldUpdates as Prisma.CompanyUpdateInput });
  }
  return plan.targetId!;
}

export interface LinkRecruiterInput {
  recruiterName: string;
  recruiterProfileUrl?: string;
  companyId?: string;
  source: string;
}

export async function findOrCreateRecruiter(input: LinkRecruiterInput): Promise<string> {
  const existing =
    (input.recruiterProfileUrl
      ? await prisma.recruiter.findFirst({ where: { publicProfileUrl: input.recruiterProfileUrl }, select: { id: true, name: true, publicProfileUrl: true, companyId: true } })
      : null) ??
    (await prisma.recruiter.findFirst({
      where: { name: { equals: input.recruiterName, mode: 'insensitive' }, companyId: input.companyId ?? undefined },
      select: { id: true, name: true, publicProfileUrl: true, companyId: true },
    }));

  const existingRecord: ExistingRecord | null = existing
    ? { id: existing.id, fields: { name: existing.name, publicProfileUrl: existing.publicProfileUrl, companyId: existing.companyId }, source: 'existing-record' }
    : null;
  const incoming: IncomingRecord = { fields: { name: input.recruiterName, publicProfileUrl: input.recruiterProfileUrl, companyId: input.companyId }, source: input.source };
  const plan = planMerge(existingRecord, incoming);

  if (plan.action === 'CREATE') {
    const created = await prisma.recruiter.create({ data: { name: input.recruiterName, publicProfileUrl: input.recruiterProfileUrl, companyId: input.companyId } });
    logger.info({ recruiterId: created.id, source: input.source }, 'Recruiter created via dedup');
    return created.id;
  }

  for (const conflict of plan.conflicts) await recordClaimConflict('Recruiter', plan.targetId!, conflict);
  if (Object.keys(plan.fieldUpdates).length > 0) {
    await prisma.recruiter.update({ where: { id: plan.targetId! }, data: plan.fieldUpdates as Prisma.RecruiterUpdateInput });
  }
  return plan.targetId!;
}
