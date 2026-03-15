-- Waves C45-C48: Storyline Engine core persistence
-- Groups fragmented findings into explainable, timeline-aware intelligence narratives.

-- CreateEnum
CREATE TYPE "StorylineType" AS ENUM (
    'TRUST_DECLINE',
    'RISING_INVESTIGATOR',
    'NETWORK_EMERGENCE',
    'COMPLIANCE_RISK',
    'WORKFORCE_OPPORTUNITY',
    'INSTITUTION_SHIFT',
    'INDUSTRY_INFLUENCE'
);

-- CreateEnum
CREATE TYPE "StorylinePerspective" AS ENUM (
    'PROVIDER',
    'INSTITUTION',
    'NETWORK'
);

-- CreateEnum
CREATE TYPE "StorylineSeverity" AS ENUM (
    'INFO',
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- CreateEnum
CREATE TYPE "StorylineStatus" AS ENUM (
    'ACTIVE',
    'QUIET',
    'ESCALATED',
    'RESOLVED',
    'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "StorylineEntityType" AS ENUM (
    'PROVIDER',
    'INSTITUTION',
    'NETWORK',
    'GENERIC'
);

-- CreateEnum
CREATE TYPE "StorylineEventType" AS ENUM (
    'ORIGIN',
    'UPDATED',
    'QUIET_PERIOD',
    'REACTIVATED',
    'RESOLVED',
    'ESCALATED',
    'ARCHIVED',
    'ACKNOWLEDGED'
);

-- CreateEnum
CREATE TYPE "StorylineActionType" AS ENUM (
    'ACKNOWLEDGE',
    'ESCALATE',
    'ARCHIVE',
    'SAVE_INVESTIGATION'
);

-- CreateTable
CREATE TABLE "storylines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storyline_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "storyline_type" "StorylineType" NOT NULL,
    "perspective" "StorylinePerspective" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "why_it_matters" TEXT NOT NULL,
    "severity" "StorylineSeverity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "entity_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "finding_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supporting_evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "recommended_actions" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "progression_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "novelty_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "persistence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escalation_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "last_activity_at" TIMESTAMP(3) NOT NULL,
    "status" "StorylineStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storylines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyline_finding_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storyline_ref_id" UUID NOT NULL,
    "finding_id" TEXT NOT NULL,
    "finding_category" TEXT NOT NULL,
    "finding_severity" "StorylineSeverity" NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storyline_finding_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyline_entity_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storyline_ref_id" UUID NOT NULL,
    "entity_type" "StorylineEntityType" NOT NULL,
    "entity_key" TEXT NOT NULL,
    "entity_label" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storyline_entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyline_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storyline_ref_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "event_type" "StorylineEventType" NOT NULL,
    "summary" TEXT NOT NULL,
    "from_status" "StorylineStatus",
    "to_status" "StorylineStatus",
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storyline_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyline_action_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storyline_ref_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "action_type" "StorylineActionType" NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storyline_action_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storylines_storyline_id_key" ON "storylines"("storyline_id");
CREATE UNIQUE INDEX "storylines_fingerprint_key" ON "storylines"("fingerprint");
CREATE INDEX "storylines_storyline_type_status_updated_at_idx" ON "storylines"("storyline_type", "status", "updated_at");
CREATE INDEX "storylines_perspective_last_activity_at_idx" ON "storylines"("perspective", "last_activity_at");
CREATE INDEX "storylines_severity_updated_at_idx" ON "storylines"("severity", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "storyline_finding_links_storyline_ref_id_finding_id_key" ON "storyline_finding_links"("storyline_ref_id", "finding_id");
CREATE INDEX "storyline_finding_links_finding_id_observed_at_idx" ON "storyline_finding_links"("finding_id", "observed_at");

-- CreateIndex
CREATE UNIQUE INDEX "storyline_entity_links_storyline_ref_id_entity_type_entity_key_key" ON "storyline_entity_links"("storyline_ref_id", "entity_type", "entity_key");
CREATE INDEX "storyline_entity_links_entity_type_entity_key_idx" ON "storyline_entity_links"("entity_type", "entity_key");

-- CreateIndex
CREATE UNIQUE INDEX "storyline_status_events_event_key_key" ON "storyline_status_events"("event_key");
CREATE INDEX "storyline_status_events_storyline_ref_id_occurred_at_idx" ON "storyline_status_events"("storyline_ref_id", "occurred_at");
CREATE INDEX "storyline_status_events_event_type_occurred_at_idx" ON "storyline_status_events"("event_type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "storyline_action_events_event_key_key" ON "storyline_action_events"("event_key");
CREATE INDEX "storyline_action_events_storyline_ref_id_occurred_at_idx" ON "storyline_action_events"("storyline_ref_id", "occurred_at");
CREATE INDEX "storyline_action_events_action_type_occurred_at_idx" ON "storyline_action_events"("action_type", "occurred_at");

-- AddForeignKey
ALTER TABLE "storyline_finding_links"
ADD CONSTRAINT "storyline_finding_links_storyline_ref_id_fkey"
FOREIGN KEY ("storyline_ref_id") REFERENCES "storylines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyline_entity_links"
ADD CONSTRAINT "storyline_entity_links_storyline_ref_id_fkey"
FOREIGN KEY ("storyline_ref_id") REFERENCES "storylines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyline_status_events"
ADD CONSTRAINT "storyline_status_events_storyline_ref_id_fkey"
FOREIGN KEY ("storyline_ref_id") REFERENCES "storylines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyline_action_events"
ADD CONSTRAINT "storyline_action_events_storyline_ref_id_fkey"
FOREIGN KEY ("storyline_ref_id") REFERENCES "storylines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
