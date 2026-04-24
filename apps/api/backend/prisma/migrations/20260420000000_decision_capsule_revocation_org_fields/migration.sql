-- Add columns to DecisionCapsule that exist in the Prisma schema but were
-- never captured in a migration file (schema drift from wave releases).
--
-- impactedByRevocation: whether this capsule was retroactively affected by a
--   revocation event (Boolean, defaults false — safe to backfill).
-- organizationId: the org that triggered the decision (nullable UUID).

ALTER TABLE "DecisionCapsule"
  ADD COLUMN IF NOT EXISTS "impactedByRevocation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "organizationId"       UUID;
