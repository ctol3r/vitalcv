-- Vendor-neutral hire-to-start integration contract. These tables record
-- organization-scoped external mappings and signed inbound receipts without
-- granting an external system authority to create clinician evidence.

ALTER TABLE "activation_requirements"
  ADD COLUMN "external_source_system" TEXT,
  ADD COLUMN "external_object_type" TEXT,
  ADD COLUMN "external_identifier" TEXT,
  ADD COLUMN "external_observed_at" TIMESTAMP(3),
  ADD COLUMN "external_limitation" TEXT;

CREATE TABLE "application_external_references" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "source_system" TEXT NOT NULL,
  "object_type" TEXT NOT NULL,
  "external_identifier" TEXT NOT NULL,
  "first_observed_at" TIMESTAMP(3) NOT NULL,
  "last_observed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "application_external_references_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_external_references_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "application_external_references_external_uq"
  ON "application_external_references"("organization_id", "source_system", "object_type", "external_identifier");
CREATE UNIQUE INDEX "application_external_references_application_uq"
  ON "application_external_references"("application_id", "organization_id", "source_system", "object_type");
CREATE INDEX "application_external_references_application_id_idx"
  ON "application_external_references"("application_id");
CREATE INDEX "application_external_references_organization_id_source_system_idx"
  ON "application_external_references"("organization_id", "source_system");

CREATE TABLE "integration_inbox_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "application_id" UUID,
  "source_system" TEXT NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "signature_key_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processing_state" TEXT NOT NULL DEFAULT 'RECEIVED',
  "processed_at" TIMESTAMP(3),
  "processing_error" TEXT,
  "outbox_event_id" UUID,
  CONSTRAINT "integration_inbox_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_inbox_events_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "integration_inbox_events_processing_state_check"
    CHECK ("processing_state" IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'))
);

CREATE UNIQUE INDEX "integration_inbox_events_external_uq"
  ON "integration_inbox_events"("organization_id", "source_system", "external_event_id");
CREATE INDEX "integration_inbox_events_organization_id_processing_state_received_at_idx"
  ON "integration_inbox_events"("organization_id", "processing_state", "received_at");
CREATE INDEX "integration_inbox_events_application_id_occurred_at_idx"
  ON "integration_inbox_events"("application_id", "occurred_at");
