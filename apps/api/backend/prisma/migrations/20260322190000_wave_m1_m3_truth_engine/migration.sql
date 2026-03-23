-- MegaWaves M1-M3 Truth Engine Hardening
-- Adds deterministic VcvCredential materialization fields,
-- persisted ingest run/event tables, and auditable share lineage fields.

-- ── VcvCredential hardening ────────────────────────────────────────────────

ALTER TABLE "vcv_credentials"
  ADD COLUMN "credential_key" TEXT,
  ADD COLUMN "credential_family_key" TEXT,
  ADD COLUMN "receipt_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "observed_at" TIMESTAMPTZ,
  ADD COLUMN "trust_tier" TEXT,
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "superseded_by_credential_id" UUID,
  ADD COLUMN "supersedes_credential_id" UUID;

UPDATE "vcv_credentials"
SET
  "credential_key" = COALESCE("credential_key", 'legacy:' || "id"::text),
  "credential_family_key" = COALESCE("credential_family_key", 'legacy:' || "id"::text)
WHERE "credential_key" IS NULL
   OR "credential_family_key" IS NULL;

ALTER TABLE "vcv_credentials"
  ALTER COLUMN "credential_key" SET NOT NULL,
  ALTER COLUMN "credential_family_key" SET NOT NULL;

ALTER TABLE "vcv_credentials"
  ADD CONSTRAINT "vcv_credentials_credential_key_key" UNIQUE ("credential_key"),
  ADD CONSTRAINT "vcv_credentials_superseded_by_fk"
    FOREIGN KEY ("superseded_by_credential_id") REFERENCES "vcv_credentials"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "vcv_credentials_supersedes_fk"
    FOREIGN KEY ("supersedes_credential_id") REFERENCES "vcv_credentials"("id") ON DELETE SET NULL;

CREATE INDEX "vcv_cred_observed_idx" ON "vcv_credentials"("observed_at");
CREATE INDEX "vcv_cred_family_idx" ON "vcv_credentials"("credential_family_key");

-- ── Persisted ingest runtime ────────────────────────────────────────────────

CREATE TABLE "ingest_runs" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "npi"          TEXT        NOT NULL,
  "status"       TEXT        NOT NULL DEFAULT 'PENDING',
  "entity_id"    UUID,
  "last_error"   TEXT,
  "started_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ingest_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingest_runs_npi_status_idx" ON "ingest_runs"("npi", "status");
CREATE INDEX "ingest_runs_created_at_idx" ON "ingest_runs"("created_at");

CREATE TABLE "ingest_source_runs" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "ingest_run_id"    UUID        NOT NULL,
  "source_id"        TEXT        NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'PENDING',
  "source_run_id"    UUID,
  "artifact_id"      UUID,
  "claim_count"      INTEGER     NOT NULL DEFAULT 0,
  "credential_count" INTEGER     NOT NULL DEFAULT 0,
  "error_code"       TEXT,
  "last_error"       TEXT,
  "started_at"       TIMESTAMPTZ,
  "completed_at"     TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ingest_source_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingest_source_runs_ingest_run_fk"
    FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_runs"("id") ON DELETE CASCADE,
  CONSTRAINT "ingest_source_runs_source_run_fk"
    FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL,
  CONSTRAINT "ingest_source_runs_ingest_run_source_uq" UNIQUE ("ingest_run_id", "source_id")
);

CREATE INDEX "ingest_source_runs_source_run_idx" ON "ingest_source_runs"("source_run_id");
CREATE INDEX "ingest_source_runs_status_created_idx" ON "ingest_source_runs"("status", "created_at");

CREATE TABLE "ingest_events" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "ingest_run_id" UUID        NOT NULL,
  "sequence"      INTEGER     NOT NULL,
  "event_type"    TEXT        NOT NULL,
  "source_id"     TEXT,
  "dedupe_key"    TEXT        NOT NULL,
  "payload"       JSONB       NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ingest_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingest_events_ingest_run_fk"
    FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_runs"("id") ON DELETE CASCADE,
  CONSTRAINT "ingest_events_ingest_run_sequence_uq" UNIQUE ("ingest_run_id", "sequence"),
  CONSTRAINT "ingest_events_ingest_run_dedupe_uq" UNIQUE ("ingest_run_id", "dedupe_key")
);

CREATE INDEX "ingest_events_run_created_idx" ON "ingest_events"("ingest_run_id", "created_at");

-- ── BundleShareEvent lineage ────────────────────────────────────────────────

ALTER TABLE "bundle_share_events"
  ADD COLUMN "organization_context_id" UUID,
  ADD COLUMN "subject_entity_id" UUID,
  ADD COLUMN "delivery_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "checked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN "bundle_payload" JSONB,
  ADD COLUMN "receipt_refs" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "source_coverage" JSONB;

UPDATE "bundle_share_events"
SET
  "checked_at" = COALESCE("shared_at", NOW()),
  "delivery_status" = CASE
    WHEN "webhook_status" = 'DELIVERED' THEN 'DELIVERED'
    WHEN "webhook_status" = 'FAILED' THEN 'FAILED'
    WHEN "email_fallback_sent" = true THEN 'MANUAL_FALLBACK'
    ELSE 'PENDING'
  END;

ALTER TABLE "bundle_share_events"
  ADD CONSTRAINT "bundle_share_events_org_context_fk"
    FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "bundle_share_events_subject_entity_fk"
    FOREIGN KEY ("subject_entity_id") REFERENCES "vcv_entities"("id") ON DELETE SET NULL;

CREATE INDEX "bundle_share_events_org_context_idx" ON "bundle_share_events"("organization_context_id");
CREATE INDEX "bundle_share_events_subject_entity_idx" ON "bundle_share_events"("subject_entity_id");
CREATE INDEX "bundle_share_events_delivery_status_shared_at_idx" ON "bundle_share_events"("delivery_status", "shared_at");
