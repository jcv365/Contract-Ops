# HUNT Phase 1 — Audit Report

Mandated by `docs-pack/CLAUDE.md` ("Required first output from Claude Code"). Produced before any production implementation, per Sprint 0 of `docs-pack/docs/19-DEVELOPMENT-SPRINTS.md`.

## 1. Repository structure (as found, before this sprint's reorganisation)

```
Contract ops/
  HUNT/                                   legacy skeleton — never compiled
  HUNT_Phase1_Claude_Code_Docs/
    hunt-phase1-docs/
      CLAUDE.md, README.md, adr/ (4), docs/ (00-23), prompts/ (6)
      hunt-app/                           governed Phase-1 scaffold, 8 files
  HUNT_Phase1_Hardening_Addendum/
    hunt-phase1-hardening/docs/ (24-29)   found only during Sprint 0 exploration
  *.zip                                   source archives of the above
```

Reorganised in Sprint 0 to:

```
Contract ops/
  docs-pack/          CLAUDE.md, README.md, adr/, docs/ (00-29 merged), prompts/
  hunt-app/           the application (formerly buried 3 directories deep)
  archive/legacy-hunt/  preserved, not deleted, not built on
  AUDIT-REPORT.md, TRACEABILITY.md, .gitignore
```

## 2. Current capabilities

**`hunt-app/` (the build target).** Config (`env.ts`, `logger.ts`), Prisma schema (16 models, 19 enums), domain type mirror (`domain/types.ts`, exact 1:1 parity with the schema), a DB client, a source-registry CRUD service, and an adapter base class. No server entrypoint, no routes, no Dockerfile, no migrations, no tests. The Prisma schema does not pass `prisma validate` — five relations are broken or missing an opposite side (`EmailThread`↔Recruiter/Company/Opportunity, `Evidence`↔`OutreachDraft`, `User`↔`Evidence`), `OutreachDraft.targetId` has a hard required FK to `Opportunity` despite being declared polymorphic, `AuditEvent.actor` has an FK on a required field that also holds the literal `"system"`, `Company.name` lacks `@unique` though `seed.ts` upserts on it, and `FollowUp.draftId` actually points at `Reply.id`. `seed.ts` hard-codes a biography (6 named certifications, "200+ applications migrated", "40% cost reduction", a ZAR rate range) that directly violates `docs/01`'s "do not hard-code unverified biography" and ADR-004's evidence requirement — this is stripped in Sprint 1, not carried forward.

**`archive/legacy-hunt/` (formerly `HUNT/`).** Never compiled: `src/models/index.ts` re-exports 12 files that don't exist on disk, and `src/models/opportunity.ts:580` has a literal syntax error (`metaRecord<string, any>;`). Its BIDOPS engine emits hardcoded strings with no AI calls. Its validator registers zero rules, so validation is a silent no-op. Its scoring math divides an already-weighted sum by 6, so no opportunity can mathematically reach "medium" fit. Its `discovery.ts` calls no external API — it selects adapters by substring-matching the source's display name and queries DB tables that are never populated. Both of its deploy scripts (bash and PowerShell) are broken (bash script embeds unexpanded PowerShell variables; PowerShell script mixes a UNC path with `-ToSession`, an invalid combination). **Reusable:** the `Opportunity`/`Recruiter`/`Company`/`CRMRecord` type shapes in `models/opportunity.ts` (once its syntax error is fixed) and the multi-stage `Dockerfile` (once its builder-stage `npm ci --only=production` is fixed to include TypeScript).

**AEOS** (`g:\...\Code\AEOS`) is the mature codebase CLAUDE.md rule 4 points at. It has a genuine, tested **evidence store** (`src/core/evidence-store.ts`, append-only, ADR-041-driven — "a record, once made, is never silently altered") and a genuine **model router** (`src/core/model-router.ts`, 617 lines: circuit breaker, Redis-mirrored circuit state, multi-base-URL failover, cost estimation) with a **freellmapi adapter** already implementing the exact integration this build needs. It has **no Microsoft Graph, MSAL, or Outlook code anywhere** — grepped and confirmed zero hits. HUNT's Graph/reply-intelligence sprints are greenfield.

**freellmapi** — verified live at `192.168.1.195:3010` during this audit (`/api/ping` → `{"status":"ok"}`). `/v1/models` returns 401, so an API key is required before the AI adapter can be exercised.

**Target host (192.168.1.195).** Port-probed during this audit: 5985 (WinRM) open; 22, 2376, 5986, 3001 closed. **3010 (freellmapi) open.** This means Docker must be managed over WinRM — there is no SSH or exposed Docker daemon TCP socket, so the deploy path is a PowerShell remoting session, not `docker context`/`ssh`.

## 3. Conflicts (rule 20 — documented, not silently resolved)

| # | Conflict | Resolution taken |
|---|---|---|
| 1 | `docs/01` forbids hard-coded unverified biography; `seed.ts` ships one anyway, colliding with ADR-004 and `prompts/hallucination-check.md`'s named hazard list (certifications, project numbers, rates) | Stripped from seed; real profile imported later as unapproved evidence, per user decision |
| 2 | `docs/11` specifies `tenant_id` on every model; the shipped Prisma schema has none | Added in Sprint 1 schema repair, defaulting to one tenant |
| 3 | `docs/09`'s approval state chain omits `REJECTED`; the Prisma `DraftStatus` enum includes it | Prisma's superset kept; `docs/09` treated as incomplete, not authoritative, on this point |
| 4 | `AI_MODEL` defaults to `gpt-4o` / `AI_PROVIDER` to `openai` in a Claude Code governance pack, and `package.json` ships the `openai` SDK with no Anthropic dependency | Superseded by user decision: route through freellmapi instead of either |
| 5 | The Hardening Addendum (docs 24–29) was not present in the initially-reviewed doc tree and was discovered only during Sprint 0 exploration; it changes the evidence model from boolean to 5-state and adds quality-gate statuses not in the original scaffold | Folded into the approved plan before any schema code was written — see plan file, "What the Hardening Addendum changes" |
| 6 | ADR-001 was `Proposed`, the only ADR not `Accepted`, while this plan commits to building its architecture | Moved to `Accepted` in Sprint 0 |

## 4. Proposed architecture / DB / API changes

See the approved implementation plan (Sprints 0–7) for the full schema repair list, the addendum-driven quality-gate structures (`EvidenceState`, `Actionability`, `EMAIL_READY`/`OUTREACH_READY`, `ClaimConflict`), the missing models (`SearchRun`/`SourceCoverage`, `FxRate`, `Attachment`, `OAuthToken`, `Suppression`, `DraftValidation`, `PromptTemplate`, `OpportunityCluster`), and the full `docs/15` route surface. Not duplicated here to avoid drift between two copies of the same plan.

## 5. External source / legal / terms risks

Per `docs/22`, only sources with confirmed official-API or official-RSS access are enabled initially: **Jobicy and JobsCollider**. LinkedIn, JobServe, Freelancermap and the Awesome-Remote-Job catalogue remain `PENDING` until their terms, licensing and permitted extraction method are individually reviewed and recorded — "if uncertain, disable the adapter and document the issue." No scraping, CAPTCHA bypass, or anti-bot evasion is implemented against any source.

## 6. Implementation plan

Full 7-sprint plan approved and on file (plan mode, this session). Summary: Sprint 0 (this audit + repo hygiene + safety fixes) → Sprint 1 (schema repair + HUNT engine) → Sprint 2 (recruiter/company intelligence) → Sprint 3 (evidence + BIDOPS via freellmapi) → Sprint 4 (approval + Graph, mocked) → Sprint 5 (reply intelligence) → Sprint 6 (commercial intelligence) → Sprint 7 (hardening, mandatory tests, deploy to 192.168.1.195).

## 7. Blockers / assumptions

- **freellmapi API key** not yet available — blocks Sprint 3's AI adapter from being exercised against the live router (unit tests can still run against a stub).
- **No Entra ID app registration** — Graph stays behind a mock transport, explicitly labelled `NOT VERIFIED IN THIS ENVIRONMENT` per `docs/25`. Phase 1 cannot be called OPERATIONAL (per `docs/29`) until a real Graph send lands in Sent Items.
- **No real profile/evidence data supplied yet** — BIDOPS has nothing to cite until it is imported. This is correct ADR-004 behaviour, not a defect.
- **192.168.1.195 is managed only over WinRM** — the deploy script in Sprint 7 must use PowerShell remoting, not SSH or a Docker TCP context.
- **`Contract ops/` had no git history before this sprint** — `git init` performed in Sprint 0; every subsequent sprint ends with a commit per the `docs/19` sprint rule.
