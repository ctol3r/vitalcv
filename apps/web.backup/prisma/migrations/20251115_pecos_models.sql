-- B169A-PECOS-001 / B169A-PECOS-002: PECOS provider + document tables

CREATE TABLE IF NOT EXISTS "PECOSProvider" (
  "id" TEXT NOT NULL,
  "clinicianId" TEXT NOT NULL,
  "npi" TEXT NOT NULL,
  "medicareId" TEXT,
  "enrollmentType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3),
  "revalidationDate" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PECOSProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PECOSProvider_clinicianId_enrollmentType_key"
  ON "PECOSProvider"("clinicianId", "enrollmentType");
CREATE INDEX IF NOT EXISTS "PECOSProvider_clinicianId_idx" ON "PECOSProvider"("clinicianId");
CREATE INDEX IF NOT EXISTS "PECOSProvider_npi_idx" ON "PECOSProvider"("npi");
CREATE INDEX IF NOT EXISTS "PECOSProvider_status_idx" ON "PECOSProvider"("status");
CREATE INDEX IF NOT EXISTS "PECOSProvider_revalidationDate_idx"
  ON "PECOSProvider"("revalidationDate");

CREATE TABLE IF NOT EXISTS "PECOSDocument" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "parsedFields" JSONB,
  "storageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PECOSDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PECOSDocument_providerId_documentType_key"
  ON "PECOSDocument"("providerId", "documentType");
CREATE INDEX IF NOT EXISTS "PECOSDocument_providerId_idx" ON "PECOSDocument"("providerId");
CREATE INDEX IF NOT EXISTS "PECOSDocument_documentType_idx" ON "PECOSDocument"("documentType");
CREATE INDEX IF NOT EXISTS "PECOSDocument_submittedAt_idx" ON "PECOSDocument"("submittedAt");

ALTER TABLE "PECOSDocument"
  ADD CONSTRAINT "PECOSDocument_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "PECOSProvider"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

