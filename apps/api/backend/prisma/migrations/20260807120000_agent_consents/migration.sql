-- FOUNDER WAVE A1 — agent consent ledger (agent_consent_events).
--
-- Invariants:
--   * Append-only: rows are never updated or deleted; revocation is a NEW
--     event with kind 'revoked'. Current state is the highest-`seq` event
--     per (subject_ref, scope).
--   * `seq` is a per-(subject_ref, scope) monotonic counter, and the UNIQUE
--     constraint on (subject_ref, scope, seq) is what SERIALIZES concurrent
--     transitions: two appends racing for the same seq cannot both land, so
--     the loser rolls back whole (audit row included) and retries against
--     the new head. Ordering is never decided by created_at (millisecond
--     ties are real) or by uuid order (arbitrary).
--   * `id` is generated client-side by Prisma (`@default(uuid())`) — no
--     DB-level default, matching the fleet's Postgres.
--   * `event_hash` is a sha256 over the event INCLUDING its id and seq, so a
--     re-grant after revoke is a distinct record.
--   * CREATE TABLE IF NOT EXISTS so existing databases no-op on redeploy.

CREATE TABLE IF NOT EXISTS "agent_consent_events" (
    "id" UUID NOT NULL,
    "subject_ref" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "event_hash" TEXT NOT NULL,
    "action_id" TEXT,
    "plan_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_consent_events_pkey" PRIMARY KEY ("id")
);

-- The serialization constraint. Load-bearing, not merely an index.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_consent_events_subject_ref_scope_seq_key" ON "agent_consent_events"("subject_ref", "scope", "seq");
CREATE INDEX IF NOT EXISTS "agent_consent_events_subject_ref_scope_seq_idx" ON "agent_consent_events"("subject_ref", "scope", "seq");
CREATE INDEX IF NOT EXISTS "agent_consent_events_created_at_idx" ON "agent_consent_events"("created_at");
