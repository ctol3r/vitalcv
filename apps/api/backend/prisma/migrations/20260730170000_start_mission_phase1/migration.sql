-- Start Mission Phase 1
-- Additive only: no legacy packet, activation, request, or audit row is rewritten.

-- Preserve PENDING / COMPLETE / FAILED for the manual PSV store and add the
-- mission lifecycle as new enum values.
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_AUTHORIZATION';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SEND';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'AWAITING_RESPONSE';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'RESPONSE_RECEIVED';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'SATISFIED';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_SATISFIED';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'UNABLE_TO_VERIFY';
ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- VerificationRequest is a legacy, unmapped Prisma model, so the real table is
-- quoted PascalCase. New fields use their explicit @map snake_case names.
ALTER TABLE "VerificationRequest"
  ADD COLUMN IF NOT EXISTS "application_id" UUID,
  ADD COLUMN IF NOT EXISTS "start_activation_id" UUID,
  ADD COLUMN IF NOT EXISTS "activation_requirement_id" UUID,
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "issuer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "requested_claim" TEXT,
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "authorization_consent_id" UUID,
  ADD COLUMN IF NOT EXISTS "preferred_channel" TEXT,
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "next_follow_up_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "assigned_to" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationRequest_idempotency_key_key"
  ON "VerificationRequest"("idempotency_key");
CREATE INDEX IF NOT EXISTS "VerificationRequest_application_id_status_idx"
  ON "VerificationRequest"("application_id", "status");
CREATE INDEX IF NOT EXISTS "VerificationRequest_start_activation_id_status_idx"
  ON "VerificationRequest"("start_activation_id", "status");
CREATE INDEX IF NOT EXISTS "VerificationRequest_activation_requirement_id_idx"
  ON "VerificationRequest"("activation_requirement_id");
CREATE INDEX IF NOT EXISTS "VerificationRequest_issuer_id_status_idx"
  ON "VerificationRequest"("issuer_id", "status");
CREATE INDEX IF NOT EXISTS "VerificationRequest_next_follow_up_at_status_idx"
  ON "VerificationRequest"("next_follow_up_at", "status");

-- Nullable and omitted from canonical packet bytes for legacy rows.
ALTER TABLE "application_packets"
  ADD COLUMN IF NOT EXISTS "consent_grant_id" UUID;

ALTER TABLE "start_activations"
  ADD COLUMN IF NOT EXISTS "application_id" UUID,
  ADD COLUMN IF NOT EXISTS "opportunity_id" UUID,
  ADD COLUMN IF NOT EXISTS "accepted_packet_id" UUID,
  ADD COLUMN IF NOT EXISTS "accepted_packet_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "intended_start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "urgency" TEXT NOT NULL DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS "policy_version" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "start_activations_application_id_key"
  ON "start_activations"("application_id");
CREATE INDEX IF NOT EXISTS "start_activations_opportunity_id_idx"
  ON "start_activations"("opportunity_id");
CREATE INDEX IF NOT EXISTS "start_activations_activation_state_intended_start_date_idx"
  ON "start_activations"("activation_state", "intended_start_date");

ALTER TABLE "start_activations"
  DROP CONSTRAINT IF EXISTS "start_activations_urgency_check";
ALTER TABLE "start_activations"
  ADD CONSTRAINT "start_activations_urgency_check"
  CHECK ("urgency" IN ('routine', 'priority', 'critical'));

CREATE TABLE IF NOT EXISTS "consent_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clinician_user_id" TEXT NOT NULL,
  "clinician_npi" TEXT NOT NULL,
  "organization_id" UUID NOT NULL,
  "recipient" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "packet_id" UUID,
  "packet_hash" TEXT,
  "application_id" UUID,
  "start_activation_id" UUID,
  "verification_request_id" UUID,
  "authentication_method" TEXT NOT NULL,
  "authentication_ref" TEXT,
  "granted_at" TIMESTAMP(3) NOT NULL,
  "valid_until" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revoked_reason" TEXT,
  "superseded_by_id" UUID,
  "grant_hash" TEXT NOT NULL,
  "audit_event_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "consent_grants_grant_hash_key" ON "consent_grants"("grant_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "consent_grants_audit_event_id_key" ON "consent_grants"("audit_event_id");
CREATE INDEX IF NOT EXISTS "consent_grants_clinician_user_id_granted_at_idx" ON "consent_grants"("clinician_user_id", "granted_at");
CREATE INDEX IF NOT EXISTS "consent_grants_organization_id_granted_at_idx" ON "consent_grants"("organization_id", "granted_at");
CREATE INDEX IF NOT EXISTS "consent_grants_application_id_idx" ON "consent_grants"("application_id");
CREATE INDEX IF NOT EXISTS "consent_grants_start_activation_id_idx" ON "consent_grants"("start_activation_id");
CREATE INDEX IF NOT EXISTS "consent_grants_verification_request_id_idx" ON "consent_grants"("verification_request_id");

CREATE TABLE IF NOT EXISTS "communication_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "start_activation_id" UUID,
  "application_id" UUID,
  "verification_request_id" UUID,
  "activation_requirement_id" UUID,
  "organization_id" UUID,
  "clinician_id" TEXT,
  "issuer_id" TEXT,
  "direction" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sender_ref" TEXT,
  "recipient_ref" TEXT,
  "provider_message_id" TEXT,
  "thread_key" TEXT,
  "subject" TEXT,
  "redacted_summary" TEXT,
  "content_hash" TEXT,
  "encrypted_content_ref" TEXT,
  "attachment_refs" JSONB NOT NULL DEFAULT '[]',
  "consent_grant_id" UUID,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "audit_event_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "communication_events_audit_event_id_key" ON "communication_events"("audit_event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "communication_events_channel_provider_message_uq" ON "communication_events"("channel", "provider_message_id");
CREATE INDEX IF NOT EXISTS "communication_events_verification_request_id_occurred_at_idx" ON "communication_events"("verification_request_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "communication_events_start_activation_id_occurred_at_idx" ON "communication_events"("start_activation_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "communication_events_thread_key_occurred_at_idx" ON "communication_events"("thread_key", "occurred_at");
CREATE INDEX IF NOT EXISTS "communication_events_issuer_id_occurred_at_idx" ON "communication_events"("issuer_id", "occurred_at");

CREATE TABLE IF NOT EXISTS "handoff_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "handoff_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "application_id" UUID,
  "start_activation_id" UUID,
  "verification_request_id" UUID,
  "communication_event_id" UUID,
  "consent_grant_id" UUID NOT NULL,
  "packet_id" UUID,
  "packet_hash" TEXT,
  "payload_hash" TEXT NOT NULL,
  "recipient_organization_id" UUID,
  "recipient" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "transport_provider" TEXT,
  "provider_message_id" TEXT,
  "status" TEXT NOT NULL,
  "limitation" TEXT,
  "delivered_at" TIMESTAMP(3),
  "acknowledged_at" TIMESTAMP(3),
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receipt_hash" TEXT NOT NULL,
  "audit_event_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "handoff_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "handoff_receipts_attempt_number_check" CHECK ("attempt_number" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "handoff_receipts_receipt_hash_key" ON "handoff_receipts"("receipt_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "handoff_receipts_audit_event_id_key" ON "handoff_receipts"("audit_event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "handoff_receipts_handoff_id_attempt_number_key" ON "handoff_receipts"("handoff_id", "attempt_number");
CREATE INDEX IF NOT EXISTS "handoff_receipts_application_id_issued_at_idx" ON "handoff_receipts"("application_id", "issued_at");
CREATE INDEX IF NOT EXISTS "handoff_receipts_start_activation_id_issued_at_idx" ON "handoff_receipts"("start_activation_id", "issued_at");
CREATE INDEX IF NOT EXISTS "handoff_receipts_recipient_organization_id_issued_at_idx" ON "handoff_receipts"("recipient_organization_id", "issued_at");
CREATE INDEX IF NOT EXISTS "handoff_receipts_status_issued_at_idx" ON "handoff_receipts"("status", "issued_at");
