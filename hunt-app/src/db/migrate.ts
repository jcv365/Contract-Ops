import { spawn } from 'node:child_process';
import { prisma } from './client';
import { logger } from '../config/logger';

// Shells out to `prisma migrate deploy` rather than reimplementing it —
// this is the entrypoint the Docker container runs on boot (see
// deploy/docker-compose.yml), so it must actually apply
// prisma/migrations/*, not just log a message.
async function migrate(): Promise<void> {
  logger.info('Running database migrations (prisma migrate deploy)...');

  await new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy exited with code ${code}`));
    });
  });

  logger.info('Migrations complete');
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