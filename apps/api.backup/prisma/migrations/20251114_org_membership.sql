-- B162C-MULTI-001: OrgMembership model for multi-org access control
-- Replaces legacy UserOrgLink table with role-aware memberships and seeds data

DO $$
BEGIN
  CREATE TYPE "OrgMembershipRole" AS ENUM ('ADMIN', 'REVIEWER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrgMembership" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "OrgMembershipRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgMembership_userId_orgId_key" UNIQUE("userId", "orgId")
);

-- Indexes for membership lookups
CREATE INDEX IF NOT EXISTS "OrgMembership_userId_idx" ON "OrgMembership"("userId");
CREATE INDEX IF NOT EXISTS "OrgMembership_orgId_idx" ON "OrgMembership"("orgId");
CREATE INDEX IF NOT EXISTS "OrgMembership_role_idx" ON "OrgMembership"("role");

-- Seed memberships from legacy UserOrgLink if it exists
DO $$
BEGIN
  IF to_regclass('"UserOrgLink"') IS NOT NULL THEN
    INSERT INTO "OrgMembership" ("id", "userId", "orgId", "role", "createdAt", "updatedAt")
    SELECT
      "id",
      "userId",
      "orgId",
      CASE WHEN "isOrgAdmin" THEN 'ADMIN'::"OrgMembershipRole" ELSE 'VIEWER'::"OrgMembershipRole" END,
      COALESCE("createdAt", CURRENT_TIMESTAMP),
      COALESCE("updatedAt", CURRENT_TIMESTAMP)
    FROM "UserOrgLink"
    ON CONFLICT ("userId", "orgId") DO UPDATE
    SET
      "role" = EXCLUDED."role",
      "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Foreign keys to ensure referential integrity
DO $$
BEGIN
  ALTER TABLE "OrgMembership"
    ADD CONSTRAINT "OrgMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OrgMembership"
    ADD CONSTRAINT "OrgMembership_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "PartnerConfig"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP TABLE IF EXISTS "UserOrgLink" CASCADE;
