import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { constantTimeEquals } from '../../shared/constant-time';

// docs-pack/docs/14/28 (least privilege): every request other than the
// health check must carry a valid API key. This is deliberately simple —
// one shared secret, not per-user RBAC — matching Phase 1's explicit
// single-user scope (CLAUDE.md rule 18: don't build multi-tenant/SaaS
// auth yet). Compared with a constant-time check to avoid a timing
// side-channel on the key itself.
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!env.API_KEY) {
    // No key configured — the preflight has already warned loudly about
    // this; fail OPEN only in that explicitly-unconfigured state so local
    // dev isn't blocked, never fail open due to a bug in the check itself.
    next();
    return;
  }

  const provided = req.header('x-api-key');
  if (!provided || !constantTimeEquals(provided, env.API_KEY)) {
    res.status(401).json({ error: 'Missing or invalid API key' });
    return;
  }
  next();
}
