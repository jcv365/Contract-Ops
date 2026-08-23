# API Contracts — Phase 1

Use REST or the repository's existing API convention.

## Source

GET /sources
POST /sources/health-check

## Hunt

POST /hunt/run
GET /opportunities
GET /opportunities/:id
POST /opportunities/:id/revalidate

## Recruiters

GET /recruiters
POST /recruiters
POST /recruiters/:id/verify-email
GET /recruiters/:id

## Companies

GET /companies
POST /companies
GET /companies/:id

## BIDOPS

POST /bidops/research
POST /bidops/draft
POST /bidops/review

## Outreach

GET /outreach/queue
POST /outreach/:draft_id/approve
POST /outreach/:draft_id/reject
POST /outreach/:draft_id/send

## Replies

GET /replies
POST /replies/:id/classify
POST /replies/:id/promote-to-opportunity

## Audit

GET /audit

Exact schemas should be generated using the repository's existing validation/API conventions. Use typed request/response schemas and reject unknown unsafe input.
