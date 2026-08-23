import { prisma } from './client';
import { logger } from '../config/logger';
import { SourceType, AdapterStatus } from '@prisma/client';

async function seed() {
  logger.info('Seeding database...');

  // Create default user
  const user = await prisma.user.upsert({
    where: { id: 'default-user' },
    update: {},
    create: {
      id: 'default-user',
      profileId: 'default-profile',
      settings: {
        hunt: {
          countries: ['ZA', 'GB', 'US', 'AU', 'CA', 'DE', 'NL', 'IE', 'AE', 'SG'],
          regions: ['EMEA', 'APAC', 'AMER'],
          contractTypes: ['FREELANCE', 'CONTRACT', 'SOW', 'PROJECT', 'CONSULTING'],
          remoteOnly: true,
          seniority: ['SENIOR', 'PRINCIPAL', 'ARCHITECT', 'LEAD'],
          excludedKeywords: ['PERMANENT', 'ONSITE', 'HYBRID', 'JUNIOR', 'MID'],
          requiredSkills: ['AZURE', 'CLOUD', 'ARCHITECTURE', 'INFRASTRUCTURE'],
          preferredSkills: ['FINOPS', 'AI', 'PLATFORM', 'NETWORKING', 'DEVOPS'],
        },
        bidops: {
          defaultTone: 'PROFESSIONAL',
          maxEmailLength: 180,
          requireEvidenceForClaims: true,
        },
        outreach: {
          requireApproval: true,
          defaultGreetingMode: 'FIRST_NAME',
        },
      },
    },
  });

  // Create default profile
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      headline: 'Principal Hybrid Cloud Architect | Azure | Enterprise Platform | FinOps',
      summary: 'Senior cloud architect with 15+ years designing and delivering enterprise-scale hybrid cloud transformations across financial services, telecommunications, and government sectors.',
      skills: [
        'Azure', 'AWS', 'GCP', 'Hybrid Cloud', 'Enterprise Architecture',
        'Infrastructure as Code', 'Terraform', 'Bicep', 'ARM',
        'Kubernetes', 'AKS', 'EKS', 'GKE',
        'FinOps', 'Cloud Economics', 'Cost Optimization',
        'Networking', 'Security', 'Identity', 'Governance',
        'DevOps', 'CI/CD', 'GitOps', 'Platform Engineering',
        'AI/ML Platform', 'Data Architecture', 'Migration',
      ],
      certifications: [
        'Microsoft Certified: Azure Solutions Architect Expert',
        'Microsoft Certified: DevOps Engineer Expert',
        'HashiCorp Certified: Terraform Associate',
        'CKA - Certified Kubernetes Administrator',
        'TOGAF 9 Certified',
        'AWS Certified Solutions Architect - Professional',
      ],
      domains: [
        'Financial Services', 'Telecommunications', 'Government',
        'Healthcare', 'Manufacturing', 'Retail',
      ],
      projects: [
        {
          name: 'Global Bank Hybrid Cloud Transformation',
          role: 'Lead Architect',
          duration: '18 months',
          technologies: ['Azure', 'AKS', 'Terraform', 'Azure Arc'],
          outcome: 'Migrated 200+ applications to hybrid cloud, 40% cost reduction',
        },
        {
          name: 'Telco 5G Core on Azure',
          role: 'Principal Architect',
          duration: '12 months',
          technologies: ['Azure', 'AKS', 'OpenShift', 'Networking'],
          outcome: 'Designed carrier-grade 5G core architecture',
        },
      ],
      achievements: [
        'Designed and delivered 10+ enterprise cloud transformations',
        'Achieved average 35% cloud cost optimization across engagements',
        'Published author on cloud architecture patterns',
        'Regular speaker at Azure and cloud conferences',
      ],
      contractPreferences: {
        rateRangeZAR: { min: 2500, max: 5000 },
        ratePeriod: 'DAILY',
        currencies: ['ZAR', 'USD', 'GBP', 'EUR'],
        preferredDuration: '6-12 months',
        noticePeriod: '4 weeks',
        travelWillingness: 'OCCASIONAL',
        timezonePreference: 'GMT+2',
      },
    },
  });

  // Seed initial sources
  const sources = [
    {
      sourceId: 'career-ops',
      name: 'Career-Ops',
      type: SourceType.API,
      url: 'https://api.career-ops.com',
      global: true,
      apiAvailable: true,
      adapterStatus: AdapterStatus.ACTIVE,
      reliabilityScore: 0.9,
      contractRelevance: 0.8,
      remoteRelevance: 0.9,
      internationalRelevance: 0.85,
      rateLimit: 1000,
      notes: 'Primary source for contract opportunities',
    },
    {
      sourceId: 'jobicy',
      name: 'Jobicy',
      type: SourceType.JOB_BOARD,
      url: 'https://jobicy.com',
      global: true,
      apiAvailable: true,
      rssAvailable: true,
      browserSearchAvailable: true,
      adapterStatus: AdapterStatus.ACTIVE,
      reliabilityScore: 0.85,
      contractRelevance: 0.75,
      remoteRelevance: 0.95,
      internationalRelevance: 0.9,
      rateLimit: 500,
      notes: 'Remote-first job board with API',
    },
    {
      sourceId: 'jobscollider',
      name: 'JobsCollider',
      type: SourceType.AGGREGATOR,
      url: 'https://jobscollider.com',
      global: true,
      apiAvailable: true,
      browserSearchAvailable: true,
      adapterStatus: AdapterStatus.ACTIVE,
      reliabilityScore: 0.8,
      contractRelevance: 0.7,
      remoteRelevance: 0.9,
      internationalRelevance: 0.85,
      rateLimit: 200,
      notes: 'Aggregates from multiple remote job sources',
    },
    {
      sourceId: 'awesome-remote-jobs',
      name: 'Awesome Remote Jobs Catalogue',
      type: SourceType.SOURCE_CATALOGUE,
      url: 'https://github.com/lukasz-madon/awesome-remote-job',
      global: true,
      browserSearchAvailable: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.7,
      contractRelevance: 0.6,
      remoteRelevance: 1.0,
      internationalRelevance: 0.95,
      notes: 'Discovery catalogue - not a direct job source',
    },
    {
      sourceId: 'linkedin',
      name: 'LinkedIn Jobs',
      type: SourceType.JOB_BOARD,
      url: 'https://linkedin.com/jobs',
      global: true,
      browserSearchAvailable: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.75,
      contractRelevance: 0.65,
      remoteRelevance: 0.7,
      internationalRelevance: 0.9,
      notes: 'Requires browser automation or partner API',
    },
    {
      sourceId: 'freelancermap',
      name: 'Freelancermap',
      type: SourceType.JOB_BOARD,
      url: 'https://freelancermap.com',
      global: true,
      apiAvailable: false,
      rssAvailable: true,
      browserSearchAvailable: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.7,
      contractRelevance: 0.9,
      remoteRelevance: 0.8,
      internationalRelevance: 0.85,
      notes: 'Strong for European freelance contracts',
    },
    {
      sourceId: 'jobserve',
      name: 'JobServe',
      type: SourceType.JOB_BOARD,
      url: 'https://jobserve.com',
      global: true,
      browserSearchAvailable: true,
      adapterStatus: AdapterStatus.PENDING,
      reliabilityScore: 0.75,
      contractRelevance: 0.85,
      remoteRelevance: 0.6,
      internationalRelevance: 0.8,
      notes: 'UK/EU focused, strong for contract roles',
    },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: { sourceId: source.sourceId },
      update: source,
      create: source,
    });
  }

  // Seed some sample companies
  const companies = [
    {
      name: 'Microsoft',
      website: 'https://microsoft.com',
      country: 'US',
      regions: ['AMER', 'EMEA', 'APAC'],
      type: 'DIRECT_CLIENT',
      specialisms: ['Azure', 'Cloud', 'AI', 'Enterprise'],
      score: 0.95,
      provenance: { source: 'manual', confidence: 1.0 },
    },
    {
      name: 'Avanade',
      website: 'https://avanade.com',
      country: 'US',
      regions: ['AMER', 'EMEA', 'APAC'],
      type: 'SYSTEMS_INTEGRATOR',
      specialisms: ['Azure', 'Microsoft', 'Cloud', 'Digital Transformation'],
      score: 0.9,
      provenance: { source: 'manual', confidence: 1.0 },
    },
    {
      name: 'Kainos',
      website: 'https://kainos.com',
      country: 'GB',
      regions: ['EMEA'],
      type: 'CLOUD_CONSULTANCY',
      specialisms: ['Azure', 'Cloud', 'Digital Services', 'Healthcare'],
      score: 0.85,
      provenance: { source: 'manual', confidence: 1.0 },
    },
    {
      name: 'Cloudreach',
      website: 'https://cloudreach.com',
      country: 'GB',
      regions: ['EMEA', 'AMER'],
      type: 'CLOUD_CONSULTANCY',
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