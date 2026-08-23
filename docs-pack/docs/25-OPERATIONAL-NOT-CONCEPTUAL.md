# Operational, Not Conceptual

A feature is implemented only when its real behaviour is proven. A route, UI button, prompt, class or mock is not proof.

Every feature requires implementation, schema validation, error handling, unit tests, integration tests, end-to-end tests where applicable, audit logging, documentation and visible failure states.

Mocks can prove application logic but cannot prove production integration. If real credentials/integration cannot be tested, label it `NOT VERIFIED IN THIS ENVIRONMENT`; never call it production-ready.

Worldwide coverage is calculated from actual successful searches, not configured sources. Failed/unavailable sources reduce reported coverage.

If verification cannot be completed, fail closed: do not upgrade to verified, do not send, show UNKNOWN/NEEDS REVIEW.

A sprint cannot be complete if critical tests fail, provenance is missing, approval can be bypassed, unverified emails can be sent, or source failures are hidden.
