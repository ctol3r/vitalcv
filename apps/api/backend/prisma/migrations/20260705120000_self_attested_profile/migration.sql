-- Self-attested structured profile sections for the signed-in clinician.
-- One JSON document holding the USER_ENTERED layer: contact details, medical
-- school, subspecialty, work history, affiliations, career goals, research.
-- These are clinician-stated and NEVER source-verified — source-checked facts
-- (NPPES / licensure / board) live in their own tables with their own receipts.
-- Additive, nullable column: safe to apply on a live table with no backfill.

ALTER TABLE "person_profiles"
  ADD COLUMN IF NOT EXISTS "self_attested" JSONB;
