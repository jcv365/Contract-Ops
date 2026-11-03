import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env';
import { logger } from './config/logger';
import { runStartupPreflight } from './config/preflight';
import { connectDatabase, disconnectDatabase } from './db/client';
import { connectRedis, disconnectRedis } from './db/redis';
import { registerAdapters } from './modules/source-adapters';
import { sourcesRouter } from './api/routes/sources';
import { huntRouter } from './api/routes/hunt';
import { opportunitiesRouter } from './api/routes/opportunities';
import { recruitersRouter } from './api/routes/recruiters';
import { companiesRouter } from './api/routes/companies';
import { bidopsRouter } from './api/routes/bidops';
import { outreachRouter } from './api/routes/outreach';
import { auditRouter } from './api/routes/audit';
import { repliesRouter } from './api/routes/replies';
import { commercialRouter } from './api/routes/commercial';
import { settingsRouter } from './api/routes/settings';
import { profileRouter } from './api/routes/profile';
import { evidenceRouter } from './api/routes/evidence';
import { suppressionsRouter } from './api/routes/suppressions';
import { siteComplianceRouter } from './api/routes/site-compliance';
import { emailsRouter } from './api/routes/emails';
import { attachmentsRouter } from './api/routes/attachments';
import { requireApiKey } from './api/middleware/api-key';
import { resolveTenant } from './api/middleware/tenant';
import { portalRouter, PORTAL_VIEWS_DIR } from './portal/router';
import { buildSessionMiddleware } from './portal/session';

const app = express();

app.set('view engine', 'ejs');
app.set('views', PORTAL_VIEWS_DIR);

// This deployment is plain HTTP on a private LAN (192.168.1.195), not
// HTTPS (see portal/session.ts's cookie config for the same note).
// Helmet's DEFAULTS assume an HTTPS-served app and actively break a
// plain-HTTP one:
//   - `upgrade-insecure-requests` in the CSP tells the browser to rewrite
//     every request (including the portal's login form submission) to
//     https://, which nothing on this host serves — the form silently
//     "does nothing" because the browser is trying and failing to reach
//     a TLS port that was never opened.
//   - `Strict-Transport-Security` (HSTS) is worse: once a browser sees it
//     even once, it remembers to force HTTPS for this host for a full
//     year, regardless of what the user types afterward.
// Found live 2026-08-24 (see TRACEABILITY.md) after the portal's login
// form appeared to "do nothing" in a real browser — a scripted HTTP
// client (curl, PowerShell's Invoke-WebRequest) doesn't enforce either
// policy, so this class of bug is only ever caught by testing in an
// actual browser.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { upgradeInsecureRequests: null },
    },
    hsts: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // portal form POSTs
app.use('/portal-assets', express.static(path.join(__dirname, 'portal', 'public')));
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info(
      { method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt },
      'request'
    );
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin portal: session-authenticated (portalRouter itself gates every
// route past /login/logout via requirePortalSession), deliberately
// mounted BEFORE the API key gate below — a human at a browser doesn't
// carry an X-Api-Key, they carry a session cookie instead.
app.use(buildSessionMiddleware());
app.use('/portal', portalRouter);

// Least privilege (docs-pack/docs/14/28): every JSON API route below this
// line requires the API key. /health and /portal are the only exemptions.
app.use(requireApiKey);
app.use(resolveTenant);

app.use('/sources', sourcesRouter);
app.use('/hunt', huntRouter);
app.use('/opportunities', opportunitiesRouter);
app.use('/recruiters', recruitersRouter);
app.use('/companies', companiesRouter);
app.use('/bidops', bidopsRouter);
app.use('/outreach', outreachRouter);
app.use('/audit', auditRouter);
app.use('/replies', repliesRouter);
app.use('/commercial', commercialRouter);
app.use('/settings', settingsRouter);
app.use('/profile', profileRouter);
app.use('/evidence', evidenceRouter);
app.use('/suppressions', suppressionsRouter);
app.use('/site-compliance', siteComplianceRouter);
app.use('/emails', emailsRouter);
app.use('/attachments', attachmentsRouter);

// docs-pack/docs/15: "reject unknown unsafe input" — a ZodError becomes a
// 400 with the validation detail; anything else is an unhandled 500,
// logged but never leaking a stack trace or secret to the client.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', issues: err.issues });
    return;
  }
  logger.error({ err, path: req.path }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error' });
});

async function start(): Promise<void> {
  runStartupPreflight();
  await connectDatabase();
  await connectRedis();
  registerAdapters();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ port: env.PORT, host: env.HOST }, 'HUNT server started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start HUNT server');
  process.exit(1);
});
