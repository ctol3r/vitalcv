-- B212A-MOBILITY-PASSPORT: clinician mobility snapshots
CREATE TABLE IF NOT EXISTS "MobilityPassport" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clinicianId" TEXT NOT NULL,
    "statesEligible" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "compactStatus" JSONB NOT NULL DEFAULT '{}'::JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobilityPassport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MobilityPassport_clinicianId_fkey"
      FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MobilityPassport_clinicianId_key"
  ON "MobilityPassport"("clinicianId");

CREATE INDEX IF NOT EXISTS "MobilityPassport_updatedAt_idx"
  ON "MobilityPassport"("updatedAt");









