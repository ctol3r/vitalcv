-- Governance proposal registry (Batch 66.1)

CREATE TABLE IF NOT EXISTS "GovernanceProposal" (
  "id" TEXT PRIMARY KEY,
  "proposerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "anchoredAt" TIMESTAMP(3),
  "network" TEXT,
  "chainReceipt" JSONB
);

CREATE INDEX IF NOT EXISTS "GovernanceProposal_proposer_idx"
  ON "GovernanceProposal" ("proposerId");

CREATE INDEX IF NOT EXISTS "GovernanceProposal_type_idx"
  ON "GovernanceProposal" ("type");

CREATE INDEX IF NOT EXISTS "GovernanceProposal_status_idx"
  ON "GovernanceProposal" ("status");











