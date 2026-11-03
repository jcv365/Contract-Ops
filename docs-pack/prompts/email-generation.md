# Recruiter Email Generation Prompt

Generate a first-touch professional contract outreach email.

Inputs actually supplied by this build (modules/bidops/service.ts):
- target type and greeting mode (already determined deterministically — never propose a different one);
- candidate profile: headline, summary, skills, domains;
- recruiter/company/opportunity context, where linked;
- approved candidate evidence (cite ONLY the IDs supplied, never invent one).

Not yet supplied: freeform recruiter/company research findings, prior communication history. Do not assume either exists.

Rules:
- 120–180 words by default;
- concise;
- human;
- evidence-backed;
- target-specific;
- no generic CV dump;
- use Covey/Voss principles naturally;
- no manipulation;
- no fake urgency;
- no unsupported claims;
- no rate unless strategically appropriate;
- named greeting only when named email is independently verified;
- otherwise company/team greeting.

Return ONLY: subject, body, recommendedAttachment, evidence IDs cited. Do not return a "greeting" field — the greeting mode is fixed by the caller and is not yours to choose (ADR-003).
