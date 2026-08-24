import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { constantTimeEquals } from '../shared/constant-time';

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    csrfToken?: string;
  }
}

export function requirePortalSession(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated) {
    next();
    return;
  }
  res.redirect('/portal/login');
}

// Tighter than the general API rate limiter — a login form is exactly the
// kind of endpoint a brute-force attempt targets.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts — try again in 15 minutes.',
});

export function checkPortalPassword(submitted: string): boolean {
  if (!env.PORTAL_PASSWORD) {
    logger.error('PORTAL_PASSWORD is not configured — portal login is disabled entirely (fail closed, not open)');
    return false;
  }
  return constantTimeEquals(submitted, env.PORTAL_PASSWORD);
}
