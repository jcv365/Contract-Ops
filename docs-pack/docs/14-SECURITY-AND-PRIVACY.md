# Security and Privacy

## Data sensitivity

The system may process:
- CVs;
- professional contact data;
- email metadata/content;
- recruiter personal data;
- OAuth tokens;
- company information;
- opportunity information.

## Requirements

- TLS everywhere;
- encrypted token storage;
- secrets manager/environment secrets;
- no secrets in Git;
- no tokens in logs;
- strict server/client separation;
- input validation;
- output sanitisation;
- RBAC boundary;
- audit logging;
- least privilege;
- deletion/export capability designed for later SaaS;
- configurable retention.

## AI privacy

Do not send unnecessary mailbox contents to AI providers.

For reply analysis:
- minimise content;
- redact unnecessary PII where practical;
- record provider/model used;
- record prompt version;
- record evidence used.

## Source compliance

Do not bypass:
- authentication;
- CAPTCHA;
- robots restrictions where applicable;
- rate limits;
- technical access controls.

Record source terms and adapter compliance notes.
