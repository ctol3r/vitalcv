-- FOUNDER WAVE A1 — agent consent ledger (agent_consent_events).
--
-- Invariants:
--   * Append-only: rows are never updated or deleted; revocation is a NEW
--     event with kind 'revoked'. Current state = latest event per
--     (subject_ref, scope).
--   * `id` is generated client-side by Prisma (`@default(uuid())`) — no
--     DB-level default, matching the fleet's Postgres.
--   * `event_hash` is a sha256 over the event INCLUDING its id, so a
--     re-grant after revoke is a distinct record.
--   * CREATE TABLE IF NOT EXISTS so existing databases no-op on redeploy.

CREATE TABLE IF NOT EXISTS "agent_consent_events" (
    "id" UUID NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "event_hash" TEXT NOT NULL,
    "action_id" TEXT,
    "plan_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_consent_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_consent_events_subject_ref_scope_created_at_idx" ON "agent_consent_events"("subject_ref", "scope", "created_at");
CREATE INDEX IF NOT EXISTS "agent_consent_events_created_at_idx" ON "agent_consent_events"("created_at");
