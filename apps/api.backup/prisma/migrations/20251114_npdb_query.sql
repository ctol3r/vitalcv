-- B168A-NPDB-001: NPDB query audit trail

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NPDBQueryStatus') THEN
    CREATE TYPE "NPDBQueryStatus" AS ENUM ('PENDING','SENT','COMPLETED','FAILED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "NPDBQuery" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "npi" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "status" "NPDBQueryStatus" NOT NULL DEFAULT 'PENDING',
  "requestXml" TEXT NOT NULL,
  "responseXml" TEXT,
  "resultSummary" JSONB,
  "failureReason" TEXT,
  "sentAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NPDBQuery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NPDBQuery_clinicianId_createdAt_idx"
  ON "NPDBQuery" ("clinicianId", "createdAt");
CREATE INDEX IF NOT EXISTS "NPDBQuery_npi_idx"
  ON "NPDBQuery" ("npi");
CREATE INDEX IF NOT EXISTS "NPDBQuery_status_createdAt_idx"
  ON "NPDBQuery" ("status", "createdAt");
