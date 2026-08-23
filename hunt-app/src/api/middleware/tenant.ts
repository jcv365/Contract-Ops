import { Request, Response, NextFunction } from 'express';

// docs-pack/docs/11: "Use tenant_id fields where inexpensive, defaulting
// to one tenant in Phase 1." docs-pack/docs/28 names tenant leakage as a
// threat. Phase 1 is genuinely single-tenant (CLAUDE.md rule 18: don't
// build multi-tenant UI/billing yet) — there is no tenant-creation flow,
// so every request defaults to "default". This exists so the isolation
// boundary is real and tested NOW, ready for when a second tenant exists,
// rather than retrofitted later under pressure.
export const DEFAULT_TENANT_ID = 'default';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}

export function resolveTenant(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-tenant-id');
  req.tenantId = header && header.trim().length > 0 ? header.trim() : DEFAULT_TENANT_ID;
  next();
}

// Pure helper so the isolation boundary itself is unit-testable without a
// database: every scoped query must include tenantId, and a caller cannot
// accidentally override it by spreading a `where` that also sets tenantId
// (this always wins, applied last).
export function scopeToTenant<T extends Record<string, unknown>>(tenantId: string, where: T): T & { tenantId: string } {
  return { ...where, tenantId };
}
