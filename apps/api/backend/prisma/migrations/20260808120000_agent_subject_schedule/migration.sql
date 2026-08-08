-- A2.1 — background agent run model + per-subject scheduling.
--
-- Invariants:
--   * agent_subject_schedules row existence IS the cohort allowlist. Nothing
--     enrolls a subject implicitly; there is no predicate that widens.
--   * Claiming a subject moves `next_due_at` FORWARD inside a compare-and-set
--     (UPDATE ... WHERE next_due_at <= now), claimed iff one row changed. A
--     retried or concurrent tick therefore finds nothing to claim.
--   * AgentRun columns are additive with safe defaults so existing rows keep
--     their meaning: everything written before A2.1 was an interactive,
--     clinician-session, full, live run.
--   * `id` is app-generated (Prisma `@default(uuid())`) — no DB default.

ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "trigger" TEXT NOT NULL DEFAULT 'interactive';
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "actor" TEXT NOT NULL DEFAULT 'clinician_session';
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "completeness" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'live';

CREATE TABLE IF NOT EXISTS "agent_subject_schedules" (
    "id" UUID NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "npi" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_due_at" TIMESTAMP(3) NOT NULL,
    "interval_minutes" INTEGER NOT NULL DEFAULT 1440,
    "last_claimed_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_run_id" UUID,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_subject_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_subject_schedules_subject_ref_key" ON "agent_subject_schedules"("subject_ref");
CREATE INDEX IF NOT EXISTS "agent_subject_schedules_enabled_next_due_at_idx" ON "agent_subject_schedules"("enabled", "next_due_at");
