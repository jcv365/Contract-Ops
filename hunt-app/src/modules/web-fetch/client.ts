import crypto from 'node:crypto';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { RateLimiter } from './rate-limiter';
import { checkCompliance } from './compliance';
import { OUR_AGENT } from './robots';
import { registrableDomain } from '../email-intelligence/domain';

export class WebFetchRefusedError extends Error {}
export class WebFetchError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'WebFetchError';
  }
}

const ALLOWED_CONTENT_TYPES = ['text/html', 'application/xhtml+xml', 'application/json'];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface WebFetchResult {
  url: string;
  status: number;
  body: string;
  contentHash: string;
}

interface LogEntry {
  url: string;
  robotsAllowed: boolean;
  httpStatus?: number;
  bytes?: number;
  contentHash?: string;
  latencyMs?: number;
  error?: string;
}

function userAgent(): string {
  return env.WEB_FETCH_CONTACT_URL ? `${OUR_AGENT}/1.0 (+${env.WEB_FETCH_CONTACT_URL})` : `${OUR_AGENT}/1.0`;
}

// The one place org-website discovery (Sprint E) is allowed to fetch a
// third-party page from — every call goes through checkCompliance() first,
// rate-limits per registrable domain, refuses to follow a redirect off the
// origin domain (an open-redirect on a permitted site must not become a
// side door into a disallowed one), and writes a WebFetchLog row for every
// attempt whether it succeeds or not.
class WebFetchClient {
  private readonly limiters = new Map<string, RateLimiter>();

  private limiterFor(domain: string, requestsPerMinute: number): RateLimiter {
    let limiter = this.limiters.get(domain);
    if (!limiter) {
      limiter = new RateLimiter(requestsPerMinute);
      this.limiters.set(domain, limiter);
    }
    return limiter;
  }

  async get(targetUrl: string): Promise<WebFetchResult> {
    const originDomain = registrableDomain(new URL(targetUrl).hostname);
    let currentUrl = targetUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = new URL(currentUrl);
      const domain = registrableDomain(parsed.hostname);

      if (domain !== originDomain) {
        await this.log({ url: currentUrl, robotsAllowed: false, error: `Redirect left the origin registrable domain (${originDomain} -> ${domain}) — refused` });
        throw new WebFetchRefusedError(`Redirect from ${originDomain} to ${domain} refused — same-domain redirects only`);
      }

      const verdict = await checkCompliance(domain, parsed.pathname);
      if (!verdict.allowed) {
        await this.log({ url: currentUrl, robotsAllowed: false, error: verdict.reason });
        throw new WebFetchRefusedError(`${currentUrl}: ${verdict.reason}`);
      }

      await this.limiterFor(domain, verdict.requestsPerMinute).acquire();

      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': userAgent(), Accept: ALLOWED_CONTENT_TYPES.join(', ') },
        });
      } catch (err) {
        clearTimeout(timeout);
        const message = err instanceof Error && err.name === 'AbortError' ? 'timed out' : 'request failed';
        await this.log({ url: currentUrl, robotsAllowed: true, error: message, latencyMs: Date.now() - startedAt });
        throw new WebFetchError(`${currentUrl}: ${message}`, err);
      }
      clearTimeout(timeout);

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get('location');
        await this.log({ url: currentUrl, robotsAllowed: true, httpStatus: response.status, latencyMs: Date.now() - startedAt });
        if (!location) throw new WebFetchError(`${currentUrl}: redirect (${response.status}) with no Location header`);
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        await this.log({ url: currentUrl, robotsAllowed: true, httpStatus: response.status, error: `Disallowed content-type: ${contentType || '(none)'}`, latencyMs: Date.now() - startedAt });
        throw new WebFetchError(`${currentUrl}: disallowed content-type '${contentType || '(none)'}'`);
      }
      if (!response.ok) {
        await this.log({ url: currentUrl, robotsAllowed: true, httpStatus: response.status, latencyMs: Date.now() - startedAt });
        throw new WebFetchError(`${currentUrl}: HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) {
        await this.log({ url: currentUrl, robotsAllowed: true, httpStatus: response.status, bytes: buffer.byteLength, error: `Response exceeded ${MAX_BYTES}-byte cap`, latencyMs: Date.now() - startedAt });
        throw new WebFetchError(`${currentUrl}: response exceeded ${MAX_BYTES}-byte cap`);
      }

      const body = buffer.toString('utf-8');
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      await this.log({ url: currentUrl, robotsAllowed: true, httpStatus: response.status, bytes: buffer.byteLength, contentHash, latencyMs: Date.now() - startedAt });

      return { url: currentUrl, status: response.status, body, contentHash };
    }

    throw new WebFetchError(`${targetUrl}: exceeded ${MAX_REDIRECTS} redirects`);
  }

  private async log(entry: LogEntry): Promise<void> {
    try {
      const domain = registrableDomain(new URL(entry.url).hostname);
      const policy = await prisma.siteCompliancePolicy.findUnique({ where: { domain } });
      await prisma.webFetchLog.create({
        data: {
          policyId: policy?.id,
          url: entry.url,
          robotsAllowed: entry.robotsAllowed,
          httpStatus: entry.httpStatus,
          bytes: entry.bytes,
          contentHash: entry.contentHash,
          latencyMs: entry.latencyMs,
          error: entry.error,
        },
      });
    } catch (err) {
      // The log write failing must never mask the original fetch outcome —
      // it's logged and swallowed here, not rethrown.
      logger.error({ err, url: entry.url }, 'Failed to write WebFetchLog row');
    }
  }
}

export const webFetchClient = new WebFetchClient();
