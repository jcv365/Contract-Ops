import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import { sourceRegistry } from './services/sources/registry';
import huntRoutes from './api/routes/hunt';
import bidopsRoutes from './api/routes/bidops';
import { logger } from './services/audit/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info({
    action: 'request',
    resourceType: 'http',
    resourceId: req.path,
    details: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
    },
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/hunt', huntRoutes);
app.use('/api/bidops', bidopsRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    action: 'error',
    resourceType: 'http',
    resourceId: req.path,
    details: {
      error: err.message,
      stack: err.stack,
    },
  });

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
async function start() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();

    console.log('Loading source registry...');
    await sourceRegistry.initialize();

    console.log(`Starting HUNT server on port ${PORT}...`);
    app.listen(PORT, () => {
      console.log(`HUNT server is running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API endpoints:`);
      console.log(`  POST   /api/hunt/run`);
      console.log(`  GET    /api/hunt/opportunities`);
      console.log(`  GET    /api/hunt/opportunities/:id`);
      console.log(`  POST   /api/hunt/opportunities/:id/revalidate`);
      console.log(`  POST   /api/bidops/research`);
      console.log(`  POST   /api/bidops/position`);
      console.log(`  POST   /api/bidops/draft`);
      console.log(`  POST   /api/bidops/review`);
      console.log(`  GET    /api/bidops`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();