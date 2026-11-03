import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { AttachmentKind } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../config/logger';
import { requirePortalSession, loginRateLimiter, checkPortalPassword } from './auth';
import { getOrCreateCsrfToken, requireCsrfToken } from './csrf';
import { sourceRegistryService, SourceActivationError } from '../modules/source-registry/service';
import { adapterRegistry } from '../modules/source-adapters/base';
import { evidenceService } from '../modules/evidence/service';
import { submitForApproval, approveDraft, rejectDraft } from '../modules/approval/service';
import { recruiterIntelligenceService } from '../modules/recruiter-intelligence/service';
import { companyIntelligenceService } from '../modules/company-intelligence/service';
import { suppressionService } from '../modules/suppression/service';
import { listCompliancePolicies, updateCompliancePolicy, CompliancePolicyActivationError } from '../modules/web-fetch/compliance';
import { verifyRecruiterEmail, discoverCompanyEmails, discoverRecruiterEmails } from '../modules/email-intelligence/service';
import { saveAttachment, listAttachments } from '../modules/attachments/service';
import { validateAttachment } from '../modules/graph/attachment-validation';
import { runDiscovery, approveDiscoveryCandidate } from '../modules/company-discovery/service';
import { DiscoveryQuery, DiscoveredCompanyCandidate } from '../modules/company-discovery/provider';
import { extractTextFromDocument, proposeClaimsFromCv, ProposedClaim, CvExtractionError } from '../modules/evidence/cv-extraction';

declare module 'express-session' {
  interface SessionData {
    discoveryCandidates?: DiscoveredCompanyCandidate[];
    discoveryContext?: { mode: DiscoveryQuery['mode']; vendorOrRegion: string };
    cvProposedClaims?: ProposedClaim[];
  }
}
import { AdapterStatus, EvidenceState, EmailType, CompanyType, SuppressionReason } from '../domain/types';
import { env } from '../config/env';

export const portalRouter = Router();
export const PORTAL_VIEWS_DIR = path.join(__dirname, 'views');

const DEFAULT_USER_ID = 'default-user';
// Shared multer instance, mounted only on specific routes (attachments,
// CV import) — declared here (not inline where first used) because a
// route registration line executes multer() immediately at module-load
// time, so it must already be defined by then.
const portalUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================
// Login / logout — the only routes reachable
// without an existing session.
// ============================================

portalRouter.get('/login', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/portal/');
    return;
  }
  res.render('login', { error: null, csrfToken: getOrCreateCsrfToken(req.session) });
});

portalRouter.post('/login', loginRateLimiter, (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const submittedCsrf = typeof req.body?._csrf === 'string' ? req.body._csrf : '';
  const sessionCsrf = req.session.csrfToken;

  if (!sessionCsrf || submittedCsrf !== sessionCsrf) {
    res.status(403).render('login', { error: 'Session expired — please try again.', csrfToken: getOrCreateCsrfToken(req.session) });
    return;
  }

  if (!checkPortalPassword(password)) {
    logger.warn('Portal login attempt failed');
    res.status(401).render('login', { error: 'Incorrect password.', csrfToken: getOrCreateCsrfToken(req.session) });
    return;
  }

  req.session.authenticated = true;
  logger.info('Portal login succeeded');
  res.redirect('/portal/');
});

portalRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/portal/login');
  });
});

// Everything below requires an authenticated session.
portalRouter.use(requirePortalSession);

// ============================================
// Dashboard
// ============================================

portalRouter.get('/', async (req, res, next) => {
  try {
    const [byStatus, pendingApprovals, sources] = await Promise.all([
      prisma.opportunity.groupBy({ by: ['status'], _count: true }),
      prisma.outreachDraft.count({ where: { status: 'AWAITING_APPROVAL' } }),
      prisma.source.findMany(),
    ]);
    res.render('dashboard', {
      csrfToken: getOrCreateCsrfToken(req.session),
      byStatus,
      pendingApprovals,
      sourceCount: sources.length,
      activeSourceCount: sources.filter((s) => s.adapterStatus === 'ACTIVE').length,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// HUNT search settings
// ============================================

portalRouter.get('/settings', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
    const hunt = (user?.settings as { hunt?: Record<string, unknown> } | undefined)?.hunt ?? {};
    res.render('settings', { csrfToken: getOrCreateCsrfToken(req.session), hunt, saved: false });
  } catch (err) {
    next(err);
  }
});

function splitLines(value: unknown): string[] {
  return typeof value === 'string'
    ? value.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];
}

portalRouter.post('/settings', requireCsrfToken, async (req, res, next) => {
  try {
    const hunt = {
      countries: splitLines(req.body.countries),
      regions: splitLines(req.body.regions),
      contractTypes: splitLines(req.body.contractTypes),
      remoteOnly: req.body.remoteOnly === 'on',
      seniority: splitLines(req.body.seniority),
      excludedKeywords: splitLines(req.body.excludedKeywords),
      requiredSkills: splitLines(req.body.requiredSkills),
      preferredSkills: splitLines(req.body.preferredSkills),
      allowedClearanceLevels: splitLines(req.body.allowedClearanceLevels),
    };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: DEFAULT_USER_ID } });
    const settings = (user.settings as Record<string, unknown>) ?? {};
    await prisma.user.update({ where: { id: DEFAULT_USER_ID }, data: { settings: { ...settings, hunt } } });
    res.render('settings', { csrfToken: getOrCreateCsrfToken(req.session), hunt, saved: true });
  } catch (err) {
    next(err);
  }
});

// ============================================
// Source management
// ============================================

portalRouter.get('/sources', async (req, res, next) => {
  try {
    const { sources } = await sourceRegistryService.list({ limit: 100 });
    // Live bug found 2026-08-24 (AUDIT-REPORT.md): the Active checkbox
    // used to accept any source, including ones with zero adapter
    // implementation. The view now knows which sources actually have
    // code behind them and disables the control for the rest.
    const sourcesWithAdapterInfo = sources.map((s) => ({ ...s, hasAdapter: adapterRegistry.get(s.sourceId) != null }));
    res.render('sources', { csrfToken: getOrCreateCsrfToken(req.session), sources: sourcesWithAdapterInfo, error: null });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/sources/:id', requireCsrfToken, async (req, res, next) => {
  try {
    const enabled = req.body.enabled === 'on';
    await sourceRegistryService.update(req.params.id, {
      adapterStatus: enabled ? AdapterStatus.ACTIVE : AdapterStatus.DISABLED,
      notes: typeof req.body.notes === 'string' ? req.body.notes : undefined,
    });
    res.redirect('/portal/sources');
  } catch (err) {
    if (err instanceof SourceActivationError) {
      const { sources } = await sourceRegistryService.list({ limit: 100 });
      const sourcesWithAdapterInfo = sources.map((s) => ({ ...s, hasAdapter: adapterRegistry.get(s.sourceId) != null }));
      res.status(422).render('sources', { csrfToken: getOrCreateCsrfToken(req.session), sources: sourcesWithAdapterInfo, error: err.message });
      return;
    }
    next(err);
  }
});

// ============================================
// Profile & Evidence
// ============================================

portalRouter.get('/profile', async (req, res, next) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: DEFAULT_USER_ID } });
    const evidence = profile
      ? await prisma.evidence.findMany({ where: { profileId: profile.id }, orderBy: { createdAt: 'desc' } })
      : [];
    res.render('profile', {
      csrfToken: getOrCreateCsrfToken(req.session),
      profile,
      evidence,
      evidenceStates: Object.values(EvidenceState),
      saved: false,
    });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/profile', requireCsrfToken, async (req, res, next) => {
  try {
    await prisma.profile.upsert({
      where: { userId: DEFAULT_USER_ID },
      update: {
        headline: req.body.headline || undefined,
        summary: req.body.summary || undefined,
        skills: splitLines(req.body.skills),
        certifications: splitLines(req.body.certifications),
        domains: splitLines(req.body.domains),
      },
      create: {
        userId: DEFAULT_USER_ID,
        headline: req.body.headline || undefined,
        summary: req.body.summary || undefined,
        skills: splitLines(req.body.skills),
        certifications: splitLines(req.body.certifications),
        domains: splitLines(req.body.domains),
        projects: [],
        achievements: [],
        contractPreferences: {},
      },
    });
    res.redirect('/portal/profile');
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/evidence', requireCsrfToken, async (req, res, next) => {
  try {
    const profile = await prisma.profile.upsert({
      where: { userId: DEFAULT_USER_ID },
      update: {},
      create: { userId: DEFAULT_USER_ID, skills: [], certifications: [], domains: [], projects: [], achievements: [], contractPreferences: {} },
    });
    const state = Object.values(EvidenceState).includes(req.body.state) ? (req.body.state as EvidenceState) : EvidenceState.SOURCE_REPORTED;
    await evidenceService.add({
      profileId: profile.id,
      claim: String(req.body.claim ?? ''),
      source: String(req.body.source ?? ''),
      confidence: Number(req.body.confidence) || 0.5,
      state,
    });
    res.redirect('/portal/profile');
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/evidence/:id/verify', requireCsrfToken, async (req, res, next) => {
  try {
    await evidenceService.markVerified(req.params.id, 'portal-operator');
    res.redirect('/portal/profile');
  } catch (err) {
    next(err);
  }
});

// ============================================
// CV import — extract, propose (session-held, unsaved), review, approve.
// Nothing becomes real Evidence until POST /profile/review-import.
// ============================================

portalRouter.post('/profile/import-cv', portalUpload.single('file'), requireCsrfToken, async (req, res, next) => {
  try {
    if (!req.file) {
      res.redirect('/portal/profile');
      return;
    }
    const text = await extractTextFromDocument(req.file.buffer, req.file.mimetype);
    const claims = await proposeClaimsFromCv(text, req.file.originalname);
    req.session.cvProposedClaims = claims;
    res.redirect('/portal/profile/review-import');
  } catch (err) {
    if (err instanceof CvExtractionError) {
      res.status(422).render('error', { csrfToken: getOrCreateCsrfToken(req.session), message: err.message });
      return;
    }
    next(err);
  }
});

portalRouter.get('/profile/review-import', (req, res) => {
  res.render('review-import', { csrfToken: getOrCreateCsrfToken(req.session), claims: req.session.cvProposedClaims ?? [] });
});

portalRouter.post('/profile/review-import', requireCsrfToken, async (req, res, next) => {
  try {
    const claims = req.session.cvProposedClaims ?? [];
    const profile = await prisma.profile.upsert({
      where: { userId: DEFAULT_USER_ID },
      update: {},
      create: { userId: DEFAULT_USER_ID, skills: [], certifications: [], domains: [], projects: [], achievements: [], contractPreferences: {} },
    });

    for (let i = 0; i < claims.length; i++) {
      if (req.body[`approve_${i}`] !== 'on') continue; // unchecked claims are simply not saved — the reject path
      const claimText = String(req.body[`claim_${i}`] ?? claims[i].claim);
      const state = (Object.values(EvidenceState) as string[]).includes(claims[i].state) ? (claims[i].state as EvidenceState) : EvidenceState.SOURCE_REPORTED;
      await evidenceService.add({ profileId: profile.id, claim: claimText, source: claims[i].source, sourceLocation: claims[i].sourceLocation, confidence: 0.7, state });
    }

    req.session.cvProposedClaims = undefined;
    res.redirect('/portal/profile');
  } catch (err) {
    next(err);
  }
});

// ============================================
// Attachments — CV / capability statement. Mounted only on this route,
// not globally, so it never interferes with express.json()/urlencoded()
// used everywhere else in the app.
// ============================================

portalRouter.get('/attachments', async (req, res, next) => {
  try {
    const attachments = await listAttachments(DEFAULT_USER_ID);
    res.render('attachments', { csrfToken: getOrCreateCsrfToken(req.session), attachments, error: null });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/attachments', portalUpload.single('file'), requireCsrfToken, async (req, res, next) => {
  try {
    if (!req.file) {
      const attachments = await listAttachments(DEFAULT_USER_ID);
      res.status(400).render('attachments', { csrfToken: getOrCreateCsrfToken(req.session), attachments, error: 'No file was uploaded.' });
      return;
    }
    const kind = Object.values(AttachmentKind).includes(req.body.kind) ? (req.body.kind as AttachmentKind) : AttachmentKind.OTHER;
    const check = validateAttachment({ mimeType: req.file.mimetype, sizeBytes: req.file.size }, undefined, req.file.buffer);
    if (!check.valid) {
      const attachments = await listAttachments(DEFAULT_USER_ID);
      res.status(422).render('attachments', { csrfToken: getOrCreateCsrfToken(req.session), attachments, error: check.reason });
      return;
    }
    await saveAttachment({ fileName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer, kind, ownerId: DEFAULT_USER_ID });
    res.redirect('/portal/attachments');
  } catch (err) {
    next(err);
  }
});

// ============================================
// Drafts — the missing DRAFT/VALIDATED -> AWAITING_APPROVAL step.
// submitForApproval() existed since Sprint 4 with no caller anywhere.
// ============================================

portalRouter.get('/drafts', async (req, res, next) => {
  try {
    const drafts = await prisma.outreachDraft.findMany({
      where: { status: { in: ['DRAFT', 'VALIDATED'] } },
      include: { validations: true },
      orderBy: { createdAt: 'desc' },
    });
    res.render('drafts', { csrfToken: getOrCreateCsrfToken(req.session), drafts });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/drafts/:id/submit', requireCsrfToken, async (req, res, next) => {
  try {
    await submitForApproval(req.params.id);
    res.redirect('/portal/drafts');
  } catch (err) {
    next(err);
  }
});

// ============================================
// Outreach approval queue
// ============================================

portalRouter.get('/approvals', async (req, res, next) => {
  try {
    const drafts = await prisma.outreachDraft.findMany({
      where: { status: 'AWAITING_APPROVAL' },
      include: { draftEvidence: { include: { evidence: true } }, draftAttachments: { include: { attachment: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.render('approvals', { csrfToken: getOrCreateCsrfToken(req.session), drafts });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/approvals/:id/approve', requireCsrfToken, async (req, res, next) => {
  try {
    await approveDraft({ draftId: req.params.id, userId: DEFAULT_USER_ID, notes: req.body.notes });
    res.redirect('/portal/approvals');
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/approvals/:id/reject', requireCsrfToken, async (req, res, next) => {
  try {
    await rejectDraft({ draftId: req.params.id, userId: DEFAULT_USER_ID, notes: req.body.notes });
    res.redirect('/portal/approvals');
  } catch (err) {
    next(err);
  }
});

// ============================================
// Companies — the Market Outreach Hunt targets
// (docs-pack/docs/06/13). No automated discovery
// adapter exists (Sprint 2 scope decision, recorded
// in TRACEABILITY.md R-08) — these are entered here
// manually, same as via the raw API.
// ============================================

portalRouter.get('/companies', async (req, res, next) => {
  try {
    const { companies } = await companyIntelligenceService.list({ limit: 100 });
    res.render('companies', { csrfToken: getOrCreateCsrfToken(req.session), companies, companyTypes: Object.values(CompanyType) });
  } catch (err) {
    next(err);
  }
});

portalRouter.get('/companies/:id', async (req, res, next) => {
  try {
    const company = await companyIntelligenceService.get(req.params.id);
    if (!company) {
      res.status(404).render('error', { csrfToken: getOrCreateCsrfToken(req.session), message: 'Company not found' });
      return;
    }
    res.render('company-detail', { csrfToken: getOrCreateCsrfToken(req.session), company, emailTypes: Object.values(EmailType) });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/companies', requireCsrfToken, async (req, res, next) => {
  try {
    const company = await companyIntelligenceService.create({
      name: String(req.body.name ?? ''),
      website: req.body.website || undefined,
      country: req.body.country || undefined,
      regions: splitLines(req.body.regions),
      type: Object.values(CompanyType).includes(req.body.type) ? req.body.type : undefined,
      specialisms: splitLines(req.body.specialisms),
    });
    res.redirect(`/portal/companies/${company.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/companies/:id/targeting', requireCsrfToken, async (req, res, next) => {
  try {
    await companyIntelligenceService.setTargeting(req.params.id, {
      targetingReason: String(req.body.targetingReason ?? ''),
      proposition: String(req.body.proposition ?? ''),
    });
    res.redirect(`/portal/companies/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/companies/:id/emails', requireCsrfToken, async (req, res, next) => {
  try {
    const emailType = Object.values(EmailType).includes(req.body.emailType) ? req.body.emailType : EmailType.INFERRED;
    await companyIntelligenceService.addEmail(req.params.id, String(req.body.email ?? ''), emailType);
    res.redirect(`/portal/companies/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/companies/:id/discover-emails', requireCsrfToken, async (req, res, next) => {
  try {
    await discoverCompanyEmails(req.params.id);
    res.redirect(`/portal/companies/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/companies/:id/emails/:emailId/verify', requireCsrfToken, async (req, res, next) => {
  try {
    const source = String(req.body.verificationSource ?? '');
    if (source.length < 3) throw new Error('verificationSource must name a real, independent check (ADR-003) — never guessed');
    await companyIntelligenceService.verifyEmail(req.params.id, req.params.emailId, source);
    res.redirect(`/portal/companies/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// ============================================
// Recruiters
// ============================================

portalRouter.get('/recruiters', async (req, res, next) => {
  try {
    const { recruiters } = await recruiterIntelligenceService.list({ limit: 100 });
    const companies = (await companyIntelligenceService.list({ limit: 200 })).companies;
    res.render('recruiters', { csrfToken: getOrCreateCsrfToken(req.session), recruiters, companies });
  } catch (err) {
    next(err);
  }
});

portalRouter.get('/recruiters/:id', async (req, res, next) => {
  try {
    const recruiter = await recruiterIntelligenceService.get(req.params.id);
    if (!recruiter) {
      res.status(404).render('error', { csrfToken: getOrCreateCsrfToken(req.session), message: 'Recruiter not found' });
      return;
    }
    res.render('recruiter-detail', { csrfToken: getOrCreateCsrfToken(req.session), recruiter, emailTypes: Object.values(EmailType) });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/recruiters', requireCsrfToken, async (req, res, next) => {
  try {
    const recruiter = await recruiterIntelligenceService.create({
      name: String(req.body.name ?? ''),
      title: req.body.title || undefined,
      companyId: req.body.companyId || undefined,
      region: req.body.region || undefined,
      specialisms: splitLines(req.body.specialisms),
      publicProfileUrl: req.body.publicProfileUrl || undefined,
    });
    res.redirect(`/portal/recruiters/${recruiter.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/recruiters/:id/discover-emails', requireCsrfToken, async (req, res, next) => {
  try {
    await discoverRecruiterEmails(req.params.id);
    res.redirect(`/portal/recruiters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/recruiters/:id/emails', requireCsrfToken, async (req, res, next) => {
  try {
    const emailType = Object.values(EmailType).includes(req.body.emailType) ? req.body.emailType : EmailType.INFERRED;
    await recruiterIntelligenceService.addEmail(req.params.id, { email: String(req.body.email ?? ''), emailType });
    res.redirect(`/portal/recruiters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/recruiters/:id/emails/:emailId/verify', requireCsrfToken, async (req, res, next) => {
  try {
    const source = String(req.body.verificationSource ?? '');
    if (source.length < 3) throw new Error('verificationSource must name a real, independent check (ADR-003) — never guessed');
    await recruiterIntelligenceService.verifyEmail(req.params.id, { emailId: req.params.emailId, verificationSource: source });
    res.redirect(`/portal/recruiters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// ============================================
// Automated email verification (Sprint D, email engine) — the §78/§79
// deterministic failover chain, distinct from the manual-assertion forms
// above. Shared by recruiter-detail.ejs and company-detail.ejs; redirects
// back to whichever page the button was clicked from.
// ============================================

portalRouter.post('/emails/:emailId/verify', requireCsrfToken, async (req, res, next) => {
  try {
    await verifyRecruiterEmail(req.params.emailId);
    const referer = req.get('Referer');
    res.redirect(referer && referer.includes('/portal/') ? referer : '/portal/');
  } catch (err) {
    next(err);
  }
});

// ============================================
// Discovery — vendor-partner / regional-recruiter search (Brave Search
// API). Results are held in the session only until approved — nothing is
// persisted as a Company until a human reviews the source and approves it
// (ADR-004: a search hit is a claim, not a fact).
// ============================================

function splitKeywords(value: unknown): string[] {
  return typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

portalRouter.get('/discovery', (req, res) => {
  res.render('discovery', {
    csrfToken: getOrCreateCsrfToken(req.session),
    enabled: env.ENABLE_SEARCH_DISCOVERY,
    candidates: req.session.discoveryCandidates ?? null,
    error: null,
  });
});

portalRouter.post('/discovery/search', requireCsrfToken, async (req, res, next) => {
  try {
    const mode: DiscoveryQuery['mode'] = req.body.mode === 'REGIONAL_RECRUITER' ? 'REGIONAL_RECRUITER' : 'VENDOR_PARTNER';
    const vendor = String(req.body.vendor ?? '').trim();
    const region = String(req.body.region ?? '').trim();
    const keywords = splitKeywords(req.body.keywords);

    const candidates = await runDiscovery({ mode, vendor: vendor || undefined, region: region || undefined, keywords });
    req.session.discoveryCandidates = candidates;
    req.session.discoveryContext = { mode, vendorOrRegion: mode === 'VENDOR_PARTNER' ? vendor : region };

    res.render('discovery', { csrfToken: getOrCreateCsrfToken(req.session), enabled: env.ENABLE_SEARCH_DISCOVERY, candidates, error: null });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/discovery/approve', requireCsrfToken, async (req, res, next) => {
  try {
    const index = Number(req.body.index);
    const candidate = req.session.discoveryCandidates?.[index];
    if (!candidate || !req.session.discoveryContext) {
      res.redirect('/portal/discovery');
      return;
    }
    const companyId = await approveDiscoveryCandidate(candidate, req.session.discoveryContext.mode, req.session.discoveryContext.vendorOrRegion);
    res.redirect(`/portal/companies/${companyId}`);
  } catch (err) {
    next(err);
  }
});

// ============================================
// Graph settings — read-only status. Azure/Entra
// credentials are never portal-editable: they'd
// have to be stored somewhere, and a plaintext
// client secret in the database is a worse security
// posture than "redeploy with an updated .env" for
// a value that changes rarely (rule 16/28).
// ============================================

portalRouter.get('/graph-settings', (req, res) => {
  res.render('graph-settings', {
    csrfToken: getOrCreateCsrfToken(req.session),
    enableGraphSend: env.ENABLE_GRAPH_SEND,
    enableReplyIngestion: env.ENABLE_REPLY_INGESTION,
    hasTenantId: Boolean(env.AZURE_TENANT_ID),
    hasClientId: Boolean(env.AZURE_CLIENT_ID),
    hasClientSecret: Boolean(env.AZURE_CLIENT_SECRET),
    hasRedirectUri: Boolean(env.GRAPH_REDIRECT_URI),
  });
});

// ============================================
// Suppressions — docs/28's "suppression list" control. Existed only as a
// schema table with no route of any kind before this.
// ============================================

portalRouter.get('/suppressions', async (req, res, next) => {
  try {
    const suppressions = await suppressionService.list();
    res.render('suppressions', { csrfToken: getOrCreateCsrfToken(req.session), suppressions, reasons: Object.values(SuppressionReason) });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/suppressions', requireCsrfToken, async (req, res, next) => {
  try {
    const reason = Object.values(SuppressionReason).includes(req.body.reason) ? req.body.reason : SuppressionReason.MANUAL;
    await suppressionService.create({
      email: String(req.body.email ?? ''),
      reason,
      notes: req.body.notes || undefined,
    });
    res.redirect('/portal/suppressions');
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/suppressions/:id/delete', requireCsrfToken, async (req, res, next) => {
  try {
    await suppressionService.delete(req.params.id);
    res.redirect('/portal/suppressions');
  } catch (err) {
    next(err);
  }
});

// ============================================
// Site compliance — docs/22. New subsystem (Sprint C, email engine): a
// domain cannot be fetched by org-website discovery (Sprint E) until a
// human has reviewed its terms/licence/permitted method here.
// ============================================

portalRouter.get('/site-compliance', async (req, res, next) => {
  try {
    const policies = await listCompliancePolicies();
    res.render('site-compliance', { csrfToken: getOrCreateCsrfToken(req.session), policies, error: null });
  } catch (err) {
    next(err);
  }
});

portalRouter.post('/site-compliance/:domain', requireCsrfToken, async (req, res, next) => {
  try {
    // The "add new domain" form posts here with domain=new and the real
    // domain in the body, since there is no existing row/id to target yet.
    const domain = req.params.domain === 'new' ? String(req.body.domain ?? '') : req.params.domain;
    await updateCompliancePolicy(domain, {
      termsUrl: req.body.termsUrl || undefined,
      licence: req.body.licence || undefined,
      permittedMethod: req.body.permittedMethod || undefined,
      notes: req.body.notes || undefined,
      status: req.body.active === 'on' ? AdapterStatus.ACTIVE : AdapterStatus.PENDING,
      markReviewed: req.body.markReviewed === 'on',
    });
    res.redirect('/portal/site-compliance');
  } catch (err) {
    if (err instanceof CompliancePolicyActivationError) {
      const policies = await listCompliancePolicies();
      res.status(422).render('site-compliance', { csrfToken: getOrCreateCsrfToken(req.session), policies, error: err.message });
      return;
    }
    next(err);
  }
});
