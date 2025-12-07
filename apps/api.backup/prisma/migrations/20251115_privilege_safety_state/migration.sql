-- B197B-SAFETY-006 backend schema sync

DO $$
BEGIN
  CREATE TYPE "PrivilegeSafetyStateValue" AS ENUM ('FULL', 'RESTRICTED', 'HOLD', 'PENDING_REVIEW', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SafetySignalSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PrivilegeSafetyState" (
  "id" TEXT PRIMARY KEY,
  "privilegeGrantedId" TEXT,
  "clinicianId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "privilegeCode" TEXT NOT NULL,
  "state" "PrivilegeSafetyStateValue" NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "severity" "SafetySignalSeverity" NOT NULL,
  "source" TEXT NOT NULL,
  "signalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "cascadeScope" JSONB,
  "metadata" JSONB,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivilegeSafetyState_privilegeGrantedId_fkey"
    FOREIGN KEY ("privilegeGrantedId") REFERENCES "PrivilegeGranted"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PrivilegeSafetyState_clinician_code_idx"
  ON "PrivilegeSafetyState" ("clinicianId", "privilegeCode", "effectiveAt");
CREATE INDEX IF NOT EXISTS "PrivilegeSafetyState_org_state_idx"
  ON "PrivilegeSafetyState" ("orgId", "state");
CREATE INDEX IF NOT EXISTS "PrivilegeSafetyState_grant_state_idx"
  ON "PrivilegeSafetyState" ("privilegeGrantedId", "state");
