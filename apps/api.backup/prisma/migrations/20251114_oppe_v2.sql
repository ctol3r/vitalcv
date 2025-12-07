-- B170C-OPPE-V2: Next-gen OPPE scheduling + case tracking
-- Adds typed OPPE case enum, schedule v2 table with metrics config, and OPPECase ledger

DO $$
BEGIN
  CREATE TYPE "OPPECaseStatus" AS ENUM ('OPEN', 'REVIEWING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OPPEScheduleV2" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "frequencyMonths" INTEGER NOT NULL DEFAULT 12,
  "nextDueAt" TIMESTAMP(3),
  "metricsConfig" JSONB,
  "lastCaseGeneratedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OPPEScheduleV2_clinician_org_unique" UNIQUE("clinicianId", "orgId")
);

CREATE INDEX IF NOT EXISTS "OPPEScheduleV2_org_idx" ON "OPPEScheduleV2"("orgId");
CREATE INDEX IF NOT EXISTS "OPPEScheduleV2_nextDue_idx" ON "OPPEScheduleV2"("nextDueAt");

CREATE TABLE IF NOT EXISTS "OPPECase" (
  "id" TEXT PRIMARY KEY,
  "scheduleId" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "privilegeGrantedId" TEXT,
  "privilegeCode" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "metrics" JSONB,
  "status" "OPPECaseStatus" NOT NULL DEFAULT 'OPEN',
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OPPECase_schedule_fk" FOREIGN KEY ("scheduleId") REFERENCES "OPPEScheduleV2"("id") ON DELETE CASCADE,
  CONSTRAINT "OPPECase_privilegeGranted_fk" FOREIGN KEY ("privilegeGrantedId") REFERENCES "PrivilegeGranted"("id") ON DELETE SET NULL,
  CONSTRAINT "OPPECase_unique_period" UNIQUE("scheduleId", "privilegeCode", "periodStart")
);

CREATE INDEX IF NOT EXISTS "OPPECase_clinician_org_idx" ON "OPPECase"("clinicianId", "orgId");
CREATE INDEX IF NOT EXISTS "OPPECase_privilege_idx" ON "OPPECase"("privilegeGrantedId");
CREATE INDEX IF NOT EXISTS "OPPECase_status_idx" ON "OPPECase"("status");
