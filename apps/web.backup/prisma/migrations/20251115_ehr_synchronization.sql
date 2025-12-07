-- B189B-EHR-006: EHR privilege synchronization tracking

CREATE TYPE "EhrSynchronizationStatus" AS ENUM ('PENDING','SYNCED','FAILED','RETRYING');

CREATE TABLE IF NOT EXISTS "EhrSynchronization" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "privilegeCode" TEXT NOT NULL,
  "ehrSystem" TEXT NOT NULL,
  "status" "EhrSynchronizationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "error" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EhrSynchronization_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EhrSynchronization_clinicianId_createdAt_idx"
  ON "EhrSynchronization" ("clinicianId","createdAt");

CREATE INDEX IF NOT EXISTS "EhrSynchronization_status_idx"
  ON "EhrSynchronization" ("status");

CREATE INDEX IF NOT EXISTS "EhrSynchronization_ehrSystem_idx"
  ON "EhrSynchronization" ("ehrSystem");

CREATE INDEX IF NOT EXISTS "EhrSynchronization_status_ehrSystem_idx"
  ON "EhrSynchronization" ("status","ehrSystem");


