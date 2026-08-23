# HUNT Phase 1 — Requirements Traceability Matrix

Mandated by `docs-pack/docs/26-REQUIREMENTS-TRACEABILITY.md`: "No requirement is complete without a passing test." Updated at the end of every sprint (`docs-pack/docs/19-DEVELOPMENT-SPRINTS.md` sprint rule).

Status values: `NOT STARTED`, `IN PROGRESS`, `COMPLETE`, `NOT VERIFIED IN THIS ENVIRONMENT` (per `docs-pack/docs/25-OPERATIONAL-NOT-CONCEPTUAL.md` — mocked integrations may never claim `COMPLETE`).

| ID | Requirement | Implementation | Test | Acceptance Criterion | Status |
|---|---|---|---|---|---|
| R-01 | Worldwide coverage computed from actual successful searches, gaps visible | `modules/coverage`, `modules/hunt-engine` | `coverage/service.test.ts` (4 tests, passing) | Coverage % excludes failed/blocked/credential-missing sources | IN PROGRESS — source-level coverage proven by unit test; country/region-level coverage needs country-scoped adapters (not built); no DB-integration proof yet (no reachable Postgres in this environment) |
| R-02 | Remote/contract/eligibility validation (hard filters) | `modules/eligibility` | `eligibility/service.test.ts` (9 tests, passing) | Hybrid/onsite excluded when remote-only configured | IN PROGRESS — remote/contract/freshness/keyword filters proven; clearance/work-authorisation filters not implemented (no adapter currently supplies that evidence) |
| R-03 | Hard-filter failure cannot be actionable | `modules/scoring`, `modules/eligibility` | `scoring/service.test.ts` (4 tests, passing) | Excluded opportunities never reach ACTIONABLE | IN PROGRESS — unit-proven (eligibility dimension scores 0, actionability structurally gated); full pipeline not yet run against a live database |
| R-04 | Cross-source deduplication | `modules/normalisation` (fingerprint clustering) | `normalisation/service.test.ts` (3 tests, passing) | Same opportunity from two sources clusters once | IN PROGRESS — fingerprint function proven; DB clustering behaviour unverified without a live database |
| R-05 | ZAR conversion, original currency preserved, timestamped source | `modules/fx` | none yet (network-dependent provider not exercised in unit tests) | Foreign rate keeps original + gets sourced ZAR value | IN PROGRESS — fail-closed logic written (never guesses, caches 6h, returns null on any provider error); live provider call unverified in this environment |
| R-06 | Source provenance on every opportunity/recruiter record | `modules/normalisation` provenance JSON | none yet | Every record traces to its source | IN PROGRESS — populated on every normalise call; unverified against a live database |
| R-07 | Source failure visibility (not hidden as silent zero-results) | `modules/source-adapters`, `modules/hunt-engine`, `SourceHealthCheck` | none yet | Failed source distinguishable from zero-result source | IN PROGRESS — `SearchResult.errors[]` structurally distinguishes failure from empty results; end-to-end write-through unverified without a live database |
| R-08 | Recruiter/company discovery with provenance | `modules/recruiter-intelligence`, `modules/company-intelligence` | `company-intelligence/scoring.test.ts` (4 tests, passing) | CRUD + 8-dimension company scoring implemented; no automated discovery adapter exists yet — recruiters/companies are entered via API, not auto-discovered (doc 06 discovery search is out of scope for this sprint) | IN PROGRESS |
| R-09 | Email verification (no guessed email) | `modules/recruiter-intelligence/readiness.ts` | `recruiter-intelligence/readiness.test.ts` (11 tests, passing) | INFERRED email type can never reach EMAIL_READY | COMPLETE — proven: INFERRED is rejected even when verified/verificationSource/verifiedAt are all set; unverified email rejected; verification requires a recorded source + timestamp |
| R-10 | Named vs generic greeting rule | `modules/recruiter-intelligence/readiness.ts` | `recruiter-intelligence/readiness.test.ts` | Personal greeting only with verified named email | COMPLETE — proven: verified PERSONAL -> FIRST_NAME, verified GENERIC/TEAM/COMPANY -> COMPANY_TEAM, never the reverse |
| R-11 | Evidence-backed BIDOPS (no unsupported claims) | `modules/evidence`, `modules/bidops` | claim-without-evidence-fails | AI claim without evidence fails validation | NOT STARTED |
| R-12 | Evidence 5-state model, INFERRED labelled, UNKNOWN preserved | schema `EvidenceState` | evidence-state-gating | INFERRED cannot be presented as fact | NOT STARTED |
| R-13 | Conflicting sources preserved and marked CONFLICTED | schema `ClaimConflict` | conflict-preserves-both | Two disagreeing rates both retained, marked CONFLICTED | NOT STARTED |
| R-14 | CV / company profile / both selection | `modules/bidops`, `Attachment` | — | Sprint 3 | NOT STARTED |
| R-15 | Human approval required, no autonomous send | `modules/approval` | unverified-email-not-sent, no-bypass | Approval gate cannot be bypassed | NOT STARTED |
| R-16 | Microsoft Graph authentication, least privilege | `modules/graph` | — | Scopes limited to rule-17 set; Mail.Read only when reply ingestion enabled | NOT STARTED |
| R-17 | Idempotent send (no duplicate email on retry) | `modules/graph`, `EmailSend.idempotencyKey` | retry-no-duplicate | Failed send retries without duplicate | NOT STARTED |
| R-18 | Audit trail (11 fields) | `modules/audit` | audit-fields-present | Every send/approval/edit recorded | NOT STARTED |
| R-19 | Reply ingestion, classification, extraction | `modules/reply-intelligence` | reply-no-invented-rate, reply-creates-proposed-opportunity | Missing values stay null; new opportunity gets email provenance | NOT STARTED |
| R-20 | Secret protection (no secrets in logs/repo) | `config/logger`, `.gitignore` | tokens-never-in-logs | grep of logs finds no token material | IN PROGRESS (redaction added Sprint 0) |
| R-21 | Least privilege throughout | `modules/graph`, RBAC boundary | — | Sprint 4/7 | NOT STARTED |
| R-22 | Prompt-injection handling | `modules/ai` untrusted-content boundary | prompt-injection-no-upgrade | Embedded instructions in adverts/emails never executed | NOT STARTED |
| R-23 | PII controls (minimise data sent to AI, redact where practical) | `modules/ai` | — | Sprint 3 | NOT STARTED |
| R-24 | Tenant isolation | `tenantId` fields, authz tests | tenant-isolation-refused | Cross-tenant read refused | NOT STARTED |
| R-25 | Autonomous sending cannot be enabled by env misconfiguration | `config/env.ts` strict boolean parsing | env-strict-boolean | `ENABLE_GRAPH_SEND=false` never coerces to true | COMPLETE (Sprint 0) |
