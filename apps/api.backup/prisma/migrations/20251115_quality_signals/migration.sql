-- B194A-QFUSION-001: QualitySignal storage

DO $$
BEGIN
  CREATE TYPE "QualitySignalType" AS ENUM (
    'LOW_VOLUME',
    'EXCESSIVE_VARIANCE',
    'COMPLICATION_SPIKE',
    'OPPE_LOW',
    'FPPE_FAILURE',
    'EHR_PRIVILEGE_MISMATCH',
    'PAYER_DENIAL_SPIKE',
    'PECOS_CONFLICT',
    'LICENSE_DRIFT',
    'BOARD_DRIFT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "QualitySignalSeverity" AS ENUM ('LOW', 'MED', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "QualitySignal" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "signalType" "QualitySignalType" NOT NULL,
  "severity" "QualitySignalSeverity" NOT NULL,
  "details" JSONB,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualitySignal_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "QualitySignal_clinician_timestamp_idx"
  ON "QualitySignal" ("clinicianId", "timestamp");

CREATE INDEX IF NOT EXISTS "QualitySignal_signal_type_idx"
  ON "QualitySignal" ("signalType");

