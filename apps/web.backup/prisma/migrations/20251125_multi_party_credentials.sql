-- Multi-party credential workflow storage (Task 126.1)

CREATE TABLE IF NOT EXISTS "MultiPartyCredential" (
  "id" TEXT PRIMARY KEY,
  "baseCredentialId" TEXT NOT NULL,
  "participantDids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'draft',
  "partialProofs" JSONB,
  "rootHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MultiPartyCredential_base_idx"
  ON "MultiPartyCredential" ("baseCredentialId");

CREATE INDEX IF NOT EXISTS "MultiPartyCredential_status_idx"
  ON "MultiPartyCredential" ("status");










