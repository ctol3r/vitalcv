-- B235B-API-011: Add APIKey model for public API access
-- B235B-API-013: Add APIQuota model for tracking usage limits
-- B235B-API-014: Add APIUsageLog model for tracking API usage metrics

-- Create APIKeyStatus enum
CREATE TYPE "APIKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- Create APIKey table
CREATE TABLE IF NOT EXISTS "APIKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "ownerOrgId" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "APIKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "APIKey_pkey" PRIMARY KEY ("id")
);

-- Create APIQuota table
CREATE TABLE IF NOT EXISTS "APIQuota" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "quotaType" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIQuota_pkey" PRIMARY KEY ("id")
);

-- Create APIUsageLog table
CREATE TABLE IF NOT EXISTS "APIUsageLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER,
    "dataTransferBytes" INTEGER,
    "isSpecialOp" BOOLEAN NOT NULL DEFAULT false,
    "anonymizedIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIUsageLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for APIKey
CREATE UNIQUE INDEX IF NOT EXISTS "APIKey_key_key" ON "APIKey"("key");
CREATE INDEX IF NOT EXISTS "APIKey_ownerOrgId_idx" ON "APIKey"("ownerOrgId");
CREATE INDEX IF NOT EXISTS "APIKey_status_idx" ON "APIKey"("status");
CREATE INDEX IF NOT EXISTS "APIKey_keyPrefix_idx" ON "APIKey"("keyPrefix");
CREATE INDEX IF NOT EXISTS "APIKey_createdAt_idx" ON "APIKey"("createdAt");
CREATE INDEX IF NOT EXISTS "APIKey_lastUsedAt_idx" ON "APIKey"("lastUsedAt");

-- Create indexes for APIQuota
CREATE UNIQUE INDEX IF NOT EXISTS "APIQuota_apiKeyId_quotaType_periodStart_key" ON "APIQuota"("apiKeyId", "quotaType", "periodStart");
CREATE INDEX IF NOT EXISTS "APIQuota_apiKeyId_idx" ON "APIQuota"("apiKeyId");
CREATE INDEX IF NOT EXISTS "APIQuota_quotaType_idx" ON "APIQuota"("quotaType");
CREATE INDEX IF NOT EXISTS "APIQuota_resetAt_idx" ON "APIQuota"("resetAt");

-- Create indexes for APIUsageLog
CREATE INDEX IF NOT EXISTS "APIUsageLog_apiKeyId_idx" ON "APIUsageLog"("apiKeyId");
CREATE INDEX IF NOT EXISTS "APIUsageLog_endpoint_idx" ON "APIUsageLog"("endpoint");
CREATE INDEX IF NOT EXISTS "APIUsageLog_statusCode_idx" ON "APIUsageLog"("statusCode");
CREATE INDEX IF NOT EXISTS "APIUsageLog_createdAt_idx" ON "APIUsageLog"("createdAt");
CREATE INDEX IF NOT EXISTS "APIUsageLog_isSpecialOp_idx" ON "APIUsageLog"("isSpecialOp");

-- Add foreign key constraints
ALTER TABLE "APIKey" ADD CONSTRAINT "APIKey_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "APIQuota" ADD CONSTRAINT "APIQuota_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "APIKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "APIUsageLog" ADD CONSTRAINT "APIUsageLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "APIKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

