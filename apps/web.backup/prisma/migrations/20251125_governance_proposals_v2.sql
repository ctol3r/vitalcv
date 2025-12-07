-- Governance proposals v2 schema refresh (Task 125.1)

ALTER TABLE "GovernanceProposal"
  RENAME COLUMN "proposerId" TO "proposerDid";

ALTER TABLE "GovernanceProposal"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Untitled Proposal',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT 'Pending governance description',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "GovernanceProposal"
SET
  "title" = COALESCE(NULLIF("type", ''), 'Untitled Proposal'),
  "description" = COALESCE(
    NULLIF("payload"::text, ''),
    'No description provided'
  ),
  "status" = CASE
    WHEN "status" IN ('pending', 'open') THEN 'active'
    ELSE COALESCE(NULLIF("status", ''), 'draft')
  END;

ALTER TABLE "GovernanceProposal"
  ALTER COLUMN "title" DROP DEFAULT,
  ALTER COLUMN "description" DROP DEFAULT,
  ALTER COLUMN "status" SET DEFAULT 'draft';

DROP INDEX IF EXISTS "GovernanceProposal_proposer_idx";
DROP INDEX IF EXISTS "GovernanceProposal_type_idx";
DROP INDEX IF EXISTS "GovernanceProposal_status_idx";

ALTER TABLE "GovernanceProposal"
  DROP COLUMN "type",
  DROP COLUMN "payload",
  DROP COLUMN "anchoredAt",
  DROP COLUMN "chainReceipt",
  DROP COLUMN "network";

CREATE INDEX IF NOT EXISTS "GovernanceProposal_proposerDid_idx"
  ON "GovernanceProposal" ("proposerDid");

CREATE INDEX IF NOT EXISTS "GovernanceProposal_status_idx"
  ON "GovernanceProposal" ("status");

CREATE INDEX IF NOT EXISTS "GovernanceProposal_createdAt_idx"
  ON "GovernanceProposal" ("createdAt");










