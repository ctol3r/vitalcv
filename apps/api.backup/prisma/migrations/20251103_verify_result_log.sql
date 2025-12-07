CREATE TABLE IF NOT EXISTS "VerifyResultLog"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  request JSONB,
  result JSONB
);
