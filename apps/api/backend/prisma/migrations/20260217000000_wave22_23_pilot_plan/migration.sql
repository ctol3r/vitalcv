-- Wave 22/23: Pilot plan lifecycle and bundle count tracking
CREATE TABLE "PilotPlan" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bundleCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PilotPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PilotPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PilotOrg"("id") ON DELETE CASCADE
);

CREATE INDEX "PilotPlan_organizationId_idx" ON "PilotPlan"("organizationId");
CREATE INDEX "PilotPlan_active_idx" ON "PilotPlan"("active");
CREATE INDEX "PilotPlan_startDate_idx" ON "PilotPlan"("startDate");
