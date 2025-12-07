CREATE TABLE IF NOT EXISTS "PSVSourceConfig"(
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL,
  endpoint_url TEXT,
  auth_header_json TEXT,
  mode TEXT DEFAULT 'mock',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tenant_id, source)
);

