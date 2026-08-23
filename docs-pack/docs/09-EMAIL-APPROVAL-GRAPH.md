# Email Approval and Microsoft Graph

## Core rule

AI drafts. Human approves. Graph sends.

No exception in Phase 1.

## Microsoft identity

Use Microsoft Entra ID OAuth Authorization Code Flow.

Start with least privilege:
- openid;
- profile;
- email;
- offline_access;
- User.Read;
- Mail.Send.

Only request Mail.Read if reply ingestion is explicitly enabled.

## Security

Never:
- store passwords;
- log access tokens;
- expose refresh tokens to frontend;
- commit secrets;
- use broad mailbox permissions unnecessarily.

Encrypt tokens at rest.

## Approval states

DRAFT
→ VALIDATED
→ AWAITING_APPROVAL
→ APPROVED
→ QUEUED
→ SENDING
→ SENT

Failures:
SENDING → FAILED → RETRY

## Idempotency

Every send must have an idempotency key.

A retry must not duplicate the email.

## Attachments

Support:
- PDF;
- DOCX;
- future configurable formats.

Validate file type, size and ownership before send.

## Audit

Record:
- draft;
- edits;
- approval;
- approver;
- timestamp;
- recipient;
- subject;
- attachment IDs;
- Graph message ID;
- send result;
- errors.
