import { describe, it, expect, vi } from 'vitest';

const BASE_ENV = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/hunt_test', NODE_ENV: 'test' };

async function loadAuth(overrides: Record<string, string> = {}) {
  vi.resetModules();
  process.env = { ...BASE_ENV, ...overrides } as NodeJS.ProcessEnv;
  return import('./auth');
}

describe('checkPortalPassword', () => {
  it('accepts the configured password', async () => {
    const { checkPortalPassword } = await loadAuth({ PORTAL_PASSWORD: 'correct-horse-battery-staple' });
    expect(checkPortalPassword('correct-horse-battery-staple')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const { checkPortalPassword } = await loadAuth({ PORTAL_PASSWORD: 'correct-horse-battery-staple' });
    expect(checkPortalPassword('wrong-password')).toBe(false);
  });

  // Fail closed, not open: if the operator never configured a password,
  // login must never succeed by accident (e.g. an empty-string comparison
  // quirk), not silently allow anyone in.
  it('fails closed when PORTAL_PASSWORD is not configured at all, even against an empty submission', async () => {
    const { checkPortalPassword } = await loadAuth({});
    expect(checkPortalPassword('')).toBe(false);
    expect(checkPortalPassword('anything')).toBe(false);
  });
});
