-- B168B-LIC-001: State license verification persistence
-- Adds LicenseVerificationStatus enum + StateLicenseVerification table

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LicenseVerificationStatus') THEN
    CREATE TYPE "LicenseVerificationStatus" AS ENUM ('ACTIVE','INACTIVE','EXPIRED','SUSPENDED','REVOKED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "StateLicenseVerification" (
  "id" TEXT PRIMARY KEY,
  "clinicianId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "status" "LicenseVerificationStatus" NOT NULL,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "disciplinaryFlag" BOOLEAN NOT NULL DEFAULT false,
  "restrictions" JSONB,
  "disciplinaryHistory" JSONB,
  "sourceMetadata" JSONB,
  "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "StateLicenseVerification_clinician_state_license_key"
  ON "StateLicenseVerification" ("clinicianId", "state", "licenseNumber");
CREATE INDEX IF NOT EXISTS "StateLicenseVerification_clinicianId_idx"
  ON "StateLicenseVerification" ("clinicianId");
CREATE INDEX IF NOT EXISTS "StateLicenseVerification_state_idx"
  ON "StateLicenseVerification" ("state");
CREATE INDEX IF NOT EXISTS "StateLicenseVerification_status_idx"
  ON "StateLicenseVerification" ("status");
CREATE INDEX IF NOT EXISTS "StateLicenseVerification_expiry_idx"
  ON "StateLicenseVerification" ("expiryDate");
