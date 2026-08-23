-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('DISCOVERED', 'REVIEWED', 'PURSUING', 'NOT_PURSUING', 'CLOSED');

-- CreateTable
CREATE TABLE "procurement_opportunities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "buyer" TEXT NOT NULL,
    "procurementPortal" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "eligibility" TEXT,
    "frameworkDuration" TEXT,
    "supplierRequirements" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'DISCOVERED',
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_opportunities_tenantId_idx" ON "procurement_opportunities"("tenantId");

-- CreateIndex
CREATE INDEX "procurement_opportunities_status_idx" ON "procurement_opportunities"("status");

-- CreateIndex
CREATE INDEX "procurement_opportunities_closingDate_idx" ON "procurement_opportunities"("closingDate");

