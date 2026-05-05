-- Wave 26/27: Multi-tenant scoping + monitoring trust ledger support
-- migration-shape:allow-drop reason: pre-existing FK swap during multi-tenant refactor; grandfathered when the migration-shape gate landed (see docs/ops/db-migrate-cutover-runbook.md).
ALTER TABLE "PilotPlan" ALTER COLUMN "organizationId" DROP NOT NULL;

ALTER TABLE "PilotPlan" DROP CONSTRAINT "PilotPlan_organizationId_fkey";
ALTER TABLE "PilotPlan"
  ADD CONSTRAINT "PilotPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "PilotOrg"("id") ON DELETE SET NULL;

ALTER TABLE "VerificationArtifact" ADD COLUMN "organizationId" UUID;
CREATE INDEX "VerificationArtifact_organizationId_idx" ON "VerificationArtifact"("organizationId");

ALTER TABLE "MonitoringEvent" ADD COLUMN "organizationId" UUID;
CREATE INDEX "MonitoringEvent_organizationId_idx" ON "MonitoringEvent"("organizationId");

CREATE TABLE "TrustLedgerEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifactId" UUID,
    "npi" TEXT,
    "action" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "organizationId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrustLedgerEntry_artifactId_idx" ON "TrustLedgerEntry"("artifactId");
CREATE INDEX "TrustLedgerEntry_npi_idx" ON "TrustLedgerEntry"("npi");
CREATE INDEX "TrustLedgerEntry_organizationId_idx" ON "TrustLedgerEntry"("organizationId");
CREATE INDEX "TrustLedgerEntry_createdAt_idx" ON "TrustLedgerEntry"("createdAt");
