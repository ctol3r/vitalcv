-- Self-attested clinician onboarding claims on the NPI-binding gate.
-- profession: the self-attested role (Physician/NP/PA/Pharmacist/RN/Dentist).
-- attested_at / attestation_version: when the clinician attested to being a
-- licensed clinician and agreed to the services agreement, and which version.
-- These are ATTESTED (clinician-stated), never source-checked facts; the
-- readiness lane holds source-verified evidence with its own receipts.

ALTER TABLE "person_profiles"
  ADD COLUMN IF NOT EXISTS "profession" TEXT,
  ADD COLUMN IF NOT EXISTS "attested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attestation_version" TEXT;
