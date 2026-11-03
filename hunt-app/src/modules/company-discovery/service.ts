import { Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { DiscoveryQuery, DiscoveredCompanyCandidate } from './provider';
import { braveSearchProvider } from './providers/brave-search';
import { findOrCreateCompany } from '../dedup/service';

// §80-adjacent priority list: Brave is the only implemented provider
// today; a future vendor becomes a new file + one entry here, matching
// email-intelligence/registry.ts's precedent.
const providers = [braveSearchProvider];

export async function runDiscovery(query: DiscoveryQuery): Promise<DiscoveredCompanyCandidate[]> {
  const all: DiscoveredCompanyCandidate[] = [];
  for (const provider of providers) {
    if (!provider.implemented) continue;
    const outcome = await provider.discover(query);
    all.push(...outcome.candidates);
  }
  return all;
}

// A search hit is a claim, not a fact (ADR-004) — approving a candidate
// creates/merges a Company via the SAME dedup path real HUNT postings use
// (findOrCreateCompany), then records WHY it was surfaced as an
// append-only entry in provenance.discoveryClaims, never as an asserted
// fact like a verified partner status. outreachState stays DISCOVERED
// (set by the Company default) — nothing here jumps ahead in the pipeline.
export async function approveDiscoveryCandidate(candidate: DiscoveredCompanyCandidate, mode: DiscoveryQuery['mode'], vendorOrRegion: string): Promise<string> {
  const companyId = await findOrCreateCompany({
    companyName: candidate.name,
    companyWebsite: candidate.website,
    source: 'company-discovery:brave-search',
  });

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const provenance = (company.provenance as { discoveryClaims?: unknown[] } | null) ?? {};
  const discoveryClaims = Array.isArray(provenance.discoveryClaims) ? provenance.discoveryClaims : [];

  await prisma.company.update({
    where: { id: companyId },
    data: {
      provenance: {
        ...(company.provenance as object),
        discoveryClaims: [
          ...discoveryClaims,
          { mode, vendorOrRegion, searchQuery: candidate.searchQuery, snippet: candidate.snippet, sourceUrl: candidate.sourceUrl, approvedAt: new Date().toISOString() },
        ],
      } as Prisma.InputJsonValue,
    },
  });

  logger.info({ companyId, mode, vendorOrRegion, sourceUrl: candidate.sourceUrl }, 'Discovery candidate approved into a Company record');
  return companyId;
}
