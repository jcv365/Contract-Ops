-- CreateEnum
CREATE TYPE "EmailVerificationResult" AS ENUM ('VALID', 'INVALID', 'RISKY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmailClassification" AS ENUM ('VERIFIED_NAMED', 'VERIFIED_TEAM', 'VERIFIED_COMPANY', 'UNVERIFIED', 'INVALID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmailSourceKind" AS ENUM ('OFFICIAL_COMPANY_SOURCE', 'OFFICIAL_RECRUITER_PAGE', 'PUBLIC_BUSINESS_SOURCE', 'ENRICHMENT_PROVIDER', 'VERIFICATION_PROVIDER', 'CONTACT_FORM', 'OPERATOR_ENTERED');

-- AlterTable
ALTER TABLE "recruiter_emails" ADD COLUMN     "classification" "EmailClassification" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "normalisedAddress" TEXT,
ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "bounceThreadId" TEXT,
ADD COLUMN     "bounceDetail" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "recruiterEmailId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "result" "EmailVerificationResult" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,
    "conclusive" BOOLEAN NOT NULL DEFAULT false,
    "chainPosition" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_source_observations" (
    "id" TEXT NOT NULL,
    "recruiterEmailId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceKind" "EmailSourceKind" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractionMethod" TEXT NOT NULL,
    "pageTitle" TEXT,
    "contextSnippet" TEXT,
    "contentHash" TEXT NOT NULL,
    "domainMatch" BOOLEAN NOT NULL DEFAULT false,
    "personName" TEXT,
    "robotsAllowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "email_source_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verifications_recruiterEmailId_checkedAt_idx" ON "email_verifications"("recruiterEmailId", "checkedAt");

-- CreateIndex
CREATE INDEX "email_verifications_result_idx" ON "email_verifications"("result");

-- CreateIndex
CREATE INDEX "email_source_observations_recruiterEmailId_idx" ON "email_source_observations"("recruiterEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "email_source_observations_recruiterEmailId_sourceUrl_extr_key" ON "email_source_observations"("recruiterEmailId", "sourceUrl", "extractionMethod");

-- CreateIndex
CREATE INDEX "recruiter_emails_classification_idx" ON "recruiter_emails"("classification");

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_recruiterEmailId_fkey" FOREIGN KEY ("recruiterEmailId") REFERENCES "recruiter_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_source_observations" ADD CONSTRAINT "email_source_observations_recruiterEmailId_fkey" FOREIGN KEY ("recruiterEmailId") REFERENCES "recruiter_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
