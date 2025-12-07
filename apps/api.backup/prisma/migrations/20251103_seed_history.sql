-- Batch 62: Seed History Table
-- Tracks all demo-reset/reseed operations for audit and timeline display

CREATE TABLE IF NOT EXISTS "SeedHistory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  user_id TEXT,
  seeds JSONB,
  result JSONB
);

-- Index for efficient timeline queries
CREATE INDEX IF NOT EXISTS idx_seed_history_ts ON "SeedHistory"(ts DESC);

