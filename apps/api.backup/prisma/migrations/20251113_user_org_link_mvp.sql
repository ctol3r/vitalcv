-- S72-D3-A-001: UserOrgLink MVP table for simple org admin flag
-- Creates simple user-organization linkage with isOrgAdmin flag

CREATE TABLE IF NOT EXISTS "UserOrgLink" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "isOrgAdmin" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserOrgLink_userId_orgId_key" UNIQUE("userId", "orgId")
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "UserOrgLink_userId_idx" ON "UserOrgLink"("userId");
CREATE INDEX IF NOT EXISTS "UserOrgLink_orgId_idx" ON "UserOrgLink"("orgId");
CREATE INDEX IF NOT EXISTS "UserOrgLink_isOrgAdmin_idx" ON "UserOrgLink"("isOrgAdmin");

