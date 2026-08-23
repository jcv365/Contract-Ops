import * as cheerio from 'cheerio';
import { BaseSourceAdapter, AdapterCapabilities, RawOpportunity, SearchParams, PermanentAdapterError } from './base';
import { RemotePolicy } from '../../domain/types';

// Official RSS feed. docs-pack/docs/22 preferred-source order rank 2
// ("official RSS/feed"). No contract-type field is present in this feed —
// left undefined rather than guessed; the eligibility layer decides what
// to do with an unknown contract type.
export class JobsColliderAdapter extends BaseSourceAdapter {
  readonly sourceId = 'jobscollider';
  readonly name = 'JobsCollider';
  readonly capabilities: AdapterCapabilities = {
    supportsApi: false,
    supportsRss: true,
    supportsBrowserSearch: false,
    supportsMcp: false,
    rateLimit: 30,
    requiresAuth: false,
  };

  private readonly feedUrl = 'https://jobscollider.com/remote-jobs.rss';

  protected async doSearch(params: SearchParams): Promise<RawOpportunity[]> {
    const response = await this.fetchWithDefaults(this.feedUrl);
    const xml = await response.text();

    const $ = cheerio.load(xml, { xmlMode: true });
    const items = $('item').toArray();
    if (items.length === 0) {
      throw new PermanentAdapterError('jobscollider: feed contained no <item> elements');
    }

    const maxResults = params.maxResults ?? 100;
    const opportunities: RawOpportunity[] = [];

    for (const el of items.slice(0, maxResults)) {
      const item = $(el);
      const title = item.find('title').first().text().trim();
      const link = item.find('link').first().text().trim();
      const guid = item.find('guid').first().text().trim();
      const pubDateRaw = item.find('pubDate').first().text().trim();
      const description = item.find('description').first().text().trim();

      if (!title || !link) continue;

      // "Job Title at Company Name" — this feed's only structured field
      // for company is embedded in the title text. Heuristic split, not a
      // verified field; kept in rawData untouched for downstream review.
      const separatorIndex = title.lastIndexOf(' at ');
      const jobTitle = separatorIndex > 0 ? title.slice(0, separatorIndex) : title;
      const companyName = separatorIndex > 0 ? title.slice(separatorIndex + 4) : undefined;

      opportunities.push({
        externalId: guid || link,
        url: link,
        title: jobTitle,
        companyName,
        postedAt: pubDateRaw ? new Date(pubDateRaw) : undefined,
        // This feed is JobsCollider's remote-jobs-only feed by definition
        // — source-level classification, not per-listing verification.
        remotePolicy: RemotePolicy.REMOTE_FIRST,
        description,
        rawData: { title, link, guid, pubDate: pubDateRaw, description },
      });
    }

    return opportunities;
  }

  protected async doHealthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await this.fetchWithDefaults(this.feedUrl, { timeoutMs: 10_000 });
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      return { healthy: $('item').length > 0 };
    } catch (err) {
      return { healthy: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
