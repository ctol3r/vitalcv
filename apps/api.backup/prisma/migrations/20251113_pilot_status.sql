-- S72-D3-B-003: Pilot Status model
-- Single-row or per-org table storing latest smoke test result

CREATE TABLE IF NOT EXISTS "PilotStatus" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT,
  "lastOk" BOOLEAN NOT NULL,
  "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "PilotStatus_orgId_idx" ON "PilotStatus"("orgId");
CREATE INDEX IF NOT EXISTS "PilotStatus_lastOk_idx" ON "PilotStatus"("lastOk");
CREATE INDEX IF NOT EXISTS "PilotStatus_lastRunAt_idx" ON "PilotStatus"("lastRunAt");

-- Create unique constraint on orgId (null allowed for global/demo)
CREATE UNIQUE INDEX IF NOT EXISTS "PilotStatus_orgId_key" ON "PilotStatus"("orgId") WHERE "orgId" IS NOT NULL;

