import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { constantTimeEquals } from '../shared/constant-time';

// Minimal hand-rolled CSRF protection for the portal's form POSTs — not
// adding the unmaintained `csurf` package for this. Standard double-submit
// pattern: a random token is stored in the session, embedded as a hidden
// field in every form, and checked against the session's copy on POST. A
// forged cross-site POST can't read the session's token to include it.
export function getOrCreateCsrfToken(session: { csrfToken?: string }): string {
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return session.csrfToken;
}

export function requireCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as unknown as { csrfToken?: string };
  const submitted = req.body?._csrf;
  if (!session.csrfToken || typeof submitted !== 'string' || !constantTimeEquals(submitted, session.csrfToken)) {
    res.status(403).send('Invalid or missing CSRF token — go back and reload the form.');
    return;
  }
  next();
}
