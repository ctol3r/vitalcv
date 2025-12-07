-- Task 132.1: EvidencePack persistence
-- Stores generated evidence bundles for NCQA / DEA / TJC automation.

CREATE TABLE IF NOT EXISTS "EvidencePack" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidencePack_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EvidencePack_clinician_created_idx"
  ON "EvidencePack" ("clinicianId", "createdAt");

