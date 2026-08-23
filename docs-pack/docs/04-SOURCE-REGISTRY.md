# Source Registry

## Purpose

Maintain a canonical inventory of all sources HUNT can search.

## Source fields

- source_id
- name
- type
- URL
- country/region
- global/local
- API_available
- RSS_available
- browser/search_available
- MCP_available
- adapter_status
- reliability_score
- contract_relevance
- remote_relevance
- international_relevance
- terms_url
- licence
- attribution_required
- rate_limit
- last_health_check
- last_successful_search
- notes

## Source types

- job board;
- aggregator;
- API;
- RSS;
- recruiter website;
- company careers;
- procurement portal;
- framework portal;
- professional directory;
- source catalogue.

## Initial source families

Use the repository audit to determine which are already implemented. Candidate sources include:
- Career-Ops existing providers;
- Awesome Remote Job catalogue;
- Jobicy;
- JobsCollider;
- Freelancermap;
- JobServe;
- LinkedIn;
- Indeed;
- specialist cloud recruiters;
- regional job boards;
- government/procurement portals;
- company career pages.

## Health

A source is not considered searched if:
- the adapter failed;
- access was blocked;
- the source requires unavailable credentials;
- the query could not execute.

Record failure instead of pretending coverage.
