CREATE TABLE IF NOT EXISTS "TefcaSync"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  count INT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS "DirectoryEntry"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  practitioner JSONB,
  endpoint JSONB,
  provenance JSONB
);

CREATE INDEX IF NOT EXISTS idx_tefca_sync_ts ON "TefcaSync"(ts DESC);
CREATE INDEX IF NOT EXISTS idx_directory_entry_ts ON "DirectoryEntry"(ts DESC);

