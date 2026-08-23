import { prisma } from './client';
import { logger } from '../config/logger';

async function migrate() {
  logger.info('Running database migrations...');
  
  // In a real app, you'd use `prisma migrate deploy` via CLI
  // This is a placeholder for programmatic migration if needed
  logger.info('Migrations complete (use `pnpm prisma migrate deploy` for production)');
}

if (require.main === module) {
  migrate()
    .catch((e) => {
      logger.error({ err: e }, 'Migration failed');
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { migrate };