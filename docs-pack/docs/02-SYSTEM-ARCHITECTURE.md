# System Architecture

## Logical layers

1. Source Registry
2. Source Adapters
3. HUNT Discovery
4. Normalisation/Deduplication
5. Eligibility/Validation
6. Opportunity Scoring
7. Recruiter & Company Intelligence
8. Evidence Layer
9. BIDOPS
10. Human Approval
11. Microsoft Graph Outreach
12. Reply Intelligence
13. Pipeline/CRM
14. Audit/Observability
15. AEOS integration boundary

## Architecture principles

- API-first.
- Evidence-first.
- Human approval for outbound communication.
- Provider/source abstraction.
- AI provider abstraction.
- Source provenance.
- Idempotent operations.
- Least privilege.
- Testability.
- Incremental implementation.

## External source strategy

Reuse or study existing components from:
- Career-Ops;
- Awesome Remote Job as a source catalogue;
- Jobicy;
- JobsCollider;
- JobSpy/related provider patterns;
- other validated sources discovered during repository audit.

Do not copy a scraper merely because it exists. Verify licensing, terms, reliability and technical feasibility.

## Recommended boundaries

```text
SourceAdapter -> CanonicalOpportunity
RecruiterSource -> CanonicalRecruiter/Contact
Evidence -> BIDOPS
BIDOPS -> OutreachDraft
Approval -> SendCommand
SendCommand -> GraphAdapter
Mailbox -> ReplyEvent
ReplyEvent -> ReplyClassifier -> Opportunity/CRM
```

## SaaS readiness

Use tenant-aware identifiers and data boundaries where cheap to implement, but Phase 1 is single-user. Do not build billing or a multi-tenant UI.
