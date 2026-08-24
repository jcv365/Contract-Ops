# HUNT Phase 1 — Audit Report (refreshed 2026-08-24)

This supersedes the Sprint 0 version of this file, which predates six subsequent sprints of implementation and a live deployment. Produced in response to a full "do not trust the existing implementation" recovery prompt — every claim below was checked live against the running system on `192.168.1.195:3020`, not asserted from memory or prior session notes.

## 1. What actually runs, right now

- `docker ps` on 192.168.1.195: `hunt-app`, `hunt-postgres`, `hunt-redis` — all three `healthy`, up 10–25 hours at time of audit.
- `GET /health` → `200 {"status":"ok"}`.
- Fresh local `npx tsc --noEmit` (clean), `npx vitest run` (152/152 passing), `npm run build` (clean, including the EJS/CSS asset-copy step) — re-run this session, not carried forward from an earlier claim.
- `git log`: 15 commits on `master`, clean working tree, all pushed to `https://github.com/jcv365/Contract-Ops.git`.
- Real DB row counts at audit time: 37 opportunities, 7 sources, 4 companies, 0 recruiters, 0 outreach drafts, 0 evidence, 3 search runs, 0 claim conflicts.

## 2. Two real bugs found during this audit (owned, not hidden)

1. **HUNT's countries matrix was narrowed to `ZA/GB/US`.** Root cause: during earlier live testing of the portal's settings save form, a test payload was submitted to prove persistence worked, and never reset to the real 10-country seed. This directly explains why "worldwide search" looked broken — because it was, by an untested action taken during this session.
2. **The portal let an operator mark any source ACTIVE, including four with zero adapter implementation** (`jobserve`, `freelancermap`, `linkedin`, `awesome-remote-jobs` — only `jobicy` and `jobscollider` have real adapter classes, per `src/modules/source-adapters/index.ts`). A live HUNT run against this state returned `coveragePercent: 33.33`, correctly naming the four failures and auto-demoting them to `DEGRADED` — the coverage-honesty mechanism (rule 12 / doc 25) held up correctly under a genuine adverse condition. But the UI should never have allowed the misconfiguration in the first place.

Both are being fixed in this same pass (see `PHASE1-STATUS.md` and the commit history).

## 3. Full capability classification (IMPLEMENTED / TESTED / VERIFIED / NOT VERIFIED / BLOCKED)

See `PHASE1-STATUS.md` for the authoritative, maintained version of this table. Summary of the most important findings:

- **Genuinely working and live-verified**: HUNT search against Jobicy + JobsCollider, eligibility hard-filters, ZAR conversion (real $1000→R16,004.40 via Frankfurter), coverage honesty under failure, the portal (login, settings, sources, profile/evidence, companies, recruiters, approvals, Graph status), API key gate, tenant isolation on two routes, secret redaction, idempotent send (unit-level).
- **Structurally not what "worldwide search" implies**: only two source adapters exist, both global feeds with no per-country query capability. Expanding the countries list alone does not expand actual search coverage — that requires new adapters, which is genuinely new subsystem work, not a settings fix.
- **Never built at all (not broken, never attempted)**: automated recruiter discovery, automated company/direct-client/partner discovery, procurement/tender discovery, a real multi-term search matrix, remote-policy sub-classification (FULLY_REMOTE vs REMOTE_WITHIN_EU etc.), Career-Ops integration.
- **Blocked on external dependencies, not code**: BIDOPS AI drafting (no `FREELLMAPI_API_KEY`), Microsoft Graph send/reply ingestion (no Entra app registered — `MockGraphTransport` proves the surrounding logic, nothing more).

## 4. Reusable vs missing vs needs-rework

**Reusable as-is**: the entire HUNT pipeline (normalisation, dedup/clustering, eligibility, scoring, FX), the recruiter/company readiness-gate logic (deterministic, unit-proven), the approval state machine, the audit trail, the portal's auth/session/CSRF layer, the deploy tooling (Dockerfile, docker-compose, deploy.ps1) — all live-verified working on the actual target host.

**Needs rework**: the portal's Sources page (must refuse to activate an adapter-less source, not just display one), the seeded/configured countries matrix (needs restoring to something resembling real worldwide coverage).

**Missing, requiring new subsystems**: every discovery automation (recruiters, companies, procurement), a real search-term matrix, remote-policy granularity, more source adapters beyond the two that exist.

## 5. Recommended sequence

1. Fix the two live bugs immediately (this pass).
2. Do not attempt the full remaining scope in one sprint — it is genuinely several sprints of new subsystem work (discovery automation for three different target types, procurement search, a broader source adapter roster). Next-sprint scope to be confirmed with the user rather than assumed.
