-- Add PSV window columns to VerificationArtifact
ALTER TABLE "VerificationArtifact" ADD COLUMN "psvWindowStart" TIMESTAMP(3);
ALTER TABLE "VerificationArtifact" ADD COLUMN "psvWindowDeadline" TIMESTAMP(3);
ALTER TABLE "VerificationArtifact" ADD COLUMN "psvWindowCompliant" BOOLEAN;

-- Create EventLog table for funnel analytics (used by raw queries)
CREATE TABLE IF NOT EXISTS "EventLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventType" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "metadata" JSONB,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");
CREATE INDEX "EventLog_npi_idx" ON "EventLog"("npi");
CREATE INDEX "EventLog_organizationId_idx" ON "EventLog"("organizationId");
