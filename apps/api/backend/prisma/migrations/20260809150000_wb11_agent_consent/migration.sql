-- WB-11: per-note, revocable opt-in to agent visibility.
--
-- NULL = excluded, which is the default for every existing and future row —
-- the D1 decision (consent-gated per-note opt-in) means no note becomes
-- agent-readable without an explicit clinician action. Additive and
-- idempotent, matching the career_garden_notes idiom.

ALTER TABLE "garden_notes"
  ADD COLUMN IF NOT EXISTS "agentConsentAt" TIMESTAMP(3);
