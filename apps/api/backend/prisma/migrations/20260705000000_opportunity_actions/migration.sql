-- Wave K — server-persisted clinician opportunity actions (Save / Connect /
-- Decline on MATCHA opportunities). Append-only decision log: every action,
-- including clearing one back to "new", inserts a NEW row; the latest row per
-- (clerkUserId, opportunityId) is the current state. Rows are never updated
-- or deleted. `id` is generated client-side by Prisma (@default(uuid())) —
-- no DB-level default, matching the fleet's Postgres (no gen_random_uuid).

CREATE TABLE "OpportunityAction" (
    "id" UUID NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "npi" TEXT,
    "opportunityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpportunityAction_clerkUserId_opportunityId_createdAt_idx" ON "OpportunityAction"("clerkUserId", "opportunityId", "createdAt");

CREATE INDEX "OpportunityAction_opportunityId_idx" ON "OpportunityAction"("opportunityId");

CREATE INDEX "OpportunityAction_createdAt_idx" ON "OpportunityAction"("createdAt");
