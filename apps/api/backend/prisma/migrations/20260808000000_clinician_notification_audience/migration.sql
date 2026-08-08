-- N1 — clinician notification audience.
--
-- Closes the gap where a clinician's employers were told about their
-- expiring credential and the clinician was not.
--
-- Invariants:
--   * clinician_contact_consent_events is APPEND-ONLY. Revocation is a new
--     row with kind='revoked'; rows are never updated or deleted. Current
--     state is the highest-`seq` row per (clinician_npi, channel).
--   * The UNIQUE constraint on (clinician_npi, channel, seq) SERIALIZES
--     concurrent transitions — racing appends compute the same seq, one
--     survives, the loser rolls back whole and retries against the new head.
--     Ordering is never decided by created_at (ms ties are real).
--   * `id` is generated client-side by Prisma — no DB default, matching the
--     fleet's Postgres.
--   * A preference is not a consent. Permission to contact lives only in the
--     consent ledger; the preference table only routes what is permitted.
--   * CREATE TABLE IF NOT EXISTS so existing databases no-op on redeploy.

CREATE TABLE IF NOT EXISTS "clinician_contact_consent_events" (
    "id" UUID NOT NULL,
    "clinician_npi" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "event_hash" TEXT NOT NULL,
    "grant_source" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_contact_consent_events_pkey" PRIMARY KEY ("id")
);

-- The serialization constraint. Load-bearing, not merely an index.
CREATE UNIQUE INDEX IF NOT EXISTS "clinician_contact_consent_events_npi_channel_seq_key" ON "clinician_contact_consent_events"("clinician_npi", "channel", "seq");
CREATE INDEX IF NOT EXISTS "clinician_contact_consent_events_npi_channel_seq_idx" ON "clinician_contact_consent_events"("clinician_npi", "channel", "seq");
CREATE INDEX IF NOT EXISTS "clinician_contact_consent_events_created_at_idx" ON "clinician_contact_consent_events"("created_at");

CREATE TABLE IF NOT EXISTS "clinician_notification_preferences" (
    "id" UUID NOT NULL,
    "clinician_npi" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['EMAIL']::TEXT[],
    "severity_floor" TEXT NOT NULL DEFAULT 'HIGH',
    "suppression_window_minutes" INTEGER NOT NULL DEFAULT 1440,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinician_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinician_notification_preferences_clinician_npi_key" ON "clinician_notification_preferences"("clinician_npi");
