import { describe, it, expect, beforeEach, vi } from 'vitest';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/hunt_test',
  NODE_ENV: 'test',
};

async function loadPreflight(overrides: Record<string, string> = {}) {
  vi.resetModules();
  process.env = { ...BASE_ENV, ...overrides } as NodeJS.ProcessEnv;
  const mod = await import('./preflight');
  return mod;
}

describe('runStartupPreflight', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('passes with Graph send disabled and no Azure/Graph config at all', async () => {
    const { runStartupPreflight } = await loadPreflight({ ENABLE_GRAPH_SEND: 'false' });
    expect(() => runStartupPreflight()).not.toThrow();
  });

  it('refuses to boot with ENABLE_GRAPH_SEND=true but no ENCRYPTION_KEY', async () => {
    const { runStartupPreflight, PreflightError } = await loadPreflight({
      ENABLE_GRAPH_SEND: 'true',
      AZURE_TENANT_ID: 't',
      AZURE_CLIENT_ID: 'c',
      AZURE_CLIENT_SECRET: 's',
    });
    expect(() => runStartupPreflight()).toThrow(PreflightError);
  });

  it('refuses to boot with ENABLE_GRAPH_SEND=true but incomplete Azure config', async () => {
    const { runStartupPreflight, PreflightError } = await loadPreflight({
      ENABLE_GRAPH_SEND: 'true',
      ENCRYPTION_KEY: 'a'.repeat(32),
      AZURE_TENANT_ID: 't',
    });
    expect(() => runStartupPreflight()).toThrow(PreflightError);
  });

  it('passes with ENABLE_GRAPH_SEND=true and everything required present', async () => {
    const { runStartupPreflight } = await loadPreflight({
      ENABLE_GRAPH_SEND: 'true',
      ENCRYPTION_KEY: 'a'.repeat(32),
      AZURE_TENANT_ID: 't',
      AZURE_CLIENT_ID: 'c',
      AZURE_CLIENT_SECRET: 's',
    });
    expect(() => runStartupPreflight()).not.toThrow();
  });

  it('refuses ENABLE_REPLY_INGESTION=true with ENABLE_GRAPH_SEND=false as a likely misconfiguration', async () => {
    const { runStartupPreflight, PreflightError } = await loadPreflight({
      ENABLE_REPLY_INGESTION: 'true',
      ENABLE_GRAPH_SEND: 'false',
    });
    expect(() => runStartupPreflight()).toThrow(PreflightError);
  });

  // R-21 / docs-pack/docs/14/28: least privilege — production must not
  // run with the whole API surface unauthenticated.
  it('refuses to boot in production with no API_KEY set', async () => {
    const { runStartupPreflight, PreflightError } = await loadPreflight({ NODE_ENV: 'production' });
    expect(() => runStartupPreflight()).toThrow(PreflightError);
  });

  it('passes in production once API_KEY is set', async () => {
    const { runStartupPreflight } = await loadPreflight({ NODE_ENV: 'production', API_KEY: 'a'.repeat(32) });
    expect(() => runStartupPreflight()).not.toThrow();
  });

  it('does not require API_KEY outside production (local dev)', async () => {
    const { runStartupPreflight } = await loadPreflight({ NODE_ENV: 'development' });
    expect(() => runStartupPreflight()).not.toThrow();
  });
});
