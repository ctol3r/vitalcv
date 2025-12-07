-- B195A-MULTIORG-001/003: OrgMembershipV2 + OrgOnboardingRequest tables
-- Adds clinician-scoped memberships with status lifecycle and onboarding requests

DO $$
BEGIN
  CREATE TYPE "OrgMembershipV2Status" AS ENUM ('INVITED', 'PENDING', 'ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OrgOnboardingRequestStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrgMembershipV2" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "OrgMembershipRole" NOT NULL DEFAULT 'VIEWER',
  "membershipStatus" "OrgMembershipV2Status" NOT NULL DEFAULT 'INVITED',
  "joinedAt" TIMESTAMP(3),
  "invitedBy" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgMembershipV2_clinician_org_unique"
  ON "OrgMembershipV2" ("clinicianId", "orgId");
CREATE INDEX IF NOT EXISTS "OrgMembershipV2_clinician_idx"
  ON "OrgMembershipV2" ("clinicianId");
CREATE INDEX IF NOT EXISTS "OrgMembershipV2_org_idx"
  ON "OrgMembershipV2" ("orgId");
CREATE INDEX IF NOT EXISTS "OrgMembershipV2_status_idx"
  ON "OrgMembershipV2" ("membershipStatus");

ALTER TABLE "OrgMembershipV2"
  ADD CONSTRAINT "OrgMembershipV2_clinician_fkey"
  FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE;

ALTER TABLE "OrgMembershipV2"
  ADD CONSTRAINT "OrgMembershipV2_org_fkey"
  FOREIGN KEY ("orgId") REFERENCES "PartnerConfig"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "OrgOnboardingRequest" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "requestedBy" TEXT,
  "requiredPrivileges" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "privilegeNotes" TEXT,
  "ehrSystem" TEXT NOT NULL,
  "ehrConfiguration" JSONB,
  "notes" TEXT,
  "status" "OrgOnboardingRequestStatus" NOT NULL DEFAULT 'PENDING',
  "autoAnalysisTaskId" TEXT,
  "autoAnalysisResult" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OrgOnboardingRequest_clinician_idx"
  ON "OrgOnboardingRequest" ("clinicianId");
CREATE INDEX IF NOT EXISTS "OrgOnboardingRequest_org_idx"
  ON "OrgOnboardingRequest" ("orgId");
CREATE INDEX IF NOT EXISTS "OrgOnboardingRequest_status_idx"
  ON "OrgOnboardingRequest" ("status");
CREATE INDEX IF NOT EXISTS "OrgOnboardingRequest_created_idx"
  ON "OrgOnboardingRequest" ("createdAt");

ALTER TABLE "OrgOnboardingRequest"
  ADD CONSTRAINT "OrgOnboardingRequest_clinician_fkey"
  FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE;

ALTER TABLE "OrgOnboardingRequest"
  ADD CONSTRAINT "OrgOnboardingRequest_org_fkey"
  FOREIGN KEY ("orgId") REFERENCES "PartnerConfig"("id") ON DELETE CASCADE;

