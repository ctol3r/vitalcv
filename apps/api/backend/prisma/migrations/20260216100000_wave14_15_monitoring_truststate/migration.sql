-- Wave 14: MonitoringEvent model
CREATE TABLE "MonitoringEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "npi" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonitoringEvent_npi_idx" ON "MonitoringEvent"("npi");
CREATE INDEX "MonitoringEvent_source_idx" ON "MonitoringEvent"("source");
CREATE INDEX "MonitoringEvent_detectedAt_idx" ON "MonitoringEvent"("detectedAt");

-- Wave 15: trustState field on VerificationArtifact
ALTER TABLE "VerificationArtifact" ADD COLUMN "trustState" TEXT NOT NULL DEFAULT 'needs_review';
CREATE INDEX "VerificationArtifact_trustState_idx" ON "VerificationArtifact"("trustState");
