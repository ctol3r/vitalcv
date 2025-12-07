-- B162A-USER: Simple user & profile primitives for demo dashboards
-- Adds UserRole enum, demoUser flag, clinician/org profiles, and DID link table

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('CLINICIAN', 'ORG_ADMIN', 'INTERNAL_ADMIN');
  END IF;
END
$$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'CLINICIAN';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "demoUser" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ClinicianProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "npi" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "bio" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicianProfile_userId_key" UNIQUE("userId"),
  CONSTRAINT "ClinicianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClinicianProfile_npi_idx" ON "ClinicianProfile"("npi");
CREATE INDEX IF NOT EXISTS "ClinicianProfile_state_idx" ON "ClinicianProfile"("state");

CREATE TABLE IF NOT EXISTS "OrgProfile" (
  "orgId" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "address" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OrgProfile_contactEmail_idx" ON "OrgProfile"("contactEmail");

CREATE TABLE IF NOT EXISTS "DidUserLink" (
  "id" TEXT PRIMARY KEY,
  "did" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DidUserLink_did_key" UNIQUE("did"),
  CONSTRAINT "DidUserLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DidUserLink_userId_idx" ON "DidUserLink"("userId");

