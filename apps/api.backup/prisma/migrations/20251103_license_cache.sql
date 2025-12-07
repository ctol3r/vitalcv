CREATE TABLE IF NOT EXISTS "LicenseCache"(
  state TEXT NOT NULL,
  license_number TEXT NOT NULL,
  name TEXT,
  status TEXT,
  payload JSONB,
  source_url TEXT,
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY(state, license_number)
);


