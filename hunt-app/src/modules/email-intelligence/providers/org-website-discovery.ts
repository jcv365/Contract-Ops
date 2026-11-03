// The only implemented EmailDiscoveryProvider (confirmed decision:
// official organisation websites only, no vendor partner directories —
// see AUDIT-REPORT.md's 2026-09-01 addendum on why AWS's/Microsoft's
// partner directories were investigated and found not viable to scrape).
// Fetches a fixed set of candidate paths off a company's own site via
// web-fetch/client.ts (which already enforces the docs/22 compliance gate,
// per-domain rate limiting, and same-domain-only redirects), extracts
// mailto: links with cheerio, and infers structural email type from the
// local part + page adjacency — never constructs or guesses an address.
import * as cheerio from 'cheerio';
import { EmailSourceKind } from '../../../domain/types';
import { EmailDiscoveryProvider, DiscoveryTarget, DiscoveryOutcome, DiscoveredEmailCandidate } from '../discovery-provider';
import { webFetchClient, WebFetchRefusedError, WebFetchError } from '../../web-fetch/client';
import { inferEmailTypeFromLocalPart } from '../local-part';
import { env } from '../../../config/env';

const CANDIDATE_PATHS = [
  '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team',
  '/people', '/leadership', '/careers', '/work-with-us', '/legal', '/imprint', '/impressum',
];

const NAV_LINK_PATTERN = /(contact|team|people|about|leadership)/i;
const PERSON_NAME_PATTERN = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$/;

export interface ContactFormFinding {
  url: string;
}

function findNearbyPersonName($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>): string | undefined {
  const block = el.closest('li, tr, td, div, p');
  const text = (block.length ? block.text() : el.parent().text()).trim();
  const lines = text
    .split(/\n|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.find((line) => PERSON_NAME_PATTERN.test(line));
}

export function extractFromPage(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  contentHash: string,
  target: DiscoveryTarget
): { candidates: DiscoveredEmailCandidate[]; contactForm?: ContactFormFinding } {
  const candidates: DiscoveredEmailCandidate[] = [];
  const seen = new Set<string>();
  const pageTitle = $('title').first().text().trim() || undefined;

  $('a[href^="mailto:"]').each((_, elRaw) => {
    const el = $(elRaw);
    const href = el.attr('href') ?? '';
    const address = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (!address || !address.includes('@') || seen.has(address)) return;
    seen.add(address);

    const nearbyName = findNearbyPersonName($, el as never);
    const nameBoundOnPage = Boolean(
      nearbyName && (!target.recruiterName || nearbyName.toLowerCase() === target.recruiterName.toLowerCase())
    );

    const emailType = inferEmailTypeFromLocalPart({ address, nameBoundOnPage });
    const contextSnippet = el.closest('li, tr, td, div, p').text().trim().slice(0, 240);

    candidates.push({
      address,
      emailType,
      sourceUrl: pageUrl,
      sourceKind: EmailSourceKind.OFFICIAL_COMPANY_SOURCE,
      extractionMethod: 'mailto-href',
      observedAt: new Date(),
      contentHash,
      pageTitle,
      contextSnippet: contextSnippet || undefined,
      personName: nameBoundOnPage ? nearbyName : undefined,
      confidence: nameBoundOnPage ? 0.85 : 0.7,
    });
  });

  // §88: a same-domain form with an email input, on a page we were
  // already permitted to fetch — recorded, never auto-submitted.
  let contactForm: ContactFormFinding | undefined;
  $('form').each((_, formRaw) => {
    const form = $(formRaw);
    const hasEmailField = form.find('input[type="email"]').length > 0;
    if (hasEmailField && !contactForm) {
      contactForm = { url: pageUrl };
    }
  });

  return { candidates, contactForm };
}

export class OrgWebsiteDiscoveryProvider implements EmailDiscoveryProvider {
  readonly providerId = 'org-website-discovery';
  readonly sourceKind = EmailSourceKind.OFFICIAL_COMPANY_SOURCE;
  readonly implemented = true;
  readonly verified = true;

  async discover(target: DiscoveryTarget): Promise<DiscoveryOutcome> {
    if (!env.ENABLE_WEB_DISCOVERY) {
      return { status: 'UNAVAILABLE', reason: 'ENABLE_WEB_DISCOVERY is false' };
    }
    if (!target.companyWebsite) {
      return { status: 'UNAVAILABLE', reason: 'No company website on record — nothing to fetch' };
    }

    let origin: URL;
    try {
      origin = new URL(target.companyWebsite.startsWith('http') ? target.companyWebsite : `https://${target.companyWebsite}`);
    } catch {
      return { status: 'UNAVAILABLE', reason: `Company website is not a valid URL: ${target.companyWebsite}` };
    }

    const checkedUrls: string[] = [];
    const allCandidates: DiscoveredEmailCandidate[] = [];
    let contactForm: ContactFormFinding | undefined;
    let anyPermitted = false;
    const maxPages = Math.max(1, env.WEB_FETCH_MAX_PAGES_PER_COMPANY);

    // Homepage first — also the source of any nav links matching
    // contact/team/people/about/leadership, which extends the candidate
    // set beyond the fixed path list without unbounded crawling.
    const candidatePaths = new Set(CANDIDATE_PATHS);
    let homepageChecked = false;

    for (const path of candidatePaths) {
      if (checkedUrls.length >= maxPages) break;
      const pageUrl = new URL(path, origin).toString();
      checkedUrls.push(pageUrl);

      let result;
      try {
        result = await webFetchClient.get(pageUrl);
        anyPermitted = true;
      } catch (err) {
        if (err instanceof WebFetchRefusedError) continue; // robots/compliance said no — try the next candidate path, not a hard stop
        if (err instanceof WebFetchError) continue; // 404/timeout/etc on this one path — keep trying others
        continue;
      }

      const $ = cheerio.load(result.body);

      if (!homepageChecked) {
        homepageChecked = true;
        $('a[href]').each((_, a) => {
          const href = $(a).attr('href') ?? '';
          if (!NAV_LINK_PATTERN.test(href)) return;
          try {
            const resolved = new URL(href, origin);
            if (resolved.hostname === origin.hostname && !candidatePaths.has(resolved.pathname)) {
              candidatePaths.add(resolved.pathname);
            }
          } catch {
            // ignore unparseable hrefs (mailto:, tel:, javascript:, ...)
          }
        });
      }

      const extracted = extractFromPage($, result.url, result.contentHash, target);
      allCandidates.push(...extracted.candidates);
      if (extracted.contactForm && !contactForm) contactForm = extracted.contactForm;
    }

    if (allCandidates.length > 0) {
      return { status: 'FOUND', candidates: allCandidates, contactFormUrl: contactForm?.url };
    }
    if (!anyPermitted) {
      return { status: 'NOT_PERMITTED', reason: 'Every candidate path was refused by the docs/22 compliance gate' };
    }
    return { status: 'NONE_FOUND', checkedUrls, contactFormUrl: contactForm?.url };
  }
}

export const orgWebsiteDiscoveryProvider = new OrgWebsiteDiscoveryProvider();
