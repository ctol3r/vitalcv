-- Add run_id to source_runs for replay persistence alpha.
-- run_id is a deterministic 8-char hex derived from npi:startedAt,
-- used to look up SourceRun records by logical run identity across restarts.

ALTER TABLE "source_runs"
  ADD COLUMN IF NOT EXISTS "run_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "source_runs_run_id_key"
  ON "source_runs" ("run_id");
