-- Round 12: Revocation Status Index Mapping
-- Maps credential IDs to StatusList2021 indices

CREATE TABLE IF NOT EXISTS "VcStatusIndex" (
  cred_id TEXT PRIMARY KEY,
  sl_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcstatusindex_idx ON "VcStatusIndex"(sl_index);

-- Revocation events table
CREATE TABLE IF NOT EXISTS "VcRevocation" (
  id SERIAL PRIMARY KEY,
  subject_did TEXT,
  cred_type TEXT,
  cred_id TEXT NOT NULL,
  status TEXT DEFAULT 'revoked',
  reason TEXT,
  revoked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcrevocation_cred ON "VcRevocation"(cred_id);
CREATE INDEX IF NOT EXISTS idx_vcrevocation_did ON "VcRevocation"(subject_did);

