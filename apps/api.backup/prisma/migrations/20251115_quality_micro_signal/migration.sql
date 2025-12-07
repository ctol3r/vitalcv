-- B208A-QS-001: QualityMicroSignal storage

DO $$
BEGIN
  CREATE TYPE "QualityMicroSignalType" AS ENUM (
    'WEAK_OPPE_DRIFT',
    'MINOR_COMPLICATION_CLUSTER',
    'ENROLLMENT_DENIAL_MICROTREND',
    'EHR_MICROMISMATCH',
    'PATTERN_BREAK',
    'PRIVILEGE_UNUSUAL_USAGE',
    'RISK_ACCELERATION',
    'DRIFT_PRECURSOR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "QualityMicroSignalSeverity" AS ENUM ('LOW', 'MEDIUM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "QualityMicroSignal" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "signalType" "QualityMicroSignalType" NOT NULL,
  "severity" "QualityMicroSignalSeverity" NOT NULL,
  "details" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityMicroSignal_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "QualityMicroSignal_clinician_timestamp_idx"
  ON "QualityMicroSignal" ("clinicianId", "timestamp");

CREATE INDEX IF NOT EXISTS "QualityMicroSignal_signal_type_idx"
  ON "QualityMicroSignal" ("signalType");

CREATE INDEX IF NOT EXISTS "QualityMicroSignal_severity_idx"
  ON "QualityMicroSignal" ("severity");

