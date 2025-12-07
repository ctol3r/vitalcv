-- B181C-PASS-001: PassportBundle model
-- Stores a tamper-evident record each time a clinician passport bundle is generated.

CREATE TABLE IF NOT EXISTS "PassportBundle" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "bundleHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PassportBundle_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PassportBundle_clinicianId_createdAt_idx"
  ON "PassportBundle" ("clinicianId", "createdAt");

CREATE INDEX IF NOT EXISTS "PassportBundle_bundleHash_idx"
  ON "PassportBundle" ("bundleHash");

