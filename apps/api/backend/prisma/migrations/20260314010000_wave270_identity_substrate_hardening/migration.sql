-- Wave 270: Identity substrate hardening
-- Append-only identity index artifacts, first-class claim/receipt/source records,
-- and durable source-run job state for replayable ingestion.

-- CreateEnum
CREATE TYPE "SourceRunStatus" AS ENUM (
    'QUEUED',
    'FETCHING',
    'FETCHED',
    'PARSED',
    'NORMALIZED',
    'VERIFIED',
    'ALERTED',
    'QUARANTINED',
    'FAILED'
);

-- CreateEnum
CREATE TYPE "IdentityResolutionDecisionType" AS ENUM (
    'LINK',
    'MERGE',
    'UNMERGE',
    'COLLISION',
    'SKIP'
);

-- CreateEnum
CREATE TYPE "IdentityDeltaType" AS ENUM (
    'CLAIM_ADDED',
    'CLAIM_CHANGED',
    'CLAIM_EXPIRED',
    'EXCLUSION_DETECTED',
    'LICENSE_STATUS_CHANGED'
);

-- CreateTable
CREATE TABLE "source_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" TEXT NOT NULL,
    "subject_npi" TEXT NOT NULL,
    "person_profile_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "status" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "run_summary" JSONB,
    "last_error" TEXT,
    "quarantine_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fetch_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID NOT NULL,
    "state" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "checksum" TEXT,
    "source_url" TEXT,
    "fetch_headers" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fetch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parse_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID NOT NULL,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "state" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "parser_version" TEXT,
    "quarantine_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parse_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_derivation_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID NOT NULL,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "state" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claim_derivation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delta_detection_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID NOT NULL,
    "verification_artifact_id" UUID,
    "state" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delta_detection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID NOT NULL,
    "verification_artifact_id" UUID,
    "state" "SourceRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotency_key" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "backoff_seconds" INTEGER NOT NULL DEFAULT 60,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID,
    "source_id" TEXT NOT NULL,
    "subject_npi" TEXT NOT NULL,
    "person_profile_id" UUID,
    "source_record_key" TEXT NOT NULL,
    "source_url" TEXT,
    "fetch_headers" JSONB,
    "checksum" TEXT NOT NULL,
    "trust_tier" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "observed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "parser_version" TEXT,
    "matching_strategy" TEXT,
    "schema_version" TEXT,
    "status" "SourceRunStatus" NOT NULL DEFAULT 'FETCHED',
    "quarantine_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "claim_id" TEXT NOT NULL,
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "person_profile_id" UUID,
    "subject_npi" TEXT NOT NULL,
    "claim_type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "trust_tier" TEXT NOT NULL,
    "confidence_label" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "source_id" TEXT NOT NULL,
    "parser_version" TEXT NOT NULL,
    "matching_strategy" TEXT,
    "status" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "derived_at" TIMESTAMP(3) NOT NULL,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "superseded_by_claim_id" TEXT,
    "supersedes_claim_id" TEXT,
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "review_reason" TEXT,
    "merge_reason" TEXT,
    "conflict_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_receipt_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_id" TEXT NOT NULL,
    "claim_record_id" UUID,
    "claim_id" TEXT NOT NULL,
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "person_profile_id" UUID,
    "subject_npi" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "trust_tier" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source_artifact_id" TEXT,
    "source_system" TEXT NOT NULL,
    "parser_version" TEXT NOT NULL,
    "matching_strategy" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "explanation" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_receipt_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_resolution_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_npi" TEXT NOT NULL,
    "person_profile_id" UUID,
    "candidate_person_profile_id" UUID,
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "decision_type" "IdentityResolutionDecisionType" NOT NULL,
    "resolution_key" TEXT NOT NULL,
    "matching_strategy" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "merge_reason" TEXT,
    "conflict_reason" TEXT,
    "payload" JSONB,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_resolution_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_claim_deltas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_run_id" UUID,
    "source_record_id" UUID,
    "verification_artifact_id" UUID,
    "previous_claim_record_id" UUID,
    "current_claim_record_id" UUID,
    "subject_npi" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "claim_type" TEXT NOT NULL,
    "delta_type" "IdentityDeltaType" NOT NULL,
    "severity" TEXT NOT NULL,
    "trust_tier" TEXT,
    "previous_value" JSONB,
    "current_value" JSONB,
    "matching_strategy" TEXT,
    "merge_reason" TEXT,
    "conflict_reason" TEXT,
    "checksum" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_claim_deltas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_runs_idempotency_key_key" ON "source_runs"("idempotency_key");
CREATE INDEX "source_runs_source_id_subject_npi_created_at_idx" ON "source_runs"("source_id", "subject_npi", "created_at");
CREATE INDEX "source_runs_status_created_at_idx" ON "source_runs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "fetch_jobs_idempotency_key_key" ON "fetch_jobs"("idempotency_key");
CREATE INDEX "fetch_jobs_source_run_id_state_idx" ON "fetch_jobs"("source_run_id", "state");
CREATE INDEX "fetch_jobs_state_created_at_idx" ON "fetch_jobs"("state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "parse_jobs_idempotency_key_key" ON "parse_jobs"("idempotency_key");
CREATE INDEX "parse_jobs_source_run_id_state_idx" ON "parse_jobs"("source_run_id", "state");
CREATE INDEX "parse_jobs_source_record_id_idx" ON "parse_jobs"("source_record_id");
CREATE INDEX "parse_jobs_verification_artifact_id_idx" ON "parse_jobs"("verification_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_derivation_jobs_idempotency_key_key" ON "claim_derivation_jobs"("idempotency_key");
CREATE INDEX "claim_derivation_jobs_source_run_id_state_idx" ON "claim_derivation_jobs"("source_run_id", "state");
CREATE INDEX "claim_derivation_jobs_source_record_id_idx" ON "claim_derivation_jobs"("source_record_id");
CREATE INDEX "claim_derivation_jobs_verification_artifact_id_idx" ON "claim_derivation_jobs"("verification_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "delta_detection_jobs_idempotency_key_key" ON "delta_detection_jobs"("idempotency_key");
CREATE INDEX "delta_detection_jobs_source_run_id_state_idx" ON "delta_detection_jobs"("source_run_id", "state");
CREATE INDEX "delta_detection_jobs_verification_artifact_id_idx" ON "delta_detection_jobs"("verification_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_jobs_idempotency_key_key" ON "alert_jobs"("idempotency_key");
CREATE INDEX "alert_jobs_source_run_id_state_idx" ON "alert_jobs"("source_run_id", "state");
CREATE INDEX "alert_jobs_verification_artifact_id_idx" ON "alert_jobs"("verification_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_records_source_id_subject_npi_checksum_key" ON "source_records"("source_id", "subject_npi", "checksum");
CREATE INDEX "source_records_source_id_source_record_key_idx" ON "source_records"("source_id", "source_record_key");
CREATE INDEX "source_records_status_created_at_idx" ON "source_records"("status", "created_at");

-- CreateIndex
CREATE INDEX "claim_records_claim_id_idx" ON "claim_records"("claim_id");
CREATE UNIQUE INDEX "claim_records_claim_id_verification_artifact_id_key" ON "claim_records"("claim_id", "verification_artifact_id");
CREATE INDEX "claim_records_subject_npi_claim_type_created_at_idx" ON "claim_records"("subject_npi", "claim_type", "created_at");
CREATE INDEX "claim_records_source_record_id_created_at_idx" ON "claim_records"("source_record_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_receipt_records_receipt_id_key" ON "verification_receipt_records"("receipt_id");
CREATE INDEX "verification_receipt_records_claim_id_idx" ON "verification_receipt_records"("claim_id");
CREATE INDEX "verification_receipt_records_trust_tier_idx" ON "verification_receipt_records"("trust_tier");
CREATE INDEX "verification_receipt_records_subject_npi_issued_at_idx" ON "verification_receipt_records"("subject_npi", "issued_at");
CREATE INDEX "verification_receipt_records_verification_artifact_id_idx" ON "verification_receipt_records"("verification_artifact_id");

-- CreateIndex
CREATE INDEX "identity_resolution_decisions_subject_npi_created_at_idx" ON "identity_resolution_decisions"("subject_npi", "created_at");
CREATE INDEX "identity_resolution_decisions_decision_type_created_at_idx" ON "identity_resolution_decisions"("decision_type", "created_at");
CREATE INDEX "identity_resolution_decisions_resolution_key_idx" ON "identity_resolution_decisions"("resolution_key");

-- CreateIndex
CREATE UNIQUE INDEX "identity_claim_deltas_checksum_key" ON "identity_claim_deltas"("checksum");
CREATE INDEX "identity_claim_deltas_subject_npi_created_at_idx" ON "identity_claim_deltas"("subject_npi", "created_at");
CREATE INDEX "identity_claim_deltas_delta_type_created_at_idx" ON "identity_claim_deltas"("delta_type", "created_at");
CREATE INDEX "identity_claim_deltas_verification_artifact_id_idx" ON "identity_claim_deltas"("verification_artifact_id");
CREATE INDEX "identity_claim_deltas_trust_tier_idx" ON "identity_claim_deltas"("trust_tier");

-- AlterTable
ALTER TABLE "VerificationArtifact"
    ADD COLUMN "artifact_type" TEXT NOT NULL DEFAULT 'GENERIC',
    ADD COLUMN "parser_version" TEXT,
    ADD COLUMN "matching_strategy" TEXT,
    ADD COLUMN "trust_tier" TEXT,
    ADD COLUMN "confidence_score" DOUBLE PRECISION,
    ADD COLUMN "conflict_reason" TEXT,
    ADD COLUMN "merge_reason" TEXT,
    ADD COLUMN "source_run_id" UUID,
    ADD COLUMN "source_record_id" UUID,
    ADD COLUMN "source_url" TEXT,
    ADD COLUMN "fetch_headers" JSONB,
    ADD COLUMN "fetched_at" TIMESTAMP(3),
    ADD COLUMN "observed_at" TIMESTAMP(3),
    ADD COLUMN "generation" INTEGER,
    ADD COLUMN "superseded_by_artifact_id" UUID,
    ADD COLUMN "supersedes_artifact_id" UUID;

-- AlterTable
ALTER TABLE "TrustAlertRecord"
    ADD COLUMN "source_run_id" UUID,
    ADD COLUMN "source_record_id" UUID,
    ADD COLUMN "verification_artifact_id" UUID,
    ADD COLUMN "identity_delta_id" UUID,
    ADD COLUMN "checksum" TEXT,
    ADD COLUMN "observed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "VerificationArtifact_artifact_type_idx" ON "VerificationArtifact"("artifact_type");
CREATE INDEX "VerificationArtifact_parser_version_idx" ON "VerificationArtifact"("parser_version");
CREATE INDEX "VerificationArtifact_matching_strategy_idx" ON "VerificationArtifact"("matching_strategy");
CREATE INDEX "VerificationArtifact_trust_tier_idx" ON "VerificationArtifact"("trust_tier");
CREATE INDEX "VerificationArtifact_source_run_id_idx" ON "VerificationArtifact"("source_run_id");
CREATE INDEX "VerificationArtifact_source_record_id_idx" ON "VerificationArtifact"("source_record_id");
CREATE INDEX "VerificationArtifact_superseded_by_artifact_id_idx" ON "VerificationArtifact"("superseded_by_artifact_id");
CREATE INDEX "VerificationArtifact_supersedes_artifact_id_idx" ON "VerificationArtifact"("supersedes_artifact_id");

-- CreateIndex
CREATE INDEX "source_records_trust_tier_idx" ON "source_records"("trust_tier");

-- CreateIndex
CREATE INDEX "claim_records_trust_tier_idx" ON "claim_records"("trust_tier");
CREATE INDEX "claim_records_status_created_at_idx" ON "claim_records"("status", "created_at");

-- CreateIndex
CREATE INDEX "TrustAlertRecord_source_run_id_idx" ON "TrustAlertRecord"("source_run_id");
CREATE INDEX "TrustAlertRecord_verification_artifact_id_idx" ON "TrustAlertRecord"("verification_artifact_id");
CREATE INDEX "TrustAlertRecord_identity_delta_id_idx" ON "TrustAlertRecord"("identity_delta_id");

-- AddForeignKey
ALTER TABLE "fetch_jobs" ADD CONSTRAINT "fetch_jobs_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parse_jobs" ADD CONSTRAINT "parse_jobs_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_derivation_jobs" ADD CONSTRAINT "claim_derivation_jobs_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delta_detection_jobs" ADD CONSTRAINT "delta_detection_jobs_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_jobs" ADD CONSTRAINT "alert_jobs_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_records" ADD CONSTRAINT "claim_records_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_records" ADD CONSTRAINT "claim_records_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "claim_records" ADD CONSTRAINT "claim_records_verification_artifact_id_fkey" FOREIGN KEY ("verification_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_receipt_records" ADD CONSTRAINT "verification_receipt_records_claim_record_id_fkey" FOREIGN KEY ("claim_record_id") REFERENCES "claim_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_receipt_records" ADD CONSTRAINT "verification_receipt_records_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_receipt_records" ADD CONSTRAINT "verification_receipt_records_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "verification_receipt_records" ADD CONSTRAINT "verification_receipt_records_verification_artifact_id_fkey" FOREIGN KEY ("verification_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_resolution_decisions" ADD CONSTRAINT "identity_resolution_decisions_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_resolution_decisions" ADD CONSTRAINT "identity_resolution_decisions_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_resolution_decisions" ADD CONSTRAINT "identity_resolution_decisions_verification_artifact_id_fkey" FOREIGN KEY ("verification_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_claim_deltas" ADD CONSTRAINT "identity_claim_deltas_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_claim_deltas" ADD CONSTRAINT "identity_claim_deltas_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_claim_deltas" ADD CONSTRAINT "identity_claim_deltas_verification_artifact_id_fkey" FOREIGN KEY ("verification_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_claim_deltas" ADD CONSTRAINT "identity_claim_deltas_previous_claim_record_id_fkey" FOREIGN KEY ("previous_claim_record_id") REFERENCES "claim_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "identity_claim_deltas" ADD CONSTRAINT "identity_claim_deltas_current_claim_record_id_fkey" FOREIGN KEY ("current_claim_record_id") REFERENCES "claim_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationArtifact" ADD CONSTRAINT "VerificationArtifact_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationArtifact" ADD CONSTRAINT "VerificationArtifact_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationArtifact" ADD CONSTRAINT "VerificationArtifact_superseded_by_artifact_id_fkey" FOREIGN KEY ("superseded_by_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationArtifact" ADD CONSTRAINT "VerificationArtifact_supersedes_artifact_id_fkey" FOREIGN KEY ("supersedes_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAlertRecord" ADD CONSTRAINT "TrustAlertRecord_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustAlertRecord" ADD CONSTRAINT "TrustAlertRecord_source_record_id_fkey" FOREIGN KEY ("source_record_id") REFERENCES "source_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustAlertRecord" ADD CONSTRAINT "TrustAlertRecord_verification_artifact_id_fkey" FOREIGN KEY ("verification_artifact_id") REFERENCES "VerificationArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrustAlertRecord" ADD CONSTRAINT "TrustAlertRecord_identity_delta_id_fkey" FOREIGN KEY ("identity_delta_id") REFERENCES "identity_claim_deltas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
