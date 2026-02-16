-- Wave 34: Add deterministic Merkle tree metadata to VerificationArtifact
ALTER TABLE "VerificationArtifact" ADD COLUMN "merkleRoot" TEXT;
ALTER TABLE "VerificationArtifact" ADD COLUMN "claimHashes" JSONB;
