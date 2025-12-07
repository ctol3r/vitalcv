CREATE TABLE IF NOT EXISTS "IssuerTenant"(
  tenant_id TEXT PRIMARY KEY,
  issuer_url TEXT NOT NULL,
  auth_url TEXT,
  kid TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

