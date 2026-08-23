# Phase 1 Security Threat Model

Threats: prompt injection, malicious recruiter email, OAuth token theft, AI data leakage, email abuse, source-terms violations, hallucination and future tenant leakage.

Controls: treat external content as data; never execute embedded instructions; sanitize email content; no autonomous actions; encrypted OAuth storage; no secret logging; least privilege; minimise data sent to AI providers; human approval; recipient verification; duplicate protection; suppression list; source compliance records; evidence validation; deterministic fail-closed rules; tenant boundaries and authorization tests.
