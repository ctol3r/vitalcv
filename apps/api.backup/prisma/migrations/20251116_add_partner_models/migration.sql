-- B248A-PARTNER-001: Add PartnerProfile table
-- B248A-PARTNER-002: Add ContactPerson table
-- B248A-PARTNER-003: Add PartnershipAgreement table
-- B248A-PARTNER-005: Add PartnerStatus enum
-- B248A-PARTNER-006: Add PartnershipPolicy table
-- B248A-PARTNER-009: Add PartnerAuditLog table

-- Create PartnerStatus enum
CREATE TYPE "PartnerStatus" AS ENUM ('draft', 'under_review', 'approved', 'active', 'suspended', 'terminated');

-- Create AgreementType enum
CREATE TYPE "AgreementType" AS ENUM ('NDA', 'contract');

-- Create AgreementStatus enum
CREATE TYPE "AgreementStatus" AS ENUM ('draft', 'submitted', 'active', 'expired');

-- Create AuditAction enum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete');

-- Create PartnerProfile table
CREATE TABLE IF NOT EXISTS "PartnerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "status" "PartnerStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- Create ContactPerson table
CREATE TABLE IF NOT EXISTS "ContactPerson" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

-- Create PartnershipAgreement table
CREATE TABLE IF NOT EXISTS "PartnershipAgreement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "agreementType" "AgreementType" NOT NULL,
    "documentId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "AgreementStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipAgreement_pkey" PRIMARY KEY ("id")
);

-- Create PartnershipPolicy table
CREATE TABLE IF NOT EXISTS "PartnershipPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipPolicy_pkey" PRIMARY KEY ("id")
);

-- Create PartnerAuditLog table
CREATE TABLE IF NOT EXISTS "PartnerAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "partnerId" TEXT,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "changes" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAuditLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for PartnerProfile
CREATE INDEX IF NOT EXISTS "PartnerProfile_type_idx" ON "PartnerProfile"("type");
CREATE INDEX IF NOT EXISTS "PartnerProfile_status_idx" ON "PartnerProfile"("status");
CREATE INDEX IF NOT EXISTS "PartnerProfile_createdAt_idx" ON "PartnerProfile"("createdAt");

-- Create indexes for ContactPerson
CREATE INDEX IF NOT EXISTS "ContactPerson_partnerId_idx" ON "ContactPerson"("partnerId");
CREATE INDEX IF NOT EXISTS "ContactPerson_role_idx" ON "ContactPerson"("role");
CREATE INDEX IF NOT EXISTS "ContactPerson_email_idx" ON "ContactPerson"("email");

-- Create indexes for PartnershipAgreement
CREATE INDEX IF NOT EXISTS "PartnershipAgreement_partnerId_idx" ON "PartnershipAgreement"("partnerId");
CREATE INDEX IF NOT EXISTS "PartnershipAgreement_agreementType_idx" ON "PartnershipAgreement"("agreementType");
CREATE INDEX IF NOT EXISTS "PartnershipAgreement_status_idx" ON "PartnershipAgreement"("status");
CREATE INDEX IF NOT EXISTS "PartnershipAgreement_startDate_idx" ON "PartnershipAgreement"("startDate");
CREATE INDEX IF NOT EXISTS "PartnershipAgreement_endDate_idx" ON "PartnershipAgreement"("endDate");

-- Create indexes for PartnershipPolicy
CREATE INDEX IF NOT EXISTS "PartnershipPolicy_version_idx" ON "PartnershipPolicy"("version");
CREATE INDEX IF NOT EXISTS "PartnershipPolicy_publishedAt_idx" ON "PartnershipPolicy"("publishedAt");

-- Create indexes for PartnerAuditLog
CREATE INDEX IF NOT EXISTS "PartnerAuditLog_entityType_entityId_idx" ON "PartnerAuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "PartnerAuditLog_partnerId_idx" ON "PartnerAuditLog"("partnerId");
CREATE INDEX IF NOT EXISTS "PartnerAuditLog_action_idx" ON "PartnerAuditLog"("action");
CREATE INDEX IF NOT EXISTS "PartnerAuditLog_timestamp_idx" ON "PartnerAuditLog"("timestamp");
CREATE INDEX IF NOT EXISTS "PartnerAuditLog_userId_idx" ON "PartnerAuditLog"("userId");

-- Add foreign key constraints
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnershipAgreement" ADD CONSTRAINT "PartnershipAgreement_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerAuditLog" ADD CONSTRAINT "PartnerAuditLog_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

