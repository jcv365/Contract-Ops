import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env';
import { logger } from './config/logger';
import { runStartupPreflight } from './config/preflight';
import { connectDatabase, disconnectDatabase } from './db/client';
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
import { requireApiKey } from './api/middleware/api-key';
import { resolveTenant } from './api/middleware/tenant';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
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

// Least privilege (docs-pack/docs/14/28): every route below this line
// requires the API key. /health is deliberately exempt so container
// orchestration healthchecks work without a credential.
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
  registerAdapters();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ port: env.PORT, host: env.HOST }, 'HUNT server started');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start HUNT server');
  process.exit(1);
});
