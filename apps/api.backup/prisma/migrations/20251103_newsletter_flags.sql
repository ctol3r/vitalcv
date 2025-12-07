CREATE TABLE IF NOT EXISTS "Newsletter"(
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  source TEXT
);

CREATE TABLE IF NOT EXISTS "RuntimeFlag"(
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

