import { Prisma } from '@prisma/client';
import { prisma } from './client';
import { logger } from '../config/logger';
import { SourceType, AdapterStatus, CompanyType } from '@prisma/client';

// Sprint 0 decision (see AUDIT-REPORT.md conflict #1): the original seed
// hard-coded a fabricated biography — named certifications, "200+
// applications migrated", "40% cost reduction", a ZAR rate range — none of
// it independently verifiable. docs-pack/docs/01 forbids hard-coding
// unverified biography, and ADR-004 requires every claim trace to
// evidence. This seed carries only configuration (the rule-12 coverage
// matrix and the source registry). Real profile/evidence data is imported
// separately, as UNKNOWN/SOURCE_REPORTED evidence pending verification —
// BIDOPS has nothing to cite until then, which is the correct ADR-004
// behaviour, not a defect.
async function seed() {
  logger.info('Seeding database...');

  const user = await prisma.user.upsert({
    where: { id: 'default-user' },
    update: {},
    create: {
      id: 'default-user',
      settings: {
        // This IS the rule-12 "worldwide coverage matrix" — CLAUDE.md rule
        // 12 forbids reporting worldwide coverage unless this configured
        // matrix was actually searched.
        hunt: {
          countries: ['ZA', 'GB', 'US', 'AU', 'CA', 'DE', 'NL', 'IE', 'AE', 'SG'],
          regions: ['EMEA', 'APAC', 'AMER'],
          contractTypes: ['FREELANCE', 'CONTRACT', 'SOW', 'PROJECT', 'CONSULTING'],
          remoteOnly: true,
          seniority: ['SENIOR', 'PRINCIPAL', 'ARCHITECT', 'LEAD'],
          excludedKeywords: ['PERMANENT', 'ONSITE', 'HYBRID', 'JUNIOR', 'MID'],
          allowedClearanceLevels: ['NONE'],
          requiredSkills: ['AZURE', 'CLOUD', 'ARCHITECTURE', 'INFRASTRUCTURE'],
          preferredSkills: ['FINOPS', 'AI', 'PLATFORM', 'NETWORKING', 'DEVOPS'],
        },
        bidops: {
          defaultTone: 'PROFESSIONAL',
          maxEmailLength: 180,
        },
        outreach: {
          requireApproval: true,
          defaultGreetingMode: 'FIRST_NAME',
        },
      },
    },
  });

  // Profile created empty and unlinked from the placeholder `profileId`
  // string the original scaffold wrote (which never matched any real
  // Profile.id, since it's a generated uuid) — real biography, skills and
  // evidence are imported through the profile-import path (Sprint 3+),
  // never hard-coded here.
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      skills: [],
      certifications: [],
      domains: [],
      projects: [],
      achievements: [],
      contractPreferences: {},
    },
  });

  // Per docs-pack/docs/22 (preferred source order: official API > official
  // RSS > documented endpoint > permitted page access), only Jobicy and
  // JobsCollider are enabled ACTIVE — both have confirmed official feeds.
  // Career-Ops is a reuse *candidate* named in docs/21, not a confirmed
  // live API this build has verified terms for, so it stays PENDING like
  // the rest. "If uncertain, disable the adapter and document the issue."
  const sources: Array<Parameters<typeof prisma.source.create>[0]['data']> = [
    {
      sourceId: 'career-ops',
      name: 'Career-Ops',
      type: SourceType.API,
      url: 'https://api.career-ops.com',
      global: true,
      apiAvailable: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.9,
      contractRelevance: 0.8,
      remoteRelevance: 0.9,
      internationalRelevance: 0.85,
      rateLimit: 1000,
      notes: 'Reuse candidate per docs/21 — terms/licensing not yet independently verified for this deployment.',
    },
    {
      sourceId: 'jobicy',
      name: 'Jobicy',
      type: SourceType.JOB_BOARD,
      url: 'https://jobicy.com/api/v2/remote-jobs',
      global: true,
      apiAvailable: true,
      rssAvailable: true,
      adapterStatus: AdapterStatus.ACTIVE,
      reliabilityScore: 0.85,
      contractRelevance: 0.75,
      remoteRelevance: 0.95,
      internationalRelevance: 0.9,
      termsUrl: 'https://jobicy.com/jobs-rss-feed',
      rateLimit: 60,
      notes: 'Official public API, no auth required. Enabled per docs/22 preferred-source order.',
    },
    {
      sourceId: 'jobscollider',
      name: 'JobsCollider',
      type: SourceType.AGGREGATOR,
      url: 'https://jobscollider.com/remote-jobs.rss',
      global: true,
      rssAvailable: true,
      adapterStatus: AdapterStatus.ACTIVE,
      reliabilityScore: 0.8,
      contractRelevance: 0.7,
      remoteRelevance: 0.9,
      internationalRelevance: 0.85,
      termsUrl: 'https://jobscollider.com/remote-jobs.rss',
      rateLimit: 30,
      notes: 'Official RSS feed. Enabled per docs/22 preferred-source order.',
    },
    {
      sourceId: 'awesome-remote-jobs',
      name: 'Awesome Remote Jobs Catalogue',
      type: SourceType.SOURCE_CATALOGUE,
      url: 'https://github.com/lukasz-madon/awesome-remote-job',
      global: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.7,
      contractRelevance: 0.6,
      remoteRelevance: 1.0,
      internationalRelevance: 0.95,
      notes: 'Discovery catalogue, not a direct job source — see docs/05.',
    },
    {
      sourceId: 'linkedin',
      name: 'LinkedIn Jobs',
      type: SourceType.JOB_BOARD,
      url: 'https://linkedin.com/jobs',
      global: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.75,
      contractRelevance: 0.65,
      remoteRelevance: 0.7,
      internationalRelevance: 0.9,
      notes: 'No official API access confirmed. Disabled per docs/22 until reviewed.',
    },
    {
      sourceId: 'freelancermap',
      name: 'Freelancermap',
      type: SourceType.JOB_BOARD,
      url: 'https://freelancermap.com',
      global: true,
      rssAvailable: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.7,
      contractRelevance: 0.9,
      remoteRelevance: 0.8,
      internationalRelevance: 0.85,
      notes: 'RSS available but terms/licensing not yet independently verified.',
    },
    {
      sourceId: 'jobserve',
      name: 'JobServe',
      type: SourceType.JOB_BOARD,
      url: 'https://jobserve.com',
      global: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.75,
      contractRelevance: 0.85,
      remoteRelevance: 0.6,
      internationalRelevance: 0.8,
      notes: 'No official API/RSS access confirmed. Disabled per docs/22 until reviewed.',
    },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: { sourceId: source.sourceId },
      update: source,
      create: source,
    });
  }

  // Sample companies retained as illustrative seed data — these are public
  // facts (company names, public consultancy specialisms), not claims about
  // the user, so they don't carry the same fabrication risk as the removed
  // biography.
  const companies: Array<{
    name: string;
    website: string;
    country: string;
    regions: string[];
    type: CompanyType;
    specialisms: string[];
    score: number;
    provenance: Prisma.InputJsonValue;
  }> = [
    {
      name: 'Microsoft',
      website: 'https://microsoft.com',
      country: 'US',
      regions: ['AMER', 'EMEA', 'APAC'],
      type: CompanyType.DIRECT_CLIENT,
      specialisms: ['Azure', 'Cloud', 'AI', 'Enterprise'],
      score: 0.95,
      provenance: { source: 'manual', confidence: 1.0 },
    },
    {
      name: 'Avanade',
      website: 'https://avanade.com',
      country: 'US',
      regions: ['AMER', 'EMEA', 'APAC'],
      type: CompanyType.SYSTEMS_INTEGRATOR,
      specialisms: ['Azure', 'Microsoft', 'Cloud', 'Digital Transformation'],
      score: 0.9,
      provenance: { source: 'manual', confidence: 1.0 },
    },
    {
      name: 'Kainos',
      website: 'https://kainos.com',
      country: 'GB',
      regions: ['EMEA'],
      type: CompanyType.CLOUD_CONSULTANCY,
      specialisms: ['Azure', 'Cloud', 'Digital Services', 'Healthcare'],
      score: 0.85,
      provenance: { source: 'manual', confidence: 1.0 },
    },
    {
      name: 'Cloudreach',
      website: 'https://cloudreach.com',
      country: 'GB',
      regions: ['EMEA', 'AMER'],
      type: CompanyType.CLOUD_CONSULTANCY,
      specialisms: ['AWS', 'Azure', 'GCP', 'Migration', 'Managed Services'],
      score: 0.88,
      provenance: { source: 'manual', confidence: 1.0 },
    },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: { name: company.name },
      update: company,
      create: company,
    });
  }

  logger.info('Database seeded successfully');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      logger.error({ err: e }, 'Seeding failed');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seed };
