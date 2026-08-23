import { describe, it, expect } from 'vitest';
import { scopeToTenant, resolveTenant, DEFAULT_TENANT_ID } from './tenant';

describe('scopeToTenant', () => {
  // R-24 (docs-pack/docs/28: tenant leakage): the core isolation
  // guarantee — a query scoped to one tenant can never carry another
  // tenant's id, no matter what the caller's `where` clause already had.
  it('always sets tenantId to the resolved tenant, even if the where clause tried to set a different one', () => {
    const where = { status: 'ELIGIBLE', tenantId: 'attacker-tenant' };
    const scoped = scopeToTenant('victim-tenant', where);
    expect(scoped.tenantId).toBe('victim-tenant');
  });

  it('preserves other filter fields unchanged', () => {
    const scoped = scopeToTenant('default', { status: 'ELIGIBLE' });
    expect(scoped.status).toBe('ELIGIBLE');
  });
});

describe('resolveTenant', () => {
  function mockReq(header?: string) {
    return { header: (name: string) => (name === 'x-tenant-id' ? header : undefined) } as never;
  }

  it('defaults to DEFAULT_TENANT_ID when no header is present', () => {
    const req = mockReq(undefined) as { tenantId?: string };
    resolveTenant(req as never, {} as never, () => {});
    expect(req.tenantId).toBe(DEFAULT_TENANT_ID);
  });

  it('uses the X-Tenant-Id header when present', () => {
    const req = mockReq('tenant-b') as { tenantId?: string };
    resolveTenant(req as never, {} as never, () => {});
    expect(req.tenantId).toBe('tenant-b');
  });

  it('falls back to default for a blank header rather than an empty tenant id', () => {
    const req = mockReq('   ') as { tenantId?: string };
    resolveTenant(req as never, {} as never, () => {});
    expect(req.tenantId).toBe(DEFAULT_TENANT_ID);
  });
});
