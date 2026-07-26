-- Reconcile migration drift (Seal W0.0)
--
-- The migration chain could NOT rebuild this database from scratch: 18 models
-- in schema.prisma had no CREATE TABLE anywhere in prisma/migrations —
-- including `applications`, the marketplace's core table. They exist in
-- production because the database was built/extended with `prisma db push`
-- (schema-first) instead of migrations. CI never caught it because
-- backend-tests ALSO uses `db push`; only Railway's preflight replays the
-- chain, and until now no migration referenced a drifted table.
--
-- Every statement here is IDEMPOTENT. Production already has these objects, so
-- this migration is a NO-OP there — it changes no data and drops nothing. On a
-- fresh database (CI preflight, local dev, disaster recovery) it creates the
-- missing objects so the chain is self-sufficient again. The DDL is generated
-- from schema.prisma — the same datamodel `db push` used to build production —
-- so fresh databases and production converge on one definition.


DO $$ BEGIN
    CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'DRAFT', 'SUBMITTED', 'VIEWED', 'IN_REVIEW', 'CREDENTIALING', 'COLLECTING_DOCS', 'VERIFICATION', 'WAITING_ON_SOURCE', 'READY_FOR_REVIEW', 'COMMITTEE_REVIEW', 'APPROVED', 'REJECTED', 'STARTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "advisory_outcome_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_context_id" UUID,
    "advisory_version" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "readiness_score_at_event" INTEGER,
    "blockers_at_event" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisory_outcome_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employer_decision_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_context_id" UUID,
    "decision" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "readiness_score_at_decision" INTEGER,
    "blockers_at_decision" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_decision_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "blocker_resolution_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "blocker_code" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolution_days" INTEGER,
    "resolution_method" TEXT,
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocker_resolution_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "start_outcome_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_context_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL,
    "days_from_first_review" INTEGER,
    "days_from_share" INTEGER,
    "days_from_ready" INTEGER,
    "readiness_score_at_start" INTEGER,
    "blockers_at_start" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "start_outcome_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "system_failure_events" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "failure_type" TEXT NOT NULL,
    "failure_message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_failure_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "applications" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "npi" TEXT,
    "cover_note" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "price" DECIMAL(10,2),
    "artifacts" JSONB NOT NULL DEFAULT '[]',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employer_acceptances" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization" TEXT NOT NULL,
    "employer_id" TEXT,
    "clinician_npi" TEXT,
    "artifact_id" TEXT,
    "status" TEXT DEFAULT 'ACCEPTED',
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "accepted_by" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "billing_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "entity_id" TEXT,
    "user_id" TEXT,
    "reference_id" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscription_api_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "api_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "clinician_id" TEXT,
    "tier" TEXT,
    "rate_limit" INTEGER,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employer_webhook_configs" (
    "id" UUID NOT NULL,
    "employer_id" UUID NOT NULL,
    "title" TEXT,
    "webhook_url" TEXT NOT NULL,
    "secret" TEXT,
    "event_type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_webhook_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "feedback" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT,
    "feedback_type" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "residency_programs" (
    "id" UUID NOT NULL,
    "program_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "acgme_code" TEXT,
    "hospital_affiliation" TEXT,
    "state" TEXT,
    "specialty" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "residency_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "specialty_taxonomies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "board_name" TEXT,
    "description" TEXT,
    "category" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialty_taxonomies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "state_compliance_rules" (
    "id" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "specialty" TEXT,
    "required_credential_types" JSONB NOT NULL DEFAULT '[]',
    "renewal_window_days" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_compliance_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PilotMetric" (
    "id" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "employerId" TEXT,
    "actionTaken" TEXT NOT NULL,
    "timeToDecisionMs" INTEGER,
    "decisionStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PilotMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FrictionLog" (
    "id" TEXT NOT NULL,
    "npi" TEXT,
    "employerId" TEXT,
    "contextPhase" TEXT,
    "userComment" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrictionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ValidationBaseline" (
    "id" TEXT NOT NULL,
    "npi" TEXT NOT NULL,
    "expectedIdentity" TEXT,
    "expectedExclusion" TEXT,
    "expectedEnrollment" TEXT,
    "expectedClassification" TEXT,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationBaseline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "start_attestations" (
    "id" UUID NOT NULL,
    "acceptance_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "facility" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "anchored_root" TEXT,
    "event_hash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "start_attestations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "advisory_outcome_events_entity_id_idx" ON "advisory_outcome_events"("entity_id");

CREATE INDEX IF NOT EXISTS "advisory_outcome_events_organization_context_id_idx" ON "advisory_outcome_events"("organization_context_id");

CREATE INDEX IF NOT EXISTS "advisory_outcome_events_event_timestamp_idx" ON "advisory_outcome_events"("event_timestamp");

CREATE INDEX IF NOT EXISTS "employer_decision_events_entity_id_idx" ON "employer_decision_events"("entity_id");

CREATE INDEX IF NOT EXISTS "employer_decision_events_organization_context_id_idx" ON "employer_decision_events"("organization_context_id");

CREATE INDEX IF NOT EXISTS "employer_decision_events_decided_at_idx" ON "employer_decision_events"("decided_at");

CREATE INDEX IF NOT EXISTS "blocker_resolution_events_entity_id_idx" ON "blocker_resolution_events"("entity_id");

CREATE INDEX IF NOT EXISTS "blocker_resolution_events_blocker_code_idx" ON "blocker_resolution_events"("blocker_code");

CREATE INDEX IF NOT EXISTS "blocker_resolution_events_resolved_at_idx" ON "blocker_resolution_events"("resolved_at");

CREATE INDEX IF NOT EXISTS "start_outcome_events_entity_id_idx" ON "start_outcome_events"("entity_id");

CREATE INDEX IF NOT EXISTS "start_outcome_events_organization_context_id_idx" ON "start_outcome_events"("organization_context_id");

CREATE INDEX IF NOT EXISTS "start_outcome_events_started_at_idx" ON "start_outcome_events"("started_at");

CREATE INDEX IF NOT EXISTS "system_failure_events_entity_type_entity_id_idx" ON "system_failure_events"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "system_failure_events_failure_type_idx" ON "system_failure_events"("failure_type");

CREATE INDEX IF NOT EXISTS "system_failure_events_occurred_at_idx" ON "system_failure_events"("occurred_at");

CREATE INDEX IF NOT EXISTS "applications_opportunity_id_idx" ON "applications"("opportunity_id");

CREATE INDEX IF NOT EXISTS "applications_clerk_user_id_idx" ON "applications"("clerk_user_id");

CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "applications_opportunity_id_clerk_user_id_key" ON "applications"("opportunity_id", "clerk_user_id");

CREATE INDEX IF NOT EXISTS "employer_acceptances_employer_id_idx" ON "employer_acceptances"("employer_id");

CREATE INDEX IF NOT EXISTS "employer_acceptances_clinician_npi_idx" ON "employer_acceptances"("clinician_npi");

CREATE INDEX IF NOT EXISTS "employer_acceptances_accepted_at_idx" ON "employer_acceptances"("accepted_at");

CREATE INDEX IF NOT EXISTS "billing_events_event_type_idx" ON "billing_events"("event_type");

CREATE INDEX IF NOT EXISTS "billing_events_entity_id_idx" ON "billing_events"("entity_id");

CREATE INDEX IF NOT EXISTS "billing_events_user_id_idx" ON "billing_events"("user_id");

CREATE INDEX IF NOT EXISTS "billing_events_occurred_at_idx" ON "billing_events"("occurred_at");

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_api_keys_api_key_key" ON "subscription_api_keys"("api_key");

CREATE INDEX IF NOT EXISTS "subscription_api_keys_organization_id_idx" ON "subscription_api_keys"("organization_id");

CREATE INDEX IF NOT EXISTS "subscription_api_keys_api_key_idx" ON "subscription_api_keys"("api_key");

CREATE INDEX IF NOT EXISTS "employer_webhook_configs_employer_id_idx" ON "employer_webhook_configs"("employer_id");

CREATE INDEX IF NOT EXISTS "employer_webhook_configs_event_type_idx" ON "employer_webhook_configs"("event_type");

CREATE INDEX IF NOT EXISTS "feedback_entity_type_entity_id_idx" ON "feedback"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "feedback_user_id_idx" ON "feedback"("user_id");

CREATE INDEX IF NOT EXISTS "feedback_feedback_type_idx" ON "feedback"("feedback_type");

CREATE INDEX IF NOT EXISTS "residency_programs_institution_idx" ON "residency_programs"("institution");

CREATE INDEX IF NOT EXISTS "residency_programs_state_specialty_idx" ON "residency_programs"("state", "specialty");

CREATE UNIQUE INDEX IF NOT EXISTS "specialty_taxonomies_code_key" ON "specialty_taxonomies"("code");

CREATE INDEX IF NOT EXISTS "specialty_taxonomies_code_idx" ON "specialty_taxonomies"("code");

CREATE INDEX IF NOT EXISTS "specialty_taxonomies_category_idx" ON "specialty_taxonomies"("category");

CREATE INDEX IF NOT EXISTS "state_compliance_rules_state_idx" ON "state_compliance_rules"("state");

CREATE UNIQUE INDEX IF NOT EXISTS "state_compliance_rules_state_rule_type_key" ON "state_compliance_rules"("state", "rule_type");

CREATE INDEX IF NOT EXISTS "PilotMetric_npi_idx" ON "PilotMetric"("npi");

CREATE INDEX IF NOT EXISTS "PilotMetric_employerId_idx" ON "PilotMetric"("employerId");

CREATE INDEX IF NOT EXISTS "PilotMetric_createdAt_idx" ON "PilotMetric"("createdAt");

CREATE INDEX IF NOT EXISTS "FrictionLog_npi_idx" ON "FrictionLog"("npi");

CREATE INDEX IF NOT EXISTS "FrictionLog_resolved_idx" ON "FrictionLog"("resolved");

CREATE INDEX IF NOT EXISTS "FrictionLog_createdAt_idx" ON "FrictionLog"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ValidationBaseline_npi_key" ON "ValidationBaseline"("npi");

CREATE INDEX IF NOT EXISTS "ValidationBaseline_npi_idx" ON "ValidationBaseline"("npi");

CREATE INDEX IF NOT EXISTS "start_attestations_acceptance_id_idx" ON "start_attestations"("acceptance_id");

DO $$ BEGIN
    ALTER TABLE "advisory_outcome_events" ADD CONSTRAINT "advisory_outcome_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "advisory_outcome_events" ADD CONSTRAINT "advisory_outcome_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "employer_decision_events" ADD CONSTRAINT "employer_decision_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "employer_decision_events" ADD CONSTRAINT "employer_decision_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "blocker_resolution_events" ADD CONSTRAINT "blocker_resolution_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "start_outcome_events" ADD CONSTRAINT "start_outcome_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "start_outcome_events" ADD CONSTRAINT "start_outcome_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "applications" ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
