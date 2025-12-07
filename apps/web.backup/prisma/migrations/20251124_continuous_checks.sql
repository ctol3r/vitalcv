-- Task 45.1: ContinuousCheck persistence for 48-hour readiness engine

CREATE TABLE IF NOT EXISTS "ContinuousCheck" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContinuousCheck_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContinuousCheck_clinician_type_idx"
  ON "ContinuousCheck" ("clinicianId", "type");

CREATE INDEX IF NOT EXISTS "ContinuousCheck_run_at_idx"
  ON "ContinuousCheck" ("runAt");










