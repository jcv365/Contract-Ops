// Shared by src/api/middleware/api-key.ts (the API's shared secret) and
// src/portal/auth.ts (the portal's login password) — both compare a
// caller-supplied string against a server-held secret, and both need to
// avoid a timing side-channel that could let an attacker learn the secret
// one byte at a time from response latency.
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
