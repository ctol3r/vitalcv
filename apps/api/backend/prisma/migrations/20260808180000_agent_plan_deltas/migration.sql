-- A2.2 — plan deltas.
--
-- Invariants:
--   * agent_plan_deltas is append-only; a delta is an observation about a
--     transition and is never edited.
--   * `material` distinguishes deltas worth a human's attention from the
--     ones that merely must be recorded. The most common row by far is
--     `observation_refreshed_no_change` — a source re-read that found
--     nothing new. Recording is unconditional; materiality is the filter.
--   * decision_projection / decision_fingerprint hash DECISION content only.
--     They deliberately exclude collectedAt and evidence observedAt, because
--     context_fingerprint and plan_id both change on every run when only the
--     clock advances, which would report a change every tick.
--   * delta_from_run_id lands in this migration WITH its writer. A nullable
--     column nothing writes is the ActivationRequirement.dueAt defect.
--   * `id` is app-generated (Prisma @default(uuid())) — no DB default.

ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "delta_from_run_id" UUID;
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "decision_projection" JSONB;
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "decision_fingerprint" TEXT;

CREATE TABLE IF NOT EXISTS "agent_plan_deltas" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "prior_run_id" UUID,
    "subject_ref" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "material" BOOLEAN NOT NULL,
    "owner" TEXT,
    "ref" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_plan_deltas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_plan_deltas_subject_ref_created_at_idx" ON "agent_plan_deltas"("subject_ref", "created_at");
CREATE INDEX IF NOT EXISTS "agent_plan_deltas_run_id_idx" ON "agent_plan_deltas"("run_id");
CREATE INDEX IF NOT EXISTS "agent_plan_deltas_kind_material_created_at_idx" ON "agent_plan_deltas"("kind", "material", "created_at");
