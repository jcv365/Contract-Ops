# Phase 1 Production Readiness Checklist

Functional: real HUNT search, real coverage calculation, opportunity validation, recruiter/company discovery, email verification, BIDOPS evidence validation, unbypassable approval, real Graph send, reply ingestion if enabled, audit trail.

Security: no secrets in repository/logs, OAuth permissions reviewed, prompt-injection tests pass, PII handling reviewed, access controls tested.

AI: structured outputs validated, unsupported claims rejected, unknown values preserved, conflicts surfaced, model failures fail safely.

Operational proof: at least one real source produces a real opportunity; at least one real recruiter/company reaches verification; at least one approved test email is sent through Graph and appears in Sent Items; a controlled reply is ingested and classified; extracted opportunity retains email provenance.

Only then may Phase 1 be labelled OPERATIONAL.
