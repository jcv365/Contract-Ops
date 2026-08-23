# Testing Strategy

## Required layers

### Unit
Scoring, validation, email rules, ZAR conversion, deduplication, state machines.

### Integration
Source adapters, database, Graph adapter, AI adapter.

### E2E
HUNT → opportunity → BIDOPS → approval → Graph mock → sent record.

## Mandatory tests

1. Unverified email cannot be sent.
2. Inferred email is never accepted as verified.
3. Generic verified email produces company/team greeting.
4. Named verified email permits personal greeting.
5. Duplicate outreach is blocked.
6. Failed send can retry idempotently without duplicate email.
7. Hard-filter failure cannot be actionable.
8. Foreign rate retains original currency and gets timestamped ZAR conversion.
9. Closed opportunity is excluded.
10. Hybrid/onsite role is excluded when remote-only is configured.
11. Mandatory clearance is excluded when clearance is prohibited.
12. Source failure reduces coverage and is visible.
13. AI claim without evidence fails validation.
14. Reply with no rate does not invent one.
15. Reply containing a new opportunity can create a proposed opportunity with email provenance.
16. Tokens never appear in logs.
