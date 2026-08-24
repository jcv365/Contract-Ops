# HUNT Phase 1 — Status

Status values, as specified: `COMPLETE`, `PARTIAL`, `BLOCKED`, `NOT VERIFIED`. Updated live-verified 2026-08-24 (see `AUDIT-REPORT.md` for how each entry was checked). This is the authoritative status document — `TRACEABILITY.md` carries the more granular unit-test-level detail this rolls up from.

| Feature area | Status | Detail |
|---|---|---|
| Server / infra (Docker, Postgres, Redis, health) | **COMPLETE** | Live: all containers healthy, `/health` 200 |
| Portal (login, session, CSRF, least privilege) | **COMPLETE** | Live login flow verified end-to-end; HSTS/CSP bug found and fixed live this session |
| HUNT search execution | **PARTIAL** | Real, working, live-verified — but only 2 of many intended sources have adapters (Jobicy, JobsCollider) |
| Worldwide country/region coverage | **PARTIAL → being fixed this pass** | Matrix was accidentally narrowed to 3 countries during testing; restoring a real worldwide list now. Even restored, actual search reach is limited by the 2-adapter ceiling above |
| Coverage honesty (no false "100%" claims) | **COMPLETE** | Live-proven under real adverse conditions (4 fake-active sources correctly failed and demoted) |
| Source registry (fields, health tracking) | **COMPLETE** | Live-verified; **portal activation UX gap being fixed this pass** (could mark adapter-less sources ACTIVE) |
| Hard filters (remote, contract, freshness, keywords) | **COMPLETE** | Live-proven on real data |
| Hard filter: clearance | **PARTIAL** | Deterministic logic implemented and unit-tested; dormant — no adapter ever supplies clearance evidence |
| Hard filter: work authorisation, language | **NOT VERIFIED** | Not implemented — no source supplies this evidence |
| Deduplication / cross-source clustering | **PARTIAL** | Mechanism implemented and unit-tested; never observed a real cross-source duplicate live (0 conflicts recorded) |
| Rate handling + ZAR conversion | **COMPLETE** | Live-proven: real $1000 USD → R16,004.40 ZAR via Frankfurter, original preserved, sourced, timestamped |
| Recruiter records (manual entry, verification, readiness) | **COMPLETE** | Portal + API live-verified; ADR-003 email rule unit-proven |
| **Recruiter discovery (automated)** | **NOT VERIFIED — not implemented** | No code searches for recruiters at all |
| Company records (manual entry, targeting, readiness) | **COMPLETE** | Portal + API live-verified, real company created end-to-end |
| **Company / direct-client / partner discovery (automated)** | **NOT VERIFIED — not implemented** | No discovery adapter exists |
| **Procurement / framework / tender discovery** | **NOT VERIFIED — not implemented** | Data model + CRUD exist; nothing searches for tenders |
| Search term matrix (title/skill combinations) | **NOT VERIFIED — not implemented** | Adapters take a single optional keyword, not a matrix |
| Remote sub-classification (EU/region-scoped remote) | **NOT VERIFIED — not implemented** | Schema only has FULLY_REMOTE/REMOTE_FIRST/HYBRID/ONSITE/UNKNOWN |
| BIDOPS (research/draft/review, evidence-first) | **BLOCKED** | Code real and unit-tested (hallucination rejection, word bounds); every live call 422s — no `FREELLMAPI_API_KEY` |
| Microsoft Graph send | **BLOCKED** | Mock transport proves the surrounding logic only; no Entra app registered, real transport never exercised |
| Human approval workflow | **PARTIAL** | State machine enforced in code; not exercised end-to-end live (0 drafts exist, since BIDOPS is blocked) |
| Idempotent send / duplicate protection | **PARTIAL** | Unit-proven (5 tests); never exercised against a live send (Graph blocked) |
| Reply intelligence (classify, extract, promote) | **BLOCKED** | Logic unit-tested; gated behind `ENABLE_REPLY_INGESTION=false`, needs the same Entra app as Graph send |
| Prompt injection defence | **PARTIAL** | Wrapper mechanism unit-tested; never exercised against a live model (BIDOPS blocked) |
| Secret protection (logs, env) | **COMPLETE** | Real pino instance + captured-output test, not just config inspection |
| Tenant isolation | **PARTIAL** | Live-proven on 2 of many routes (opportunities, companies) |
| Least privilege (API key gate) | **COMPLETE** | Live 401/200 proven |
| Conflict preservation (disagreeing sources) | **PARTIAL** | Mechanism implemented and unit-tested; never triggered live (no real conflicting data observed yet) |
| Career-Ops integration | **NOT VERIFIED — not implemented** | Source row exists as PENDING; deferred pending independent terms review, never built |
| Commercial intelligence (rate benchmarking) | **COMPLETE** (mechanism) | `sufficientData` flag proven — correctly returns "insufficient" rather than fabricating a benchmark from 0 rate-bearing opportunities |

## What "Phase 1 operational" actually requires beyond this

Per the user's own demonstration checklist: a real Graph send landing in Sent Items, a real controlled reply ingested and classified, and a real recruiter/company target reaching genuine automated discovery (not manual entry). None of these are achievable without either (a) a freellmapi API key, (b) an Entra ID app registration, or (c) new discovery-adapter subsystems — all of which are either external dependencies or multi-sprint new work, not something fixable in this pass.
