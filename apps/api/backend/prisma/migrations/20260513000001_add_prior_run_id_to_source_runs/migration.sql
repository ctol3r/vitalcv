-- Add prior_run_id to source_runs for replay chain linking.
-- prior_run_id is the run_id of the previous run for the same NPI + sourceId pair,
-- enabling chain traversal: current → prior → prior → ... → origin.
-- Non-unique (multiple runs may share a prior), nullable (first run has no prior).

ALTER TABLE "source_runs"
  ADD COLUMN IF NOT EXISTS "prior_run_id" TEXT;

CREATE INDEX IF NOT EXISTS "source_runs_prior_run_id_idx"
  ON "source_runs" ("prior_run_id");
