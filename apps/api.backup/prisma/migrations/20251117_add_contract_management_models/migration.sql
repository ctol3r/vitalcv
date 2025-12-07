-- B251A-CON-001: Add Contract model
-- B251A-CON-002: Add ContractVersion model
-- B251A-CON-003: Add ContractParty model
-- B251A-CON-004: Update ContractTemplate with slug and variables
-- B251A-CON-005: Add ContractVariable model
-- B251A-CON-006: Add ContractChangeRequest model
-- B251A-CON-007: Add ContractAuditLog model
-- B251A-CON-008: Add ContractTag and ContractTagMap models
-- B251A-CON-009: Add ContractSchedule model

-- Create enums
CREATE TYPE "ContractType" AS ENUM ('NDA', 'SERVICE', 'PARTNERSHIP', 'EMPLOYMENT', 'VENDOR', 'OTHER');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'ACTIVE', 'TERMINATED', 'EXPIRED');
CREATE TYPE "ContractPartyRole" AS ENUM ('SIGNER', 'WITNESS', 'OBSERVER');
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED');
CREATE TYPE "VariableValueType" AS ENUM ('STRING', 'DATE', 'NUMBER');
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ContractEventType" AS ENUM ('CREATED', 'SIGNED', 'REVISED', 'TERMINATED', 'EXPIRED', 'STATUS_CHANGED', 'PARTY_ADDED', 'PARTY_REMOVED');
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'COMPLETED');

-- Update ContractTemplate table: add slug and variables
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "variables" JSONB;
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "versionNumber" TEXT DEFAULT '1.0.0';

-- Add unique constraint on slug for ContractTemplate
CREATE UNIQUE INDEX IF NOT EXISTS "ContractTemplate_slug_key" ON "ContractTemplate"("slug");
CREATE INDEX IF NOT EXISTS "ContractTemplate_slug_idx" ON "ContractTemplate"("slug");

-- Create Contract table
CREATE TABLE IF NOT EXISTS "Contract" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "currentVersionId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- Create ContractVersion table
CREATE TABLE IF NOT EXISTS "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "changeSummary" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- Create ContractParty table
CREATE TABLE IF NOT EXISTS "ContractParty" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "organizationId" TEXT,
    "partnerId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "role" "ContractPartyRole" NOT NULL,
    "signatureStatus" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- Create ContractVariable table
CREATE TABLE IF NOT EXISTS "ContractVariable" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valueType" "VariableValueType" NOT NULL DEFAULT 'STRING',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,

    CONSTRAINT "ContractVariable_pkey" PRIMARY KEY ("id")
);

-- Create ContractChangeRequest table
CREATE TABLE IF NOT EXISTS "ContractChangeRequest" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionBy" TEXT,
    "decisionAt" TIMESTAMP(3),

    CONSTRAINT "ContractChangeRequest_pkey" PRIMARY KEY ("id")
);

-- Create ContractAuditLog table
CREATE TABLE IF NOT EXISTS "ContractAuditLog" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "eventType" "ContractEventType" NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "ContractAuditLog_pkey" PRIMARY KEY ("id")
);

-- Create ContractTag table
CREATE TABLE IF NOT EXISTS "ContractTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ContractTag_pkey" PRIMARY KEY ("id")
);

-- Create ContractTagMap table (join table)
CREATE TABLE IF NOT EXISTS "ContractTagMap" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractTagMap_pkey" PRIMARY KEY ("id")
);

-- Create ContractSchedule table
CREATE TABLE IF NOT EXISTS "ContractSchedule" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSchedule_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Contract
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_slug_key" ON "Contract"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_currentVersionId_key" ON "Contract"("currentVersionId");
CREATE INDEX IF NOT EXISTS "Contract_slug_idx" ON "Contract"("slug");
CREATE INDEX IF NOT EXISTS "Contract_type_idx" ON "Contract"("type");
CREATE INDEX IF NOT EXISTS "Contract_status_idx" ON "Contract"("status");
CREATE INDEX IF NOT EXISTS "Contract_authorId_idx" ON "Contract"("authorId");
CREATE INDEX IF NOT EXISTS "Contract_effectiveDate_idx" ON "Contract"("effectiveDate");
CREATE INDEX IF NOT EXISTS "Contract_expirationDate_idx" ON "Contract"("expirationDate");
CREATE INDEX IF NOT EXISTS "Contract_currentVersionId_idx" ON "Contract"("currentVersionId");

-- Create indexes for ContractVersion
CREATE UNIQUE INDEX IF NOT EXISTS "ContractVersion_contractId_versionNumber_key" ON "ContractVersion"("contractId", "versionNumber");
CREATE INDEX IF NOT EXISTS "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");
CREATE INDEX IF NOT EXISTS "ContractVersion_versionNumber_idx" ON "ContractVersion"("versionNumber");
CREATE INDEX IF NOT EXISTS "ContractVersion_authorId_idx" ON "ContractVersion"("authorId");
CREATE INDEX IF NOT EXISTS "ContractVersion_createdAt_idx" ON "ContractVersion"("createdAt");

-- Create indexes for ContractParty
CREATE INDEX IF NOT EXISTS "ContractParty_contractId_idx" ON "ContractParty"("contractId");
CREATE INDEX IF NOT EXISTS "ContractParty_organizationId_idx" ON "ContractParty"("organizationId");
CREATE INDEX IF NOT EXISTS "ContractParty_partnerId_idx" ON "ContractParty"("partnerId");
CREATE INDEX IF NOT EXISTS "ContractParty_signatureStatus_idx" ON "ContractParty"("signatureStatus");
CREATE INDEX IF NOT EXISTS "ContractParty_role_idx" ON "ContractParty"("role");

-- Create indexes for ContractVariable
CREATE UNIQUE INDEX IF NOT EXISTS "ContractVariable_templateId_name_key" ON "ContractVariable"("templateId", "name");
CREATE INDEX IF NOT EXISTS "ContractVariable_templateId_idx" ON "ContractVariable"("templateId");
CREATE INDEX IF NOT EXISTS "ContractVariable_name_idx" ON "ContractVariable"("name");

-- Create indexes for ContractChangeRequest
CREATE INDEX IF NOT EXISTS "ContractChangeRequest_contractId_idx" ON "ContractChangeRequest"("contractId");
CREATE INDEX IF NOT EXISTS "ContractChangeRequest_requestedBy_idx" ON "ContractChangeRequest"("requestedBy");
CREATE INDEX IF NOT EXISTS "ContractChangeRequest_status_idx" ON "ContractChangeRequest"("status");
CREATE INDEX IF NOT EXISTS "ContractChangeRequest_createdAt_idx" ON "ContractChangeRequest"("createdAt");

-- Create indexes for ContractAuditLog
CREATE INDEX IF NOT EXISTS "ContractAuditLog_contractId_idx" ON "ContractAuditLog"("contractId");
CREATE INDEX IF NOT EXISTS "ContractAuditLog_eventType_idx" ON "ContractAuditLog"("eventType");
CREATE INDEX IF NOT EXISTS "ContractAuditLog_userId_idx" ON "ContractAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "ContractAuditLog_timestamp_idx" ON "ContractAuditLog"("timestamp");

-- Create indexes for ContractTag
CREATE UNIQUE INDEX IF NOT EXISTS "ContractTag_name_key" ON "ContractTag"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "ContractTag_slug_key" ON "ContractTag"("slug");
CREATE INDEX IF NOT EXISTS "ContractTag_slug_idx" ON "ContractTag"("slug");
CREATE INDEX IF NOT EXISTS "ContractTag_name_idx" ON "ContractTag"("name");

-- Create indexes for ContractTagMap
CREATE UNIQUE INDEX IF NOT EXISTS "ContractTagMap_contractId_tagId_key" ON "ContractTagMap"("contractId", "tagId");
CREATE INDEX IF NOT EXISTS "ContractTagMap_contractId_idx" ON "ContractTagMap"("contractId");
CREATE INDEX IF NOT EXISTS "ContractTagMap_tagId_idx" ON "ContractTagMap"("tagId");

-- Create indexes for ContractSchedule
CREATE INDEX IF NOT EXISTS "ContractSchedule_contractId_idx" ON "ContractSchedule"("contractId");
CREATE INDEX IF NOT EXISTS "ContractSchedule_dueDate_idx" ON "ContractSchedule"("dueDate");
CREATE INDEX IF NOT EXISTS "ContractSchedule_status_idx" ON "ContractSchedule"("status");

-- Add foreign key constraints
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_currentVersionId_fkey"
    FOREIGN KEY ("currentVersionId") REFERENCES "ContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractVariable" ADD CONSTRAINT "ContractVariable_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractChangeRequest" ADD CONSTRAINT "ContractChangeRequest_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractAuditLog" ADD CONSTRAINT "ContractAuditLog_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractTagMap" ADD CONSTRAINT "ContractTagMap_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractTagMap" ADD CONSTRAINT "ContractTagMap_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "ContractTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractSchedule" ADD CONSTRAINT "ContractSchedule_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

