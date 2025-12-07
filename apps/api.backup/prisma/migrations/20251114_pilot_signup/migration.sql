-- B162B-PILOT-001: PilotSignup model + enum

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PilotSignupStatus') THEN
    CREATE TYPE "PilotSignupStatus" AS ENUM ('NEW', 'REVIEWING', 'APPROVED', 'REJECTED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "PilotSignup" (
  "id" TEXT PRIMARY KEY,
  "orgName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "notes" TEXT,
  "status" "PilotSignupStatus" NOT NULL DEFAULT 'NEW',
  "statusChangedAt" TIMESTAMP(3),
  "convertedOrgId" TEXT,
  "convertedUserId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PilotSignup_email_idx" ON "PilotSignup"("email");
CREATE INDEX IF NOT EXISTS "PilotSignup_status_createdAt_idx" ON "PilotSignup"("status", "createdAt");

