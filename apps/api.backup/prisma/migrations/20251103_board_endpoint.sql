CREATE TABLE IF NOT EXISTS "BoardEndpoint"(
  state TEXT PRIMARY KEY,
  endpoint_url TEXT NOT NULL,
  auth_header TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

