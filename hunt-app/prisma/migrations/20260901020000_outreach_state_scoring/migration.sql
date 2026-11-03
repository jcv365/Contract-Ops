-- CreateEnum
CREATE TYPE "OutreachState" AS ENUM ('DISCOVERED', 'RESEARCHING', 'CONTACT_IDENTIFIED', 'EMAIL_FOUND', 'EMAIL_VERIFIED', 'OUTREACH_READY', 'DRAFTED', 'AWAITING_APPROVAL', 'CONTACTED', 'RESPONDED', 'FOLLOW_UP', 'CONTACT_FORM_AVAILABLE', 'NO_USABLE_CONTACT', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "ContactRoleCategory" AS ENUM ('RECRUITER_ROLE', 'COMPANY_DECISION_ROLE', 'HR_ROLE', 'OTHER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "outreachState" "OutreachState" NOT NULL DEFAULT 'DISCOVERED',
ADD COLUMN     "outreachStateReason" TEXT,
ADD COLUMN     "outreachStateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "targetScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "targetScoreBreakdown" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "recruiters" ADD COLUMN     "outreachState" "OutreachState" NOT NULL DEFAULT 'DISCOVERED',
ADD COLUMN     "outreachStateReason" TEXT,
ADD COLUMN     "outreachStateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "roleCategory" "ContactRoleCategory" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "contactQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "contactQualityBreakdown" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "targetScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "targetScoreBreakdown" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "outreach_state_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromState" "OutreachState",
    "toState" "OutreachState" NOT NULL,
    "trigger" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outreach_state_events_entityType_entityId_createdAt_idx" ON "outreach_state_events"("entityType", "entityId", "createdAt");
