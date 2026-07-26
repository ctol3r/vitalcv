-- ACT-1.2 — link an employer acceptance to the exact sealed application packet
-- it accepted. Additive and idempotent: EmployerAcceptance is keyed on
-- (employer_id, clinician_npi); these columns add a traceable link to the
-- immutable ApplicationPacket (by application_id + its unique packet_hash)
-- WITHOUT an FK, matching the model's existing no-FK convention and the fact
-- that packet_hash is a stable content seal. Nullable, so every existing
-- acceptance and the NPI-keyed writers are unaffected.
ALTER TABLE "employer_acceptances" ADD COLUMN IF NOT EXISTS "application_id" UUID;
ALTER TABLE "employer_acceptances" ADD COLUMN IF NOT EXISTS "packet_hash" TEXT;
CREATE INDEX IF NOT EXISTS "employer_acceptances_application_id_idx"
  ON "employer_acceptances" ("application_id");
