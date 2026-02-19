-- Wave 35: Deterministic credential lifecycle + revocation metadata
ALTER TABLE "VerificationArtifact" ADD COLUMN "lifecycleState" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "VerificationArtifact" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "VerificationArtifact" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "VerificationArtifact" ADD COLUMN "revocationReason" TEXT;
ALTER TABLE "VerificationArtifact" ADD COLUMN "statusLastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "VerificationArtifact_lifecycleState_idx" ON "VerificationArtifact"("lifecycleState");
CREATE INDEX "VerificationArtifact_revokedAt_idx" ON "VerificationArtifact"("revokedAt");
CREATE INDEX "VerificationArtifact_suspendedAt_idx" ON "VerificationArtifact"("suspendedAt");
CREATE INDEX "VerificationArtifact_statusLastChecked_idx" ON "VerificationArtifact"("statusLastChecked");
