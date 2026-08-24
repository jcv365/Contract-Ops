import path from 'node:path';
import { Router } from 'express';
import { prisma } from '../db/client';
import { logger } from '../config/logger';
import { requirePortalSession, loginRateLimiter, checkPortalPassword } from './auth';
import { getOrCreateCsrfToken, requireCsrfToken } from './csrf';
import { sourceRegistryService } from '../modules/source-registry/service';
import { evidenceService } from '../modules/evidence/service';
import { approveDraft, rejectDraft } from '../modules/approval/service';
import { recruiterIntelligenceService } from '../modules/recruiter-intelligence/service';
import { companyIntelligenceService } from '../modules/company-intelligence/service';
import { AdapterStatus, EvidenceState, EmailType, CompanyType } from '../domain/types';
import { env } from '../config/env';

export const portalRouter = Router();
export const PORTAL_VIEWS_DIR = path.join(__dirname, 'views');

const DEFAULT_USER_ID = 'default-user';

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
    res.render('sources', { csrfToken: getOrCreateCsrfToken(req.session), sources });
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
