CREATE TABLE IF NOT EXISTS "DemoScript"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  author TEXT,
  steps JSONB NOT NULL,
  meta JSONB
);











