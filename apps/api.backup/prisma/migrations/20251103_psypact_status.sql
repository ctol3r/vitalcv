CREATE TABLE IF NOT EXISTS "PsychPsyPactStatus"(
  npi TEXT PRIMARY KEY,
  apit BOOLEAN,
  tap BOOLEAN,
  epassport TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
