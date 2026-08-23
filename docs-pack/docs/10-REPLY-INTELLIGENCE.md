# Reply Intelligence

## Purpose

Turn mailbox replies into actionable contract intelligence.

## Flow

Microsoft Graph mailbox
→ message ingestion
→ thread detection
→ classification
→ entity extraction
→ CRM/HUNT update
→ next-action recommendation.

## Classifications

- INTERESTED
- OPPORTUNITY
- REQUEST_CV
- REQUEST_PROFILE
- REQUEST_RATE
- REQUEST_CALL
- NOT_SUITABLE
- FUTURE_OPPORTUNITY
- OUT_OF_OFFICE
- REJECTED
- DO_NOT_CONTACT
- UNKNOWN

## Extract

Where available:
- role;
- client;
- start date;
- duration;
- rate;
- currency;
- remote policy;
- location;
- work authorisation;
- clearance;
- technologies;
- next action;
- deadline.

Never invent missing values.

## High-value reply

If a reply appears to contain a new opportunity, create a proposed HUNT opportunity with source provenance:
- email thread;
- sender;
- received timestamp.

Human review may be required before promoting it to an actionable opportunity.
