CREATE TABLE IF NOT EXISTS "DemoRun"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID,
  name TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT,
  summary JSONB
);
CREATE TABLE IF NOT EXISTS "DemoRunStep"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES "DemoRun"(id) ON DELETE CASCADE,
  idx INT,
  step JSONB,
  status TEXT,
  duration_ms INT,
  error TEXT
);

