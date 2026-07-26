-- PR J5b — record the opportunity version the application was sealed against.
--
-- Additive + nullable + IF NOT EXISTS → safe and idempotent on any environment.
-- Legacy packets keep NULL and stay valid: the read/verify path maps a NULL
-- column to an OMITTED canonical key so the original seal hash still verifies
-- (a NULL key would hash differently from an absent one). New packets always
-- write the value and it is covered by the seal hash.
ALTER TABLE "application_packets"
  ADD COLUMN IF NOT EXISTS "opportunity_version" TEXT;
