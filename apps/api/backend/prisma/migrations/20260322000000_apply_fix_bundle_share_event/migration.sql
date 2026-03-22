-- Wave APPLY-FIX: BundleShareEvent
-- Tracks every "Sign & Share" action for Apply-with-VitalCV:
-- organization context, webhook delivery, email fallback, and revocation.

CREATE TABLE "bundle_share_events" (
  "id"                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "bundle_id"               UUID        NOT NULL,
  "npi"                     TEXT        NOT NULL,
  "shared_by_clerk_user_id" TEXT        NOT NULL,
  "organization_id"         TEXT        NOT NULL,
  "organization_name"       TEXT        NOT NULL,
  "callback_url"            TEXT,
  "purpose_of_use"          TEXT        NOT NULL,
  "credentials_summary"     JSONB       NOT NULL DEFAULT '{}',
  "webhook_url"             TEXT,
  "webhook_status"          TEXT        NOT NULL DEFAULT 'SKIPPED',
  "webhook_delivered_at"    TIMESTAMPTZ,
  "webhook_error"           TEXT,
  "email_fallback_sent"     BOOLEAN     NOT NULL DEFAULT false,
  "email_fallback_to"       TEXT,
  "revoked_at"              TIMESTAMPTZ,
  "revoked_by_clerk_user_id" TEXT,
  "shared_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at"              TIMESTAMPTZ NOT NULL,

  CONSTRAINT "bundle_share_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bundle_share_events_npi_shared_at_idx"         ON "bundle_share_events"("npi", "shared_at");
CREATE INDEX "bundle_share_events_bundle_id_idx"             ON "bundle_share_events"("bundle_id");
CREATE INDEX "bundle_share_events_organization_id_idx"       ON "bundle_share_events"("organization_id");
CREATE INDEX "bundle_share_events_shared_by_clerk_user_id_idx" ON "bundle_share_events"("shared_by_clerk_user_id");
CREATE INDEX "bundle_share_events_revoked_at_idx"            ON "bundle_share_events"("revoked_at");
