-- PR J2 — MATCHA Discover (the swipe deck) writes its decisions to the SAME
-- append-only OpportunityAction log the Save/Connect/Decline board uses, so a
-- role saved on one surface is the same role the other shows as decided. The
-- deck records richer provenance than the board did, so these columns are
-- added additively.
--
-- Additive + nullable (or defaulted) + IF NOT EXISTS → safe and idempotent on
-- any environment, and every pre-deck row stays valid without a backfill:
-- existing rows are board rows, which is exactly what the `surface` default
-- says.
ALTER TABLE "OpportunityAction" ADD COLUMN IF NOT EXISTS "surface" TEXT NOT NULL DEFAULT 'board';
ALTER TABLE "OpportunityAction" ADD COLUMN IF NOT EXISTS "opportunityVersion" TEXT;
ALTER TABLE "OpportunityAction" ADD COLUMN IF NOT EXISTS "recommendationId" TEXT;
ALTER TABLE "OpportunityAction" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "OpportunityAction" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- Idempotency key: a retried or replayed emit of the SAME user intent collapses
-- onto one row instead of duplicating the event. NULL is allowed and repeatable
-- under a Postgres unique index, so board rows (which never set it) are
-- unaffected.
ALTER TABLE "OpportunityAction" ADD COLUMN IF NOT EXISTS "clientSignalId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "OpportunityAction_clientSignalId_key"
  ON "OpportunityAction"("clientSignalId");

-- Deck reads are "this clinician's signals on this surface, newest first".
CREATE INDEX IF NOT EXISTS "OpportunityAction_clerkUserId_surface_createdAt_idx"
  ON "OpportunityAction"("clerkUserId", "surface", "createdAt");
