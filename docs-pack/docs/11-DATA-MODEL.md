# Phase 1 Data Model

## Core entities

### User
id, profile_id, settings, created_at, updated_at

### Profile
headline, summary, skills, certifications, domains, projects, achievements, contract_preferences

### Evidence
id, profile_id, claim, source, source_location, confidence, approved, created_at

### Company
id, name, website, country, regions, type, specialisms, score, provenance

### Recruiter
id, company_id, name, title, specialisms, region, public_profile_url, relationship_status

### RecruiterEmail
id, recruiter_id/company_id, email, email_type, verified, verification_source, verified_at

### Opportunity
id, source_id, external_id, URL, title, company_id, recruiter_id, posted_at, discovered_at, contract_type, duration, remote_policy, location, language, clearance, work_authorisation, original_rate, original_currency, rate_period, zar_rate, fx_source, fx_timestamp, scores, status

### Source
see Source Registry

### OutreachDraft
id, target_type, target_id, recipient_email, greeting_mode, subject, body, evidence_ids, attachment_ids, prompt_version, status

### OutreachApproval
id, draft_id, decision, user_id, timestamp, notes

### EmailSend
id, draft_id, graph_message_id, idempotency_key, status, sent_at, error

### EmailThread
id, provider_thread_id, participants, linked_recruiter, linked_company, linked_opportunity

### Reply
id, thread_id, graph_message_id, received_at, classification, extracted_data, confidence

### FollowUp
id, target_id, due_at, draft_id, status

### AuditEvent
actor, action, entity_type, entity_id, timestamp, metadata

## Tenant readiness

Use tenant_id fields where inexpensive, defaulting to one tenant in Phase 1. Do not build multi-tenant UI yet.
