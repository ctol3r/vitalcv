-- D4 — probe-observed availability ledger.
--
-- The source-health store is an in-memory Map ("Ephemeral: serverless cold
-- starts will reset this"), so every deploy erased the platform's record of its
-- own health and /status could only say it does not publish uptime it has not
-- measured. This table is that memory.
--
-- Additive and idempotent (CREATE TABLE / INDEX IF NOT EXISTS). No FK: lane ids
-- are a fixed enum in application code, not rows, and a probe write must never
-- fail because of referential state.
--
-- Deliberately NOT stored: any aggregate or percentage. Rows are raw
-- observations; every figure is derived at read time so the denominator stays
-- inspectable. A stored average is a number nobody can re-derive.
CREATE TABLE IF NOT EXISTS "availability_samples" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "lane_id"      TEXT        NOT NULL,
  "ok"           BOOLEAN     NOT NULL,
  "state"        TEXT        NOT NULL,
  "latency_ms"   INTEGER,
  "probe_source" TEXT        NOT NULL,
  "observed_at"  TIMESTAMP(3) NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "availability_samples_pkey" PRIMARY KEY ("id")
);

-- Read path is always "one lane over a window", so lane first then time.
CREATE INDEX IF NOT EXISTS "availability_samples_lane_id_observed_at_idx"
  ON "availability_samples" ("lane_id", "observed_at");

-- Retention sweeps scan by time across all lanes.
CREATE INDEX IF NOT EXISTS "availability_samples_observed_at_idx"
  ON "availability_samples" ("observed_at");
