-- Wave 26/27: Add organization scoping to marketing telemetry models.
ALTER TABLE "EventLog" ADD COLUMN "organizationId" UUID;
CREATE INDEX "EventLog_organizationId_idx" ON "EventLog"("organizationId");

ALTER TABLE "ShareLink" ADD COLUMN "organizationId" UUID;
CREATE INDEX "ShareLink_organizationId_idx" ON "ShareLink"("organizationId");
