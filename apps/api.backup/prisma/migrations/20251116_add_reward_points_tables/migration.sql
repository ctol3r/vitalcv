-- B247A-GAM-010: RewardPointsMigration
-- SQL migration creating RewardPointsTransaction and ActionPointsDefinition tables
-- Defines indexes on userId and actionType; sets appropriate foreign keys if needed

CREATE TYPE "RewardActionType" AS ENUM (
  'PROFILE_COMPLETE',
  'DOCUMENT_UPLOAD',
  'CREDENTIAL_VERIFIED',
  'TRAINING_COMPLETED',
  'COMMUNITY_POST',
  'REFERRAL',
  'DAILY_LOGIN',
  'REDEMPTION',
  'EXPIRATION'
);

-- ActionPointsDefinition: Stores point value per action type
CREATE TABLE IF NOT EXISTS "ActionPointsDefinition" (
  "id" TEXT PRIMARY KEY,
  "actionType" "RewardActionType" NOT NULL UNIQUE,
  "points" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ActionPointsDefinition_actionType_idx" ON "ActionPointsDefinition" ("actionType");
CREATE INDEX IF NOT EXISTS "ActionPointsDefinition_isActive_idx" ON "ActionPointsDefinition" ("isActive");

-- RewardPointsTransaction: Stores all point transactions
CREATE TABLE IF NOT EXISTS "RewardPointsTransaction" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "actionType" "RewardActionType" NOT NULL,
  "points" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardPointsTransaction_user_fk"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RewardPointsTransaction_userId_idx" ON "RewardPointsTransaction" ("userId");
CREATE INDEX IF NOT EXISTS "RewardPointsTransaction_actionType_idx" ON "RewardPointsTransaction" ("actionType");
CREATE INDEX IF NOT EXISTS "RewardPointsTransaction_createdAt_idx" ON "RewardPointsTransaction" ("createdAt");
CREATE INDEX IF NOT EXISTS "RewardPointsTransaction_userId_createdAt_idx" ON "RewardPointsTransaction" ("userId", "createdAt");

