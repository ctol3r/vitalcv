-- Ensure User table exists (hotfix)
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT,
  "name" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Ensure PrivilegeGranted table exists (hotfix)
CREATE TABLE IF NOT EXISTS "PrivilegeGranted" (
  "id" TEXT PRIMARY KEY,
  "clinicianDid" TEXT,
  "orgId" TEXT,
  "privilegeSetId" TEXT,
  "grantedAt" TIMESTAMP DEFAULT NOW(),
  "expiresAt" TIMESTAMP,
  "metadata" JSONB
);

-- Ensure SafetySignalSeverity enum exists (hotfix)
DO $$
BEGIN
  CREATE TYPE "SafetySignalSeverity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- B197A-SAFETY-001: Privilege safety signal storage

DO $$
BEGIN
  BEGIN
    ALTER TYPE "SafetySignalSeverity" RENAME VALUE 'MEDIUM' TO 'MED';
  EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN invalid_parameter_value THEN NULL;
    WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  CREATE TYPE "PrivilegeSafetySignalType" AS ENUM (
    'LICENSE_RISK',
    'QUALITY_RISK',
    'EHR_MISMATCH',
    'COMPACT_ELIGIBILITY_LOSS',
    'PAYER_DENIAL_SPIKE',
    'OPPE_LOW',
    'FPPE_FAILURE',
    'DEA_EXPIRED',
    'BOARD_EXPIRED',
    'NPDB_FLAG'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PrivilegeSafetySignal" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT,
  "privilegeCodes" TEXT[] NOT NULL,
  "privilegeGrantedId" TEXT,
  "signalType" "PrivilegeSafetySignalType" NOT NULL,
  "severity" "SafetySignalSeverity" NOT NULL,
  "summary" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "details" JSONB,
  "evidence" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNotes" TEXT,
  "resolutionActor" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivilegeSafetySignal_privilegeGrantedId_fkey"
    FOREIGN KEY ("privilegeGrantedId") REFERENCES "PrivilegeGranted"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PrivilegeSafetySignal_clinician_detected_idx"
  ON "PrivilegeSafetySignal" ("clinicianId", "detectedAt");

CREATE INDEX IF NOT EXISTS "PrivilegeSafetySignal_signal_type_idx"
  ON "PrivilegeSafetySignal" ("signalType");

CREATE INDEX IF NOT EXISTS "PrivilegeSafetySignal_severity_idx"
  ON "PrivilegeSafetySignal" ("severity");

CREATE INDEX IF NOT EXISTS "PrivilegeSafetySignal_org_idx"
  ON "PrivilegeSafetySignal" ("orgId");

CREATE INDEX IF NOT EXISTS "PrivilegeSafetySignal_privilegeGranted_idx"
  ON "PrivilegeSafetySignal" ("privilegeGrantedId");

CREATE INDEX IF NOT EXISTS "PrivilegeSafetySignal_clinician_type_idx"
  ON "PrivilegeSafetySignal" ("clinicianId", "signalType");
