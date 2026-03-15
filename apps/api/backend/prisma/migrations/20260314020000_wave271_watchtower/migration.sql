-- Wave 271: Watchtower monitoring substrate
-- Append-only monitoring events, watchlists, and alert delivery receipts.

-- Extend existing delta enum for broader watchtower change classes.
ALTER TYPE "IdentityDeltaType" ADD VALUE IF NOT EXISTS 'NEW_SANCTION_HIT';
ALTER TYPE "IdentityDeltaType" ADD VALUE IF NOT EXISTS 'NEW_PAYMENT_RELATIONSHIP';
ALTER TYPE "IdentityDeltaType" ADD VALUE IF NOT EXISTS 'PROVIDER_MOVED_ORGANIZATION';
ALTER TYPE "IdentityDeltaType" ADD VALUE IF NOT EXISTS 'PROVIDER_MOVED_LOCATION';
ALTER TYPE "IdentityDeltaType" ADD VALUE IF NOT EXISTS 'LICENSE_STATE_CHANGED';
ALTER TYPE "IdentityDeltaType" ADD VALUE IF NOT EXISTS 'BOARD_CERT_STATUS_CHANGED';

-- CreateEnum
CREATE TYPE "MonitoringSeverity" AS ENUM (
    'INFO',
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- CreateEnum
CREATE TYPE "EntityChangeEventType" AS ENUM (
    'CLAIM_VALUE_CHANGED',
    'CLAIM_EXPIRED',
    'NEW_SANCTION_HIT',
    'NEW_PAYMENT_RELATIONSHIP',
    'PROVIDER_MOVED_ORGANIZATION',
    'PROVIDER_MOVED_LOCATION',
    'LICENSE_STATE_CHANGED',
    'LICENSE_STATUS_CHANGED',
    'BOARD_CERT_STATUS_CHANGED'
);

-- CreateEnum
CREATE TYPE "SourceStalenessStatus" AS ENUM (
    'STALE',
    'DISAPPEARED'
);

-- CreateEnum
CREATE TYPE "TrustDegradationReason" AS ENUM (
    'CLAIM_EXPIRED',
    'NEW_SANCTION_HIT',
    'LICENSE_STATUS_CHANGED',
    'BOARD_CERT_STATUS_CHANGED',
    'SOURCE_STALE',
    'SOURCE_DISAPPEARED'
);

-- CreateEnum
CREATE TYPE "WatchlistTargetType" AS ENUM (
    'PROVIDER',
    'INSTITUTION',
    'CLAIM_CLASS'
);

-- CreateEnum
CREATE TYPE "AlertDeliveryChannel" AS ENUM (
    'INTERNAL_FEED',
    'WEBHOOK',
    'EVENT_SINK',
    'EMAIL',
    'SLACK'
);

-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM (
    'DELIVERED',
    'PENDING',
    'SUPPRESSED',
    'DEDUPED',
    'FAILED',
    'NOT_CONFIGURED'
);

-- CreateTable
CREATE TABLE "entity_change_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "identity_delta_id" UUID,
    "subject_npi" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "claim_type" TEXT,
    "field_path" TEXT,
    "event_type" "EntityChangeEventType" NOT NULL,
    "severity" "MonitoringSeverity" NOT NULL,
    "previous_value" JSONB,
    "current_value" JSONB,
    "checksum" TEXT NOT NULL,
    "metadata" JSONB,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_staleness_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "subject_npi" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "SourceStalenessStatus" NOT NULL,
    "severity" "MonitoringSeverity" NOT NULL,
    "sla_hours" INTEGER NOT NULL,
    "trust_tier" TEXT,
    "last_observed_at" TIMESTAMP(3),
    "stale_since" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_staleness_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_degradation_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "entity_change_event_id" UUID,
    "source_staleness_event_id" UUID,
    "subject_npi" TEXT NOT NULL,
    "claim_type" TEXT,
    "reason" "TrustDegradationReason" NOT NULL,
    "severity" "MonitoringSeverity" NOT NULL,
    "checksum" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_degradation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dedupe_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_organization_id" UUID,
    "target_type" "WatchlistTargetType" NOT NULL,
    "target_value" TEXT NOT NULL,
    "claim_type" TEXT,
    "field_path" TEXT,
    "severity_floor" "MonitoringSeverity" NOT NULL DEFAULT 'LOW',
    "suppression_window_minutes" INTEGER NOT NULL DEFAULT 1440,
    "delivery_channels" TEXT[] NOT NULL DEFAULT ARRAY['INTERNAL_FEED']::TEXT[],
    "webhook_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_hits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "watchlist_id" UUID NOT NULL,
    "trust_alert_record_id" UUID,
    "entity_change_event_id" UUID,
    "source_staleness_event_id" UUID,
    "trust_degradation_event_id" UUID,
    "subject_npi" TEXT,
    "organization_key" TEXT,
    "claim_type" TEXT,
    "field_path" TEXT,
    "severity" "MonitoringSeverity" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_delivery_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trust_alert_record_id" UUID,
    "watchlist_id" UUID,
    "channel" "AlertDeliveryChannel" NOT NULL,
    "destination" TEXT,
    "status" "AlertDeliveryStatus" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB,
    "response_code" INTEGER,
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_change_events_checksum_key" ON "entity_change_events"("checksum");
CREATE INDEX "entity_change_events_subject_npi_created_at_idx" ON "entity_change_events"("subject_npi", "created_at");
CREATE INDEX "entity_change_events_source_id_event_type_created_at_idx" ON "entity_change_events"("source_id", "event_type", "created_at");
CREATE INDEX "entity_change_events_claim_type_created_at_idx" ON "entity_change_events"("claim_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_staleness_events_checksum_key" ON "source_staleness_events"("checksum");
CREATE INDEX "source_staleness_events_subject_npi_created_at_idx" ON "source_staleness_events"("subject_npi", "created_at");
CREATE INDEX "source_staleness_events_source_id_status_created_at_idx" ON "source_staleness_events"("source_id", "status", "created_at");
CREATE INDEX "source_staleness_events_severity_created_at_idx" ON "source_staleness_events"("severity", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "trust_degradation_events_checksum_key" ON "trust_degradation_events"("checksum");
CREATE INDEX "trust_degradation_events_subject_npi_created_at_idx" ON "trust_degradation_events"("subject_npi", "created_at");
CREATE INDEX "trust_degradation_events_reason_created_at_idx" ON "trust_degradation_events"("reason", "created_at");
CREATE INDEX "trust_degradation_events_severity_created_at_idx" ON "trust_degradation_events"("severity", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "watchlists_dedupe_key_key" ON "watchlists"("dedupe_key");
CREATE INDEX "watchlists_target_type_target_value_active_idx" ON "watchlists"("target_type", "target_value", "active");
CREATE INDEX "watchlists_claim_type_field_path_active_idx" ON "watchlists"("claim_type", "field_path", "active");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_hits_dedupe_key_key" ON "watchlist_hits"("dedupe_key");
CREATE INDEX "watchlist_hits_watchlist_id_created_at_idx" ON "watchlist_hits"("watchlist_id", "created_at");
CREATE INDEX "watchlist_hits_subject_npi_created_at_idx" ON "watchlist_hits"("subject_npi", "created_at");
CREATE INDEX "watchlist_hits_severity_created_at_idx" ON "watchlist_hits"("severity", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "alert_delivery_attempts_dedupe_key_key" ON "alert_delivery_attempts"("dedupe_key");
CREATE INDEX "alert_delivery_attempts_trust_alert_record_id_created_at_idx" ON "alert_delivery_attempts"("trust_alert_record_id", "created_at");
CREATE INDEX "alert_delivery_attempts_watchlist_id_created_at_idx" ON "alert_delivery_attempts"("watchlist_id", "created_at");
CREATE INDEX "alert_delivery_attempts_channel_status_created_at_idx" ON "alert_delivery_attempts"("channel", "status", "created_at");
