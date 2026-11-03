// The only implemented OrgDiscoveryProvider (confirmed decision: Brave
// Search API, free tier). Unlike web-fetch/client.ts, this is a direct API
// call to Brave's own endpoint, not a scrape of a third party's page — the
// docs/22 compliance gate doesn't apply here (that gate governs fetching
// OTHER SITES' pages; querying a search API you're a legitimate client of
// is a different thing). A lightweight rate limiter still applies,
// honouring Brave's free-tier ~1 req/sec limit.
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { RateLimiter } from '../../web-fetch/rate-limiter';
import { OrgDiscoveryProvider, DiscoveryQuery, DiscoveryOutcome, DiscoveredCompanyCandidate } from '../provider';
import { buildVendorPartnerQuery, buildRegionalRecruiterQuery } from '../query-builder';

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
}
interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

function deriveWebsite(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export class BraveSearchProvider implements OrgDiscoveryProvider {
  readonly providerId = 'brave-search';
  readonly implemented = true;

  private readonly limiter = new RateLimiter(60); // ~1/sec, well inside Brave's free-tier ceiling

  async discover(query: DiscoveryQuery): Promise<DiscoveryOutcome> {
    if (!env.ENABLE_SEARCH_DISCOVERY) {
      return { candidates: [] };
    }
    if (!env.BRAVE_SEARCH_API_KEY) {
      logger.warn('company-discovery: ENABLE_SEARCH_DISCOVERY=true but BRAVE_SEARCH_API_KEY is not set — returning no candidates');
      return { candidates: [] };
    }

    const searchQuery =
      query.mode === 'VENDOR_PARTNER'
        ? buildVendorPartnerQuery(query.vendor ?? '', query.keywords)
        : buildRegionalRecruiterQuery(query.region ?? '', query.keywords);

    await this.limiter.acquire();

    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('count', '20');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY, 'User-Agent': env.USER_AGENT },
      });
    } catch (err) {
      logger.error({ err, searchQuery }, 'Brave search request failed');
      return { candidates: [] };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.error({ status: response.status, searchQuery }, 'Brave search returned a non-2xx response');
      return { candidates: [] };
    }

    const body = (await response.json()) as BraveSearchResponse;
    const results = body.web?.results ?? [];

    // Every candidate's name/snippet/sourceUrl is the search result's OWN
    // text — nothing here is invented (§76/rule 8 apply to discovery, not
    // just email addresses).
    const candidates: DiscoveredCompanyCandidate[] = results
      .filter((r) => r.url && r.title)
      .map((r) => ({
        name: r.title,
        website: deriveWebsite(r.url),
        snippet: r.description ?? '',
        sourceUrl: r.url,
        searchQuery,
      }));

    return { candidates };
  }
}

export const braveSearchProvider = new BraveSearchProvider();
