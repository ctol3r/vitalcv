-- Task 33.1: ComplianceCheck persistence
-- Creates ComplianceCheck table for recording CR1-CR5 automation runs.

CREATE TABLE IF NOT EXISTS "ComplianceCheck" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceCheck_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ComplianceCheck_clinician_type_idx"
  ON "ComplianceCheck" ("clinicianId", "type");

CREATE INDEX IF NOT EXISTS "ComplianceCheck_created_at_idx"
  ON "ComplianceCheck" ("createdAt");

