import { BaseSourceAdapter, AdapterCapabilities, RawOpportunity, SearchParams, PermanentAdapterError } from './base';
import { ContractType, RemotePolicy } from '../../domain/types';

// Official public API, no auth, documented at https://jobi.cy/apidocs.
// docs-pack/docs/22 preferred-source order rank 1 ("official API").
interface JobicyJob {
  id: number;
  url: string;
  jobSlug: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate: string;
  annualSalaryMin?: number | null;
  annualSalaryMax?: number | null;
  salaryCurrency?: string | null;
}

interface JobicyResponse {
  jobCount: number;
  jobs: JobicyJob[];
}

// Jobicy's own jobType categories, translated as-is — this is reading the
// source's explicit classification, not guessing between contract and
// permanent employment (rule 8: never fabricate; this doesn't).
const JOB_TYPE_MAP: Record<string, ContractType> = {
  'full-time': ContractType.PERMANENT,
  'part-time': ContractType.UNKNOWN,
  contract: ContractType.CONTRACT,
  freelance: ContractType.FREELANCE,
  temporary: ContractType.CONTRACT,
  internship: ContractType.UNKNOWN,
};

function mapContractType(jobType?: string[]): ContractType | undefined {
  if (!jobType || jobType.length === 0) return undefined;
  for (const t of jobType) {
    const mapped = JOB_TYPE_MAP[t.toLowerCase()];
    if (mapped) return mapped;
  }
  return ContractType.UNKNOWN;
}

export class JobicyAdapter extends BaseSourceAdapter {
  readonly sourceId = 'jobicy';
  readonly name = 'Jobicy';
  readonly capabilities: AdapterCapabilities = {
    supportsApi: true,
    supportsRss: true,
    supportsBrowserSearch: false,
    supportsMcp: false,
    rateLimit: 60,
    requiresAuth: false,
  };

  private readonly baseUrl = 'https://jobicy.com/api/v2/remote-jobs';

  protected async doSearch(params: SearchParams): Promise<RawOpportunity[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('count', String(Math.min(params.maxResults ?? 50, 50)));
    if (params.keywords && params.keywords.length > 0) {
      // Jobicy's API accepts a single `tag` term; the eligibility layer
      // does further keyword filtering on the full result set, so we only
      // use the first keyword here to narrow the request itself.
      url.searchParams.set('tag', params.keywords[0]);
    }

    const response = await this.fetchWithDefaults(url.toString());
    let data: JobicyResponse;
    try {
      data = (await response.json()) as JobicyResponse;
    } catch (err) {
      throw new PermanentAdapterError('jobicy: response was not valid JSON', err);
    }

    if (!Array.isArray(data.jobs)) {
      throw new PermanentAdapterError('jobicy: response missing jobs[]');
    }

    return data.jobs.map((job): RawOpportunity => ({
      externalId: String(job.id),
      url: job.url,
      title: job.jobTitle,
      companyName: job.companyName,
      postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
      contractType: mapContractType(job.jobType),
      // Jobicy is a remote-jobs-only listing platform by definition — this
      // is the source's own classification, recorded as such (not
      // independently verified) rather than upgraded to FULLY_REMOTE.
      remotePolicy: RemotePolicy.REMOTE_FIRST,
      location: job.jobGeo,
      description: job.jobDescription ?? job.jobExcerpt,
      skills: job.jobIndustry,
      originalRate: job.annualSalaryMin ?? job.annualSalaryMax ?? undefined,
      originalCurrency: job.salaryCurrency ?? undefined,
      rateSource: job.annualSalaryMin != null || job.annualSalaryMax != null ? 'jobicy' : undefined,
      rawData: job as unknown as Record<string, unknown>,
    }));
  }

  protected async doHealthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await this.fetchWithDefaults(`${this.baseUrl}?count=1`, { timeoutMs: 10_000 });
      const data = (await response.json()) as JobicyResponse;
      return { healthy: Array.isArray(data.jobs) };
    } catch (err) {
      return { healthy: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
