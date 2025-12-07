-- B227A-DEV-005: Add DeveloperApiKeys table for developer API key management

CREATE TABLE IF NOT EXISTS "DeveloperApiKeys" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DeveloperApiKeys_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "DeveloperApiKeys_developerId_idx" ON "DeveloperApiKeys"("developerId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperApiKeys_key_key" ON "DeveloperApiKeys"("key");
CREATE INDEX IF NOT EXISTS "DeveloperApiKeys_revoked_idx" ON "DeveloperApiKeys"("revoked");
CREATE INDEX IF NOT EXISTS "DeveloperApiKeys_createdAt_idx" ON "DeveloperApiKeys"("createdAt");

