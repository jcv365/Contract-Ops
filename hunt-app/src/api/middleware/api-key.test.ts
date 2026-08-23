import { describe, it, expect, vi } from 'vitest';

const BASE_ENV = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/hunt_test', NODE_ENV: 'test' };

async function loadMiddleware(overrides: Record<string, string> = {}) {
  vi.resetModules();
  process.env = { ...BASE_ENV, ...overrides } as NodeJS.ProcessEnv;
  return import('./api-key');
}

function mockReqRes(headerValue?: string) {
  const req = { header: (name: string) => (name === 'x-api-key' ? headerValue : undefined) } as never;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const res = { status, json } as never;
  const next = vi.fn();
  return { req, res, status, json, next };
}

describe('requireApiKey', () => {
  it('rejects a request with no key when API_KEY is configured', async () => {
    const { requireApiKey } = await loadMiddleware({ API_KEY: 'a-real-secret-key-value' });
    const { req, res, status, json, next } = mockReqRes(undefined);
    requireApiKey(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong key', async () => {
    const { requireApiKey } = await loadMiddleware({ API_KEY: 'a-real-secret-key-value' });
    const { req, res, next } = mockReqRes('wrong-key');
    requireApiKey(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a request with the correct key', async () => {
    const { requireApiKey } = await loadMiddleware({ API_KEY: 'a-real-secret-key-value' });
    const { req, res, next } = mockReqRes('a-real-secret-key-value');
    requireApiKey(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('fails open only when no API_KEY is configured at all (documented dev-mode behaviour)', async () => {
    const { requireApiKey } = await loadMiddleware({});
    const { req, res, next } = mockReqRes(undefined);
    requireApiKey(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
