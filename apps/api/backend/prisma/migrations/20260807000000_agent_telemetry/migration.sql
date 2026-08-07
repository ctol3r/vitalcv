-- FOUNDER WAVE A0 — Start Agent telemetry (agent_runs / agent_run_actions / agent_events).
--
-- Invariants encoded here:
--   * `id` is generated client-side by Prisma (`@default(uuid())`) — no DB-level
--     default, matching the fleet's Postgres (no gen_random_uuid).
--   * `plan_id` is a deterministic content hash (`plan_<hex>`), deliberately a
--     TEXT column, never UUID.
--   * agent_events is append-only and carries the forward foreign-reference
--     pattern (related_kind, related_ref) so future hiring-outcome systems can
--     join the chain without schema changes here.
--   * CREATE TABLE IF NOT EXISTS so existing databases no-op on redeploy.

CREATE TABLE IF NOT EXISTS "agent_runs" (
    "id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "npi" TEXT,
    "context_class" TEXT NOT NULL,
    "context_fingerprint" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "toolset_version" TEXT NOT NULL,
    "model_version" TEXT,
    "blockers" JSONB NOT NULL DEFAULT '[]',
    "candidate_actions" JSONB NOT NULL DEFAULT '[]',
    "ranked_action_ids" JSONB NOT NULL DEFAULT '[]',
    "selected_action_id" TEXT,
    "confidence" DOUBLE PRECISION,
    "input_gaps" JSONB NOT NULL DEFAULT '[]',
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_runs_subject_ref_created_at_idx" ON "agent_runs"("subject_ref", "created_at");
CREATE INDEX IF NOT EXISTS "agent_runs_plan_id_idx" ON "agent_runs"("plan_id");
CREATE INDEX IF NOT EXISTS "agent_runs_policy_version_created_at_idx" ON "agent_runs"("policy_version", "created_at");

CREATE TABLE IF NOT EXISTS "agent_run_actions" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "action_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "rank_tier" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_run_actions_run_id_priority_idx" ON "agent_run_actions"("run_id", "priority");
CREATE INDEX IF NOT EXISTS "agent_run_actions_action_type_created_at_idx" ON "agent_run_actions"("action_type", "created_at");

CREATE TABLE IF NOT EXISTS "agent_events" (
    "id" UUID NOT NULL,
    "run_id" UUID,
    "plan_id" TEXT NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "action_id" TEXT,
    "event_type" TEXT NOT NULL,
    "owner" TEXT,
    "outcome" TEXT,
    "elapsed_ms" INTEGER,
    "related_kind" TEXT,
    "related_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_events_plan_id_created_at_idx" ON "agent_events"("plan_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_events_event_type_created_at_idx" ON "agent_events"("event_type", "created_at");
CREATE INDEX IF NOT EXISTS "agent_events_subject_ref_created_at_idx" ON "agent_events"("subject_ref", "created_at");
CREATE INDEX IF NOT EXISTS "agent_events_related_kind_related_ref_idx" ON "agent_events"("related_kind", "related_ref");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_run_actions_run_id_fkey'
    ) THEN
        ALTER TABLE "agent_run_actions"
            ADD CONSTRAINT "agent_run_actions_run_id_fkey"
            FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agent_events_run_id_fkey'
    ) THEN
        ALTER TABLE "agent_events"
            ADD CONSTRAINT "agent_events_run_id_fkey"
            FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
