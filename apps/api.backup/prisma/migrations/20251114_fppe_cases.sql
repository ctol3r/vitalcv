-- B170B-FPPE-001: FPPECase table for focused evaluations

CREATE TYPE "FPPECaseStatus" AS ENUM ('OPEN','IN_REVIEW','COMPLETED','FAILED');

CREATE TABLE IF NOT EXISTS "FPPECase" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "privilegeGrantedId" TEXT NOT NULL,
  "privilegeCode" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "FPPECaseStatus" NOT NULL DEFAULT 'OPEN',
  "evaluatorId" TEXT,
  "checklist" JSONB,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FPPECase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FPPECase_privilegeGrantedId_fkey"
    FOREIGN KEY ("privilegeGrantedId") REFERENCES "PrivilegeGranted"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FPPECase_org_status_idx" ON "FPPECase" ("orgId", "status");
CREATE INDEX IF NOT EXISTS "FPPECase_clinician_idx" ON "FPPECase" ("clinicianId");
CREATE INDEX IF NOT EXISTS "FPPECase_dueAt_idx" ON "FPPECase" ("dueAt");
