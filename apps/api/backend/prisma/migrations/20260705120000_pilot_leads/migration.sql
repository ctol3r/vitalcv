-- Wave Q — durable commercial lead capture. One row per submitted pilot
-- request / pilot intake, in addition to the existing Slack + stdout
-- delivery (which stays). Operational CRM-lite, never evidence. Every insert
-- is paired with an AuditEvent ('pilot.lead_captured') in the same
-- transaction. `id` is generated client-side by Prisma (@default(uuid())) —
-- no DB-level default, matching the fleet's Postgres (no gen_random_uuid).

CREATE TABLE "PilotLead" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "persona" TEXT,
    "organization" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "workflowTarget" TEXT,
    "sourceContext" TEXT,
    "payload" JSONB NOT NULL,
    "slackDelivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PilotLead_createdAt_idx" ON "PilotLead"("createdAt");

CREATE INDEX "PilotLead_source_createdAt_idx" ON "PilotLead"("source", "createdAt");

CREATE INDEX "PilotLead_email_idx" ON "PilotLead"("email");
