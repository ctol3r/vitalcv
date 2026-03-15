-- Backfill missing status list support on VerificationArtifact.
-- The Prisma schema already expects this column and index.

ALTER TABLE "VerificationArtifact"
ADD COLUMN IF NOT EXISTS "statusListIndex" INTEGER;

CREATE INDEX IF NOT EXISTS "VerificationArtifact_statusListIndex_idx"
ON "VerificationArtifact"("statusListIndex");
