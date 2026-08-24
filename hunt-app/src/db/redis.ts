import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

// First real use of Redis in this codebase — it was provisioned in
// docker-compose.yml since Sprint 7 but unused until the portal needed a
// session store that survives a container restart (an in-memory
// express-session store would silently log the operator out on every
// redeploy).
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

export async function connectRedis(): Promise<void> {
  await redis.connect();
  logger.info('Redis connected successfully');
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
