CREATE TABLE IF NOT EXISTS "VcRevocation"(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_did TEXT NOT NULL,
  cred_type TEXT NOT NULL,
  cred_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active|revoked
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_revocation_subject ON "VcRevocation"(subject_did);

