-- Add impactedByRevocation and organizationId to DecisionCapsule.
-- These fields were added to schema.prisma after the original table creation
-- in wave196_production_hardening but before a migration was generated.

ALTER TABLE "DecisionCapsule"
  ADD COLUMN IF NOT EXISTS "impactedByRevocation" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DecisionCapsule"
  ADD COLUMN IF NOT EXISTS "organizationId" UUID;
