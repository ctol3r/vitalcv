-- B187A-DRIFT-001/003: Drift event + resolution persistence

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriftType') THEN
    CREATE TYPE "DriftType" AS ENUM (
      'LICENSE_STATUS',
      'LICENSE_EXPIRY',
      'BOARD_STATUS',
      'DEA_STATUS',
      'NAME_MISMATCH',
      'TAXONOMY_DRIFT',
      'ADDRESS_DRIFT',
      'SPECIALTY_DRIFT',
      'PECOS_DRIFT',
      'MEDICAID_DRIFT',
      'NPPES_DRIFT',
      'COMPACT_STATUS_DRIFT'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriftSeverity') THEN
    CREATE TYPE "DriftSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriftResolutionType') THEN
    CREATE TYPE "DriftResolutionType" AS ENUM ('MANUAL_OVERRIDE', 'DATA_CORRECTION', 'EXPIRED', 'NONE_NEEDED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "DriftEvent" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "driftType" "DriftType" NOT NULL,
  "severity" "DriftSeverity" NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriftEvent_clinicianId_fkey"
    FOREIGN KEY ("clinicianId") REFERENCES "ClinicianProfile" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DriftEvent_clinician_drift_idx" ON "DriftEvent" ("clinicianId", "driftType");
CREATE INDEX IF NOT EXISTS "DriftEvent_severity_idx" ON "DriftEvent" ("severity");
CREATE INDEX IF NOT EXISTS "DriftEvent_detected_idx" ON "DriftEvent" ("detectedAt");

CREATE TABLE IF NOT EXISTS "DriftResolution" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "resolutionType" "DriftResolutionType" NOT NULL,
  "resolvedBy" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriftResolution_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "DriftEvent" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DriftResolution_event_idx" ON "DriftResolution" ("eventId");
CREATE INDEX IF NOT EXISTS "DriftResolution_type_idx" ON "DriftResolution" ("resolutionType");
CREATE INDEX IF NOT EXISTS "DriftResolution_resolved_idx" ON "DriftResolution" ("resolvedAt");

