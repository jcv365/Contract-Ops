-- CreateTable
CREATE TABLE "site_compliance_policies" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "robotsFetchedAt" TIMESTAMP(3),
    "robotsStatus" TEXT,
    "robotsBody" TEXT,
    "crawlDelaySeconds" INTEGER,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 6,
    "termsUrl" TEXT,
    "licence" TEXT,
    "permittedMethod" TEXT,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "redistributionNotes" TEXT,
    "privacyNotes" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "status" "AdapterStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_compliance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_fetch_logs" (
    "id" TEXT NOT NULL,
    "policyId" TEXT,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "httpStatus" INTEGER,
    "robotsAllowed" BOOLEAN NOT NULL,
    "contentHash" TEXT,
    "bytes" INTEGER,
    "latencyMs" INTEGER,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_fetch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_compliance_policies_domain_key" ON "site_compliance_policies"("domain");

-- CreateIndex
CREATE INDEX "site_compliance_policies_status_idx" ON "site_compliance_policies"("status");

-- CreateIndex
CREATE INDEX "web_fetch_logs_url_fetchedAt_idx" ON "web_fetch_logs"("url", "fetchedAt");

-- CreateIndex
CREATE INDEX "web_fetch_logs_policyId_idx" ON "web_fetch_logs"("policyId");

-- AddForeignKey
ALTER TABLE "web_fetch_logs" ADD CONSTRAINT "web_fetch_logs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "site_compliance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
