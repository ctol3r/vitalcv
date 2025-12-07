-- B224B-REP-006: Add ReputationSharingPolicy model
-- B224B-REP-008: Add FairnessAuditReport model
-- B224B-REP-009: Add DataDeletionRequest model
-- B224B-REP-010: Add ReputationComplianceCheck model

-- Create RecipientType enum
CREATE TYPE "RecipientType" AS ENUM ('BOARD', 'PAYER', 'EMPLOYER');

-- Create ReputationSharingPolicy table
CREATE TABLE IF NOT EXISTS "ReputationSharingPolicy" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "recipientType" "RecipientType" NOT NULL,
    "recipientId" TEXT,
    "allowedMetrics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentGivenAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReputationSharingPolicy_pkey" PRIMARY KEY ("id")
);

-- Create DataDeletionRequest table
CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'DELETION',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "exportUrl" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- Create FairnessAuditReport table
CREATE TABLE IF NOT EXISTS "FairnessAuditReport" (
    "id" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "protectedClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "biasesDetected" JSONB,
    "recommendations" JSONB,
    "reportHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FairnessAuditReport_pkey" PRIMARY KEY ("id")
);

-- Create ReputationComplianceCheck table
CREATE TABLE IF NOT EXISTS "ReputationComplianceCheck" (
    "id" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkType" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PASS',
    "violations" JSONB,
    "alerts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ReputationSharingPolicy
CREATE INDEX IF NOT EXISTS "ReputationSharingPolicy_clinicianId_idx" ON "ReputationSharingPolicy"("clinicianId");
CREATE INDEX IF NOT EXISTS "ReputationSharingPolicy_recipientType_idx" ON "ReputationSharingPolicy"("recipientType");
CREATE INDEX IF NOT EXISTS "ReputationSharingPolicy_recipientId_idx" ON "ReputationSharingPolicy"("recipientId");
CREATE INDEX IF NOT EXISTS "ReputationSharingPolicy_consentGiven_idx" ON "ReputationSharingPolicy"("consentGiven");
CREATE INDEX IF NOT EXISTS "ReputationSharingPolicy_expiryDate_idx" ON "ReputationSharingPolicy"("expiryDate");
CREATE UNIQUE INDEX IF NOT EXISTS "ReputationSharingPolicy_clinicianId_recipientType_recipientId_key" ON "ReputationSharingPolicy"("clinicianId", "recipientType", "recipientId");

-- Create indexes for DataDeletionRequest
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_clinicianId_idx" ON "DataDeletionRequest"("clinicianId");
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_requestType_idx" ON "DataDeletionRequest"("requestType");
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_status_idx" ON "DataDeletionRequest"("status");
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_requestedAt_idx" ON "DataDeletionRequest"("requestedAt");

-- Create indexes for FairnessAuditReport
CREATE INDEX IF NOT EXISTS "FairnessAuditReport_auditDate_idx" ON "FairnessAuditReport"("auditDate");
CREATE INDEX IF NOT EXISTS "FairnessAuditReport_periodStart_idx" ON "FairnessAuditReport"("periodStart");
CREATE INDEX IF NOT EXISTS "FairnessAuditReport_periodEnd_idx" ON "FairnessAuditReport"("periodEnd");

-- Create indexes for ReputationComplianceCheck
CREATE INDEX IF NOT EXISTS "ReputationComplianceCheck_checkDate_idx" ON "ReputationComplianceCheck"("checkDate");
CREATE INDEX IF NOT EXISTS "ReputationComplianceCheck_checkType_idx" ON "ReputationComplianceCheck"("checkType");
CREATE INDEX IF NOT EXISTS "ReputationComplianceCheck_jurisdiction_idx" ON "ReputationComplianceCheck"("jurisdiction");
CREATE INDEX IF NOT EXISTS "ReputationComplianceCheck_status_idx" ON "ReputationComplianceCheck"("status");

