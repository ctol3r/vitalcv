CREATE TABLE IF NOT EXISTS "VerifyEvidence"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT,
  kind TEXT,
  url TEXT,
  label TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

