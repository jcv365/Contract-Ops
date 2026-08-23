-- CreateEnum
CREATE TYPE "EvidenceState" AS ENUM ('VERIFIED', 'SOURCE_REPORTED', 'INFERRED', 'UNKNOWN', 'CONFLICTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('JOB_BOARD', 'AGGREGATOR', 'API', 'RSS', 'RECRUITER_WEBSITE', 'COMPANY_CAREERS', 'PROCUREMENT_PORTAL', 'FRAMEWORK_PORTAL', 'PROFESSIONAL_DIRECTORY', 'SOURCE_CATALOGUE');

-- CreateEnum
CREATE TYPE "AdapterStatus" AS ENUM ('PENDING', 'ACTIVE', 'DEGRADED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SearchRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CompanyReadiness" AS ENUM ('NOT_READY', 'OUTREACH_READY');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('CLOUD_CONSULTANCY', 'SYSTEMS_INTEGRATOR', 'PROFESSIONAL_SERVICES', 'SPECIALIST_TECH_CONSULTANCY', 'MANAGED_SERVICES', 'DELIVERY_PARTNER', 'DIRECT_CLIENT', 'RECRUITMENT_AGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "RecruiterReadiness" AS ENUM ('NOT_READY', 'EMAIL_READY');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('UNKNOWN', 'CONTACTED', 'RESPONDED', 'ENGAGED', 'PARTNER', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PERSONAL', 'GENERIC', 'TEAM', 'COMPANY', 'INFERRED');

-- CreateEnum
CREATE TYPE "Actionability" AS ENUM ('ACTIONABLE', 'REVIEW', 'EXCLUDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('FREELANCE', 'CONTRACT', 'SOW', 'PROJECT', 'CONSULTING', 'PERMANENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RemotePolicy" AS ENUM ('FULLY_REMOTE', 'REMOTE_FIRST', 'HYBRID', 'ONSITE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ClearanceLevel" AS ENUM ('NONE', 'BASIC', 'ENHANCED', 'SECURITY_CLEARANCE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WorkAuthorisation" AS ENUM ('ANY', 'SPECIFIC_COUNTRIES', 'VISA_REQUIRED', 'CITIZENSHIP_REQUIRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RatePeriod" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL', 'PROJECT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DISCOVERED', 'VALIDATED', 'SCORED', 'ELIGIBLE', 'INELIGIBLE', 'ARCHIVED', 'APPLIED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('CV', 'COMPANY_PROFILE', 'OTHER');

-- CreateEnum
CREATE TYPE "ValidationCheckResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('RECRUITER', 'COMPANY', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "GreetingMode" AS ENUM ('FIRST_NAME', 'COMPANY_TEAM', 'GENERIC');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRY');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('MICROSOFT_GRAPH');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('DO_NOT_CONTACT', 'BOUNCED', 'UNSUBSCRIBED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReplyClassification" AS ENUM ('INTERESTED', 'OPPORTUNITY', 'REQUEST_CV', 'REQUEST_PROFILE', 'REQUEST_RATE', 'REQUEST_CALL', 'NOT_SUITABLE', 'FUTURE_OPPORTUNITY', 'OUT_OF_OFFICE', 'REJECTED', 'DO_NOT_CONTACT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'DRAFTED', 'APPROVED', 'SENT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "skills" TEXT[],
    "certifications" TEXT[],
    "domains" TEXT[],
    "projects" JSONB NOT NULL DEFAULT '[]',
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "contractPreferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceLocation" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "state" "EvidenceState" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT,
    "country" TEXT,
    "region" TEXT,
    "global" BOOLEAN NOT NULL DEFAULT false,
    "local" BOOLEAN NOT NULL DEFAULT false,
    "apiAvailable" BOOLEAN NOT NULL DEFAULT false,
    "rssAvailable" BOOLEAN NOT NULL DEFAULT false,
    "browserSearchAvailable" BOOLEAN NOT NULL DEFAULT false,
    "mcpAvailable" BOOLEAN NOT NULL DEFAULT false,
    "adapterStatus" "AdapterStatus" NOT NULL DEFAULT 'PENDING',
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "contractRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "remoteRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "internationalRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "termsUrl" TEXT,
    "licence" TEXT,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "rateLimit" INTEGER,
    "lastHealthCheck" TIMESTAMP(3),
    "lastSuccessfulSearch" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_health_checks" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "SearchRunStatus" NOT NULL DEFAULT 'RUNNING',
    "countriesConfigured" TEXT[],
    "regionsConfigured" TEXT[],
    "sourcesConfigured" TEXT[],
    "sourcesSucceeded" TEXT[],
    "sourcesFailed" TEXT[],
    "coveragePercent" DOUBLE PRECISION,
    "totalOpportunitiesFound" INTEGER NOT NULL DEFAULT 0,
    "totalOpportunitiesNew" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_coverage" (
    "id" TEXT NOT NULL,
    "searchRunId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "attempted" BOOLEAN NOT NULL DEFAULT true,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "error" TEXT,

    CONSTRAINT "source_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "regions" TEXT[],
    "type" "CompanyType",
    "specialisms" TEXT[],
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outreachReadiness" "CompanyReadiness" NOT NULL DEFAULT 'NOT_READY',
    "outreachReadinessReason" TEXT,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "specialisms" TEXT[],
    "region" TEXT,
    "publicProfileUrl" TEXT,
    "relationshipStatus" "RelationshipStatus" NOT NULL DEFAULT 'UNKNOWN',
    "outreachReadiness" "RecruiterReadiness" NOT NULL DEFAULT 'NOT_READY',
    "outreachReadinessReason" TEXT,
    "lastContact" TIMESTAMP(3),
    "responseHistory" JSONB NOT NULL DEFAULT '[]',
    "opportunityHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_emails" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT,
    "companyId" TEXT,
    "email" TEXT NOT NULL,
    "emailType" "EmailType" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationSource" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_clusters" (
    "id" TEXT NOT NULL,
    "canonicalOpportunityId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" TEXT,
    "recruiterId" TEXT,
    "clusterId" TEXT,
    "postedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractType" "ContractType",
    "duration" TEXT,
    "remotePolicy" "RemotePolicy",
    "location" TEXT,
    "language" TEXT,
    "clearance" "ClearanceLevel",
    "workAuthorisation" "WorkAuthorisation",
    "originalRate" DOUBLE PRECISION,
    "originalCurrency" TEXT,
    "ratePeriod" "RatePeriod",
    "rateSource" TEXT,
    "zarRate" DOUBLE PRECISION,
    "fxSource" TEXT,
    "fxTimestamp" TIMESTAMP(3),
    "fxRateId" TEXT,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DISCOVERED',
    "actionability" "Actionability" NOT NULL DEFAULT 'UNKNOWN',
    "actionabilityReason" TEXT,
    "eligibilityNotes" TEXT,
    "fitScore" DOUBLE PRECISION,
    "reasons" TEXT[],
    "gaps" TEXT[],
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL DEFAULT 'ZAR',
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageRef" TEXT NOT NULL,
    "checksum" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_attachments" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,

    CONSTRAINT "draft_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_evidence" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "draft_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_validations" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "result" "ValidationCheckResult" NOT NULL,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "promptVersionId" TEXT,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_drafts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "recruiterId" TEXT,
    "companyId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "greetingMode" "GreetingMode" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_approvals" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "outreach_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "graphMessageId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "SendStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL DEFAULT 'MICROSOFT_GRAPH',
    "scopes" TEXT[],
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT,
    "reason" "SuppressionReason" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_conflicts" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedValue" JSONB,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "providerThreadId" TEXT NOT NULL,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "linkedRecruiterId" TEXT,
    "linkedCompanyId" TEXT,
    "linkedOpportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replies" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "graphMessageId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classification" "ReplyClassification" NOT NULL DEFAULT 'UNKNOWN',
    "extractedData" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "replyId" TEXT,
    "draftId" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "actor" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_profileId_key" ON "users"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "evidence_profileId_idx" ON "evidence"("profileId");

-- CreateIndex
CREATE INDEX "evidence_state_idx" ON "evidence"("state");

-- CreateIndex
CREATE UNIQUE INDEX "sources_sourceId_key" ON "sources"("sourceId");

-- CreateIndex
CREATE INDEX "sources_sourceId_idx" ON "sources"("sourceId");

-- CreateIndex
CREATE INDEX "sources_type_idx" ON "sources"("type");

-- CreateIndex
CREATE INDEX "sources_adapterStatus_idx" ON "sources"("adapterStatus");

-- CreateIndex
CREATE INDEX "source_health_checks_sourceId_idx" ON "source_health_checks"("sourceId");

-- CreateIndex
CREATE INDEX "source_health_checks_checkedAt_idx" ON "source_health_checks"("checkedAt");

-- CreateIndex
CREATE INDEX "search_runs_tenantId_idx" ON "search_runs"("tenantId");

-- CreateIndex
CREATE INDEX "search_runs_startedAt_idx" ON "search_runs"("startedAt");

-- CreateIndex
CREATE INDEX "search_runs_status_idx" ON "search_runs"("status");

-- CreateIndex
CREATE INDEX "source_coverage_searchRunId_idx" ON "source_coverage"("searchRunId");

-- CreateIndex
CREATE INDEX "source_coverage_sourceId_idx" ON "source_coverage"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_tenantId_idx" ON "companies"("tenantId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_country_idx" ON "companies"("country");

-- CreateIndex
CREATE INDEX "companies_type_idx" ON "companies"("type");

-- CreateIndex
CREATE INDEX "recruiters_tenantId_idx" ON "recruiters"("tenantId");

-- CreateIndex
CREATE INDEX "recruiters_companyId_idx" ON "recruiters"("companyId");

-- CreateIndex
CREATE INDEX "recruiters_name_idx" ON "recruiters"("name");

-- CreateIndex
CREATE INDEX "recruiters_region_idx" ON "recruiters"("region");

-- CreateIndex
CREATE INDEX "recruiter_emails_recruiterId_idx" ON "recruiter_emails"("recruiterId");

-- CreateIndex
CREATE INDEX "recruiter_emails_companyId_idx" ON "recruiter_emails"("companyId");

-- CreateIndex
CREATE INDEX "recruiter_emails_verified_idx" ON "recruiter_emails"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_emails_email_key" ON "recruiter_emails"("email");

-- CreateIndex
CREATE INDEX "opportunity_clusters_fingerprint_idx" ON "opportunity_clusters"("fingerprint");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_idx" ON "opportunities"("tenantId");

-- CreateIndex
CREATE INDEX "opportunities_sourceId_idx" ON "opportunities"("sourceId");

-- CreateIndex
CREATE INDEX "opportunities_companyId_idx" ON "opportunities"("companyId");

-- CreateIndex
CREATE INDEX "opportunities_recruiterId_idx" ON "opportunities"("recruiterId");

-- CreateIndex
CREATE INDEX "opportunities_clusterId_idx" ON "opportunities"("clusterId");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_actionability_idx" ON "opportunities"("actionability");

-- CreateIndex
CREATE INDEX "opportunities_discoveredAt_idx" ON "opportunities"("discoveredAt");

-- CreateIndex
CREATE INDEX "opportunities_fitScore_idx" ON "opportunities"("fitScore");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_sourceId_externalId_key" ON "opportunities"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "fx_rates_fromCurrency_toCurrency_fetchedAt_idx" ON "fx_rates"("fromCurrency", "toCurrency", "fetchedAt");

-- CreateIndex
CREATE INDEX "attachments_kind_idx" ON "attachments"("kind");

-- CreateIndex
CREATE INDEX "draft_attachments_draftId_idx" ON "draft_attachments"("draftId");

-- CreateIndex
CREATE INDEX "draft_attachments_attachmentId_idx" ON "draft_attachments"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "draft_attachments_draftId_attachmentId_key" ON "draft_attachments"("draftId", "attachmentId");

-- CreateIndex
CREATE INDEX "draft_evidence_draftId_idx" ON "draft_evidence"("draftId");

-- CreateIndex
CREATE INDEX "draft_evidence_evidenceId_idx" ON "draft_evidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "draft_evidence_draftId_evidenceId_key" ON "draft_evidence"("draftId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_name_version_key" ON "prompt_templates"("name", "version");

-- CreateIndex
CREATE INDEX "draft_validations_draftId_idx" ON "draft_validations"("draftId");

-- CreateIndex
CREATE INDEX "outreach_drafts_tenantId_idx" ON "outreach_drafts"("tenantId");

-- CreateIndex
CREATE INDEX "outreach_drafts_targetType_targetId_idx" ON "outreach_drafts"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "outreach_drafts_status_idx" ON "outreach_drafts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_approvals_draftId_key" ON "outreach_approvals"("draftId");

-- CreateIndex
CREATE INDEX "outreach_approvals_draftId_idx" ON "outreach_approvals"("draftId");

-- CreateIndex
CREATE INDEX "outreach_approvals_userId_idx" ON "outreach_approvals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_draftId_key" ON "email_sends"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_idempotencyKey_key" ON "email_sends"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_sends_draftId_idx" ON "email_sends"("draftId");

-- CreateIndex
CREATE INDEX "email_sends_idempotencyKey_idx" ON "email_sends"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_sends_status_idx" ON "email_sends"("status");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_userId_provider_key" ON "oauth_tokens"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "suppressions_email_key" ON "suppressions"("email");

-- CreateIndex
CREATE INDEX "suppressions_domain_idx" ON "suppressions"("domain");

-- CreateIndex
CREATE INDEX "claim_conflicts_entityType_entityId_idx" ON "claim_conflicts"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "claim_conflicts_status_idx" ON "claim_conflicts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_providerThreadId_key" ON "email_threads"("providerThreadId");

-- CreateIndex
CREATE INDEX "email_threads_tenantId_idx" ON "email_threads"("tenantId");

-- CreateIndex
CREATE INDEX "email_threads_providerThreadId_idx" ON "email_threads"("providerThreadId");

-- CreateIndex
CREATE INDEX "email_threads_linkedRecruiterId_idx" ON "email_threads"("linkedRecruiterId");

-- CreateIndex
CREATE INDEX "email_threads_linkedCompanyId_idx" ON "email_threads"("linkedCompanyId");

-- CreateIndex
CREATE INDEX "email_threads_linkedOpportunityId_idx" ON "email_threads"("linkedOpportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "replies_graphMessageId_key" ON "replies"("graphMessageId");

-- CreateIndex
CREATE INDEX "replies_threadId_idx" ON "replies"("threadId");

-- CreateIndex
CREATE INDEX "replies_classification_idx" ON "replies"("classification");

-- CreateIndex
CREATE INDEX "replies_receivedAt_idx" ON "replies"("receivedAt");

-- CreateIndex
CREATE INDEX "follow_ups_targetId_idx" ON "follow_ups"("targetId");

-- CreateIndex
CREATE INDEX "follow_ups_dueAt_idx" ON "follow_ups"("dueAt");

-- CreateIndex
CREATE INDEX "follow_ups_status_idx" ON "follow_ups"("status");

-- CreateIndex
CREATE INDEX "audit_events_tenantId_idx" ON "audit_events"("tenantId");

-- CreateIndex
CREATE INDEX "audit_events_actor_idx" ON "audit_events"("actor");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events"("timestamp");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_health_checks" ADD CONSTRAINT "source_health_checks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_coverage" ADD CONSTRAINT "source_coverage_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_coverage" ADD CONSTRAINT "source_coverage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_emails" ADD CONSTRAINT "recruiter_emails_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_emails" ADD CONSTRAINT "recruiter_emails_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "opportunity_clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "fx_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_attachments" ADD CONSTRAINT "draft_attachments_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "outreach_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_attachments" ADD CONSTRAINT "draft_attachments_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_evidence" ADD CONSTRAINT "draft_evidence_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "outreach_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_evidence" ADD CONSTRAINT "draft_evidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_validations" ADD CONSTRAINT "draft_validations_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "outreach_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_approvals" ADD CONSTRAINT "outreach_approvals_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "outreach_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_approvals" ADD CONSTRAINT "outreach_approvals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "outreach_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_linkedRecruiterId_fkey" FOREIGN KEY ("linkedRecruiterId") REFERENCES "recruiters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_linkedCompanyId_fkey" FOREIGN KEY ("linkedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_linkedOpportunityId_fkey" FOREIGN KEY ("linkedOpportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replies" ADD CONSTRAINT "replies_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "outreach_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

