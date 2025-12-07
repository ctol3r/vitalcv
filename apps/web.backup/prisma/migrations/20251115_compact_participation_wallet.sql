-- B178A-COMPACT: Compact participation reference data + clinician wallet

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompactType') THEN
    CREATE TYPE "CompactType" AS ENUM ('IMLC','NLC','PSYPACT','APRN','PT');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompactParticipationStatus') THEN
    CREATE TYPE "CompactParticipationStatus" AS ENUM ('ACTIVE','SUSPENDED','ORGANIZATIONAL_ONLY');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "CompactParticipation" (
  "id" TEXT PRIMARY KEY,
  "compactType" "CompactType" NOT NULL,
  "state" TEXT NOT NULL,
  "status" "CompactParticipationStatus" NOT NULL DEFAULT 'ORGANIZATIONAL_ONLY',
  "startDate" TIMESTAMP(3),
  "suspensionDate" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompactParticipation_compact_state_key"
  ON "CompactParticipation" ("compactType", "state");
CREATE INDEX IF NOT EXISTS "CompactParticipation_compactType_idx"
  ON "CompactParticipation" ("compactType");
CREATE INDEX IF NOT EXISTS "CompactParticipation_state_idx"
  ON "CompactParticipation" ("state");
CREATE INDEX IF NOT EXISTS "CompactParticipation_status_idx"
  ON "CompactParticipation" ("status");

CREATE TABLE IF NOT EXISTS "ClinicianCompactWallet" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "compactType" "CompactType" NOT NULL,
  "homeState" TEXT NOT NULL,
  "privileges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicianCompactWallet_clinician_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicianCompactWallet_clinician_compact_key"
  ON "ClinicianCompactWallet" ("clinicianId", "compactType");
CREATE INDEX IF NOT EXISTS "ClinicianCompactWallet_compactType_idx"
  ON "ClinicianCompactWallet" ("compactType");
CREATE INDEX IF NOT EXISTS "ClinicianCompactWallet_homeState_idx"
  ON "ClinicianCompactWallet" ("homeState");
CREATE INDEX IF NOT EXISTS "ClinicianCompactWallet_clinician_idx"
  ON "ClinicianCompactWallet" ("clinicianId");

