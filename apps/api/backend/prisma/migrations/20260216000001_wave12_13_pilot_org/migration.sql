-- Wave 12/13: Pilot organization model for controlled verifier conversion
CREATE TABLE "PilotOrg" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PilotOrg_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PilotOrg_accepted_idx" ON "PilotOrg"("accepted");
CREATE INDEX "PilotOrg_activatedAt_idx" ON "PilotOrg"("activatedAt");
