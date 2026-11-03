import { AdapterStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { parseRobotsTxt, isAllowed, crawlDelayFor, OUR_AGENT } from './robots';

export class CompliancePolicyActivationError extends Error {}

export interface ComplianceVerdict {
  allowed: boolean;
  reason: string;
  requestsPerMinute: number;
}

const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;

function contactSuffixedAgent(): string {
  return env.WEB_FETCH_CONTACT_URL ? `${OUR_AGENT} (+${env.WEB_FETCH_CONTACT_URL})` : OUR_AGENT;
}

async function refreshRobots(domain: string): Promise<void> {
  const url = `https://${domain}/robots.txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);

  // 'OK'/'NOT_FOUND' are the only statuses that let a fetch proceed —
  // NOT_FOUND per RFC 9309 (an absent robots.txt means unrestricted).
  // Everything else (401/403/5xx/timeout/network error) is FETCH_FAILED
  // and fails closed in checkCompliance below, per docs/22 "if uncertain,
  // disable the adapter and document the issue."
  let status: 'OK' | 'NOT_FOUND' | 'FETCH_FAILED';
  let body: string | null = null;
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': contactSuffixedAgent() } });
    if (response.status === 404) {
      status = 'NOT_FOUND';
    } else if (response.ok) {
      status = 'OK';
      body = await response.text();
    } else {
      status = 'FETCH_FAILED';
    }
  } catch (err) {
    logger.warn({ domain, err }, 'robots.txt fetch failed — failing closed');
    status = 'FETCH_FAILED';
  } finally {
    clearTimeout(timeout);
  }

  const rules = body ? parseRobotsTxt(body) : { groups: [], sitemaps: [] };
  const crawlDelay = body ? crawlDelayFor(rules, OUR_AGENT) : undefined;
  const requestsPerMinute = crawlDelay
    ? Math.max(1, Math.min(env.WEB_FETCH_DEFAULT_RPM, Math.floor(60 / Math.max(crawlDelay, 1))))
    : env.WEB_FETCH_DEFAULT_RPM;

  await prisma.siteCompliancePolicy.upsert({
    where: { domain },
    update: { robotsFetchedAt: new Date(), robotsStatus: status, robotsBody: body, crawlDelaySeconds: crawlDelay ?? null, requestsPerMinute },
    create: { domain, robotsFetchedAt: new Date(), robotsStatus: status, robotsBody: body, crawlDelaySeconds: crawlDelay ?? null, requestsPerMinute },
  });
}

// The docs/22 gate — may this specific path be fetched right now? Refuses
// (fail closed) unless ALL of: robots.txt was fetched successfully (OK or
// NOT_FOUND, never FETCH_FAILED), a human has recorded the compliance
// fields for this domain (lastReviewedAt set), the policy's status is
// ACTIVE, and robots.txt itself permits the path.
export async function checkCompliance(domain: string, pathname: string): Promise<ComplianceVerdict> {
  let policy = await prisma.siteCompliancePolicy.findUnique({ where: { domain } });

  const stale = !policy?.robotsFetchedAt || Date.now() - policy.robotsFetchedAt.getTime() > ROBOTS_TTL_MS;
  if (stale) {
    await refreshRobots(domain);
    policy = await prisma.siteCompliancePolicy.findUnique({ where: { domain } });
  }

  if (!policy) {
    return { allowed: false, reason: 'No compliance policy could be established for this domain', requestsPerMinute: env.WEB_FETCH_DEFAULT_RPM };
  }
  if (policy.robotsStatus === 'FETCH_FAILED') {
    return { allowed: false, reason: 'robots.txt could not be fetched (401/403/5xx/timeout) — failing closed per docs/22', requestsPerMinute: policy.requestsPerMinute };
  }
  if (!policy.lastReviewedAt) {
    return { allowed: false, reason: 'No human has recorded the docs/22 compliance fields for this domain yet', requestsPerMinute: policy.requestsPerMinute };
  }
  if (policy.status !== AdapterStatus.ACTIVE) {
    return { allowed: false, reason: `Domain compliance status is ${policy.status}, not ACTIVE`, requestsPerMinute: policy.requestsPerMinute };
  }

  const rules = policy.robotsBody ? parseRobotsTxt(policy.robotsBody) : { groups: [], sitemaps: [] };
  const allowed = policy.robotsBody ? isAllowed(rules, OUR_AGENT, pathname) : true;

  return {
    allowed,
    reason: allowed ? 'robots.txt permits this path' : `robots.txt disallows ${pathname}`,
    requestsPerMinute: policy.requestsPerMinute,
  };
}

export interface UpdatePolicyInput {
  termsUrl?: string;
  licence?: string;
  permittedMethod?: string;
  attributionRequired?: boolean;
  redistributionNotes?: string;
  privacyNotes?: string;
  notes?: string;
  status?: AdapterStatus;
  markReviewed?: boolean;
}

// The write side — same "cannot activate without a real review" pattern as
// source-registry/service.ts's SourceActivationError, applied to domains
// instead of adapters: a domain cannot be set ACTIVE unless a human has
// explicitly ticked "mark reviewed" now or has done so previously.
export async function updateCompliancePolicy(domain: string, input: UpdatePolicyInput) {
  const existing = await prisma.siteCompliancePolicy.findUnique({ where: { domain } });
  const lastReviewedAt = input.markReviewed ? new Date() : (existing?.lastReviewedAt ?? null);

  if (input.status === AdapterStatus.ACTIVE && !lastReviewedAt) {
    throw new CompliancePolicyActivationError(
      `Cannot activate compliance for '${domain}': the docs/22 fields (terms, licence, permitted method) have not been reviewed. Tick "mark reviewed" once they have actually been checked.`
    );
  }

  return prisma.siteCompliancePolicy.upsert({
    where: { domain },
    update: {
      termsUrl: input.termsUrl,
      licence: input.licence,
      permittedMethod: input.permittedMethod,
      attributionRequired: input.attributionRequired,
      redistributionNotes: input.redistributionNotes,
      privacyNotes: input.privacyNotes,
      notes: input.notes,
      status: input.status,
      lastReviewedAt,
    },
    create: {
      domain,
      termsUrl: input.termsUrl,
      licence: input.licence,
      permittedMethod: input.permittedMethod,
      attributionRequired: input.attributionRequired ?? false,
      redistributionNotes: input.redistributionNotes,
      privacyNotes: input.privacyNotes,
      notes: input.notes,
      status: input.status ?? AdapterStatus.PENDING,
      lastReviewedAt,
    },
  });
}

export async function listCompliancePolicies() {
  return prisma.siteCompliancePolicy.findMany({ orderBy: { domain: 'asc' } });
}
