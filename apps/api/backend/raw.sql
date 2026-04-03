-- DropForeignKey
ALTER TABLE "StartAttestation" DROP CONSTRAINT "StartAttestation_acceptanceId_fkey";

-- AlterTable
ALTER TABLE "EmployerAcceptance" ADD COLUMN     "acceptanceReason" TEXT,
ADD COLUMN     "acceptanceScope" TEXT NOT NULL DEFAULT 'pilot',
ADD COLUMN     "acceptedByOrgId" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "acceptedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StartAttestation" DROP COLUMN "anchoredAt",
DROP COLUMN "startDate",
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vcv_org_context_status_events" RENAME CONSTRAINT "vcv_org_ctx_evt_pkey" TO "vcv_org_context_status_events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vcv_org_context_subjects" RENAME CONSTRAINT "vcv_org_ctx_subj_pkey" TO "vcv_org_context_subjects_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "reviewed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "invited_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "responded_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vcv_organization_contexts" RENAME CONSTRAINT "vcv_org_ctx_pkey" TO "vcv_organization_contexts_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "due_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vcv_user_entity_claims" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "claimed_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_receipt_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "retrieved_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "watchlist_hits" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "watchlists" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspace_memberships" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workspace_preferences" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "npi" TEXT,
    "cover_note" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAnalytics" (
    "id" UUID NOT NULL,
    "organizationId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstVerifiedAt" TIMESTAMP(3),
    "firstProofIssuedAt" TIMESTAMP(3),
    "psvCompletedAt" TIMESTAMP(3),
    "daysToVerification" INTEGER,
    "daysToPSVCompletion" INTEGER,

    CONSTRAINT "OnboardingAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemFailureEvent" (
    "id" UUID NOT NULL,
    "component" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "artifactId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemFailureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalSchool" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "accreditation_status" TEXT NOT NULL DEFAULT 'LCME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidencyProgram" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "acgme_code" TEXT NOT NULL,
    "hospital_affiliation" TEXT NOT NULL,
    "medicalSchoolId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidencyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyTaxonomy" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "board_name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyTaxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateComplianceRule" (
    "id" UUID NOT NULL,
    "state_code" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "required_credential_types" TEXT[],
    "renewal_window_days" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusListState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "encoded" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "sizeBits" INTEGER NOT NULL DEFAULT 131072,
    "nextIndex" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusListState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerWebhookConfig" (
    "id" UUID NOT NULL,
    "employerId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "signingSecret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerWebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" UUID NOT NULL,
    "employerId" TEXT NOT NULL,
    "startAttestationId" UUID NOT NULL,
    "stripeInvoiceItemId" TEXT,
    "stripeCustomerId" TEXT,
    "amountCents" INTEGER NOT NULL DEFAULT 3799,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "clinicianId" UUID NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeSubId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionApiKey" (
    "id" UUID NOT NULL,
    "clinicianId" UUID NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STARTER',
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "score" INTEGER,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisory_outcome_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_context_id" UUID,
    "advisory_version" TEXT NOT NULL,
    "advisory_input_snapshot_ref" TEXT,
    "advisory_output_snapshot_ref" TEXT,
    "event_type" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockers_at_event" JSONB NOT NULL DEFAULT '[]',
    "readiness_score_at_event" INTEGER,
    "source_coverage_at_event" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "advisory_outcome_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocker_resolution_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "blocker_code" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolution_days" INTEGER,
    "resolution_method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "blocker_resolution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_decision_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_context_id" UUID,
    "decision" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewer_role" TEXT NOT NULL DEFAULT 'EMPLOYER',
    "audit_event_id" TEXT,
    "trust_snapshot_at_decision" JSONB NOT NULL DEFAULT '{}',
    "blockers_at_decision" JSONB NOT NULL DEFAULT '[]',
    "readiness_score_at_decision" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "employer_decision_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "start_outcome_events" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_context_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL,
    "days_from_first_review" INTEGER,
    "days_from_share" INTEGER,
    "days_from_ready" INTEGER,
    "readiness_score_at_start" INTEGER,
    "blockers_at_start" JSONB NOT NULL DEFAULT '[]',
    "source_coverage_at_start" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "start_outcome_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_clerk_user_id_idx" ON "Application"("clerk_user_id");

-- CreateIndex
CREATE INDEX "Application_opportunity_id_idx" ON "Application"("opportunity_id");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_opportunity_id_clerk_user_id_key" ON "Application"("opportunity_id", "clerk_user_id");

-- CreateIndex
CREATE INDEX "OnboardingAnalytics_organizationId_idx" ON "OnboardingAnalytics"("organizationId");

-- CreateIndex
CREATE INDEX "OnboardingAnalytics_artifactId_idx" ON "OnboardingAnalytics"("artifactId");

-- CreateIndex
CREATE INDEX "SystemFailureEvent_severity_idx" ON "SystemFailureEvent"("severity");

-- CreateIndex
CREATE INDEX "SystemFailureEvent_createdAt_idx" ON "SystemFailureEvent"("createdAt");

-- CreateIndex
CREATE INDEX "MedicalSchool_name_idx" ON "MedicalSchool"("name");

-- CreateIndex
CREATE INDEX "MedicalSchool_accreditation_status_idx" ON "MedicalSchool"("accreditation_status");

-- CreateIndex
CREATE UNIQUE INDEX "ResidencyProgram_acgme_code_key" ON "ResidencyProgram"("acgme_code");

-- CreateIndex
CREATE INDEX "ResidencyProgram_specialty_idx" ON "ResidencyProgram"("specialty");

-- CreateIndex
CREATE INDEX "ResidencyProgram_acgme_code_idx" ON "ResidencyProgram"("acgme_code");

-- CreateIndex
CREATE INDEX "ResidencyProgram_hospital_affiliation_idx" ON "ResidencyProgram"("hospital_affiliation");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyTaxonomy_code_key" ON "SpecialtyTaxonomy"("code");

-- CreateIndex
CREATE INDEX "SpecialtyTaxonomy_code_idx" ON "SpecialtyTaxonomy"("code");

-- CreateIndex
CREATE INDEX "SpecialtyTaxonomy_board_name_idx" ON "SpecialtyTaxonomy"("board_name");

-- CreateIndex
CREATE INDEX "StateComplianceRule_state_code_idx" ON "StateComplianceRule"("state_code");

-- CreateIndex
CREATE INDEX "StateComplianceRule_specialty_idx" ON "StateComplianceRule"("specialty");

-- CreateIndex
CREATE UNIQUE INDEX "StateComplianceRule_state_code_specialty_key" ON "StateComplianceRule"("state_code", "specialty");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerWebhookConfig_employerId_key" ON "EmployerWebhookConfig"("employerId");

-- CreateIndex
CREATE INDEX "EmployerWebhookConfig_active_idx" ON "EmployerWebhookConfig"("active");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupeKey_key" ON "outbox_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "outbox_events_status_availableAt_idx" ON "outbox_events"("status", "availableAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "outbox_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "BillingEvent_employerId_idx" ON "BillingEvent"("employerId");

-- CreateIndex
CREATE INDEX "BillingEvent_startAttestationId_idx" ON "BillingEvent"("startAttestationId");

-- CreateIndex
CREATE INDEX "BillingEvent_status_idx" ON "BillingEvent"("status");

-- CreateIndex
CREATE INDEX "BillingEvent_createdAt_idx" ON "BillingEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_clinicianId_idx" ON "Subscription"("clinicianId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionApiKey_keyHash_key" ON "SubscriptionApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "SubscriptionApiKey_clinicianId_idx" ON "SubscriptionApiKey"("clinicianId");

-- CreateIndex
CREATE INDEX "SubscriptionApiKey_keyHash_idx" ON "SubscriptionApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Feedback_type_idx" ON "Feedback"("type");

-- CreateIndex
CREATE INDEX "advisory_outcome_events_entity_id_event_timestamp_idx" ON "advisory_outcome_events"("entity_id", "event_timestamp");

-- CreateIndex
CREATE INDEX "advisory_outcome_events_event_type_event_timestamp_idx" ON "advisory_outcome_events"("event_type", "event_timestamp");

-- CreateIndex
CREATE INDEX "advisory_outcome_events_organization_context_id_event_times_idx" ON "advisory_outcome_events"("organization_context_id", "event_timestamp");

-- CreateIndex
CREATE INDEX "advisory_outcome_events_advisory_version_event_timestamp_idx" ON "advisory_outcome_events"("advisory_version", "event_timestamp");

-- CreateIndex
CREATE INDEX "blocker_resolution_events_entity_id_opened_at_idx" ON "blocker_resolution_events"("entity_id", "opened_at");

-- CreateIndex
CREATE INDEX "blocker_resolution_events_blocker_code_status_idx" ON "blocker_resolution_events"("blocker_code", "status");

-- CreateIndex
CREATE INDEX "blocker_resolution_events_blocker_code_resolution_days_idx" ON "blocker_resolution_events"("blocker_code", "resolution_days");

-- CreateIndex
CREATE INDEX "blocker_resolution_events_status_opened_at_idx" ON "blocker_resolution_events"("status", "opened_at");

-- CreateIndex
CREATE INDEX "employer_decision_events_entity_id_decided_at_idx" ON "employer_decision_events"("entity_id", "decided_at");

-- CreateIndex
CREATE INDEX "employer_decision_events_decision_decided_at_idx" ON "employer_decision_events"("decision", "decided_at");

-- CreateIndex
CREATE INDEX "employer_decision_events_organization_context_id_decided_at_idx" ON "employer_decision_events"("organization_context_id", "decided_at");

-- CreateIndex
CREATE INDEX "start_outcome_events_entity_id_started_at_idx" ON "start_outcome_events"("entity_id", "started_at");

-- CreateIndex
CREATE INDEX "start_outcome_events_organization_context_id_started_at_idx" ON "start_outcome_events"("organization_context_id", "started_at");

-- CreateIndex
CREATE INDEX "start_outcome_events_days_from_first_review_idx" ON "start_outcome_events"("days_from_first_review");

-- CreateIndex
CREATE INDEX "start_outcome_events_days_from_ready_idx" ON "start_outcome_events"("days_from_ready");

-- CreateIndex
CREATE INDEX "EmployerAcceptance_acceptedByOrgId_idx" ON "EmployerAcceptance"("acceptedByOrgId");

-- CreateIndex
CREATE INDEX "StartAttestation_startedAt_idx" ON "StartAttestation"("startedAt");

-- CreateIndex
CREATE INDEX "StartAttestation_createdAt_idx" ON "StartAttestation"("createdAt");

-- CreateIndex
CREATE INDEX "VerificationArtifact_checksum_idx" ON "VerificationArtifact"("checksum");

-- CreateIndex
CREATE INDEX "VerificationArtifact_merkleRoot_idx" ON "VerificationArtifact"("merkleRoot");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_person_profile_id_fkey" FOREIGN KEY ("person_profile_id") REFERENCES "person_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_organization_profile_id_fkey" FOREIGN KEY ("organization_profile_id") REFERENCES "organization_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_preferences" ADD CONSTRAINT "workspace_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_preferences" ADD CONSTRAINT "workspace_preferences_active_org_id_fkey" FOREIGN KEY ("active_org_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotPlan" ADD CONSTRAINT "PilotPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "PilotOrg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_source_runs" ADD CONSTRAINT "ingest_source_runs_ingest_run_id_fkey" FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_source_runs" ADD CONSTRAINT "ingest_source_runs_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "source_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_events" ADD CONSTRAINT "ingest_events_ingest_run_id_fkey" FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidencyProgram" ADD CONSTRAINT "ResidencyProgram_medicalSchoolId_fkey" FOREIGN KEY ("medicalSchoolId") REFERENCES "MedicalSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_decision_history" ADD CONSTRAINT "provider_decision_history_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "provider_decision_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_share_events" ADD CONSTRAINT "bundle_share_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_share_events" ADD CONSTRAINT "bundle_share_events_subject_entity_id_fkey" FOREIGN KEY ("subject_entity_id") REFERENCES "vcv_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartAttestation" ADD CONSTRAINT "StartAttestation_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "EmployerAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_startAttestationId_fkey" FOREIGN KEY ("startAttestationId") REFERENCES "StartAttestation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchObjectACL" ADD CONSTRAINT "SearchObjectACL_searchObjectId_fkey" FOREIGN KEY ("searchObjectId") REFERENCES "SearchObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_entity_roles" ADD CONSTRAINT "vcv_entity_roles_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_entity_relationships" ADD CONSTRAINT "vcv_entity_relationships_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_entity_relationships" ADD CONSTRAINT "vcv_entity_relationships_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "npi_ownership" ADD CONSTRAINT "npi_ownership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_credentials" ADD CONSTRAINT "vcv_credentials_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_credentials" ADD CONSTRAINT "vcv_credentials_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "vcv_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_credentials" ADD CONSTRAINT "vcv_credentials_superseded_by_credential_id_fkey" FOREIGN KEY ("superseded_by_credential_id") REFERENCES "vcv_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_credentials" ADD CONSTRAINT "vcv_credentials_supersedes_credential_id_fkey" FOREIGN KEY ("supersedes_credential_id") REFERENCES "vcv_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_education_records" ADD CONSTRAINT "vcv_education_records_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_education_records" ADD CONSTRAINT "vcv_education_records_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "vcv_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_education_records" ADD CONSTRAINT "vcv_education_records_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "vcv_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_organization_contexts" ADD CONSTRAINT "vcv_organization_contexts_requestor_id_fkey" FOREIGN KEY ("requestor_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_org_context_subjects" ADD CONSTRAINT "vcv_org_context_subjects_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_org_context_subjects" ADD CONSTRAINT "vcv_org_context_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_org_context_subjects" ADD CONSTRAINT "vcv_org_context_subjects_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "vcv_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_org_context_status_events" ADD CONSTRAINT "vcv_org_context_status_events_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcv_user_entity_claims" ADD CONSTRAINT "vcv_user_entity_claims_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_outcome_events" ADD CONSTRAINT "advisory_outcome_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_outcome_events" ADD CONSTRAINT "advisory_outcome_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocker_resolution_events" ADD CONSTRAINT "blocker_resolution_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_decision_events" ADD CONSTRAINT "employer_decision_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_decision_events" ADD CONSTRAINT "employer_decision_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "start_outcome_events" ADD CONSTRAINT "start_outcome_events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "vcv_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "start_outcome_events" ADD CONSTRAINT "start_outcome_events_organization_context_id_fkey" FOREIGN KEY ("organization_context_id") REFERENCES "vcv_organization_contexts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_ea_accepted" RENAME TO "EmployerAcceptance_acceptedAt_idx";

-- RenameIndex
ALTER INDEX "idx_ea_employer" RENAME TO "EmployerAcceptance_employerId_idx";

-- RenameIndex
ALTER INDEX "idx_ea_npi" RENAME TO "EmployerAcceptance_clinicianNpi_idx";

-- RenameIndex
ALTER INDEX "idx_ea_status" RENAME TO "EmployerAcceptance_status_idx";

-- RenameIndex
ALTER INDEX "idx_sa_acceptance" RENAME TO "StartAttestation_acceptanceId_idx";

-- RenameIndex
ALTER INDEX "bundle_share_events_org_context_idx" RENAME TO "bundle_share_events_organization_context_id_idx";

-- RenameIndex
ALTER INDEX "bundle_share_events_subject_entity_idx" RENAME TO "bundle_share_events_subject_entity_id_idx";

-- RenameIndex
ALTER INDEX "geographic_boundaries_bbox_min_lat_bbox_max_lat_bbox_min_lng_bb" RENAME TO "geographic_boundaries_bbox_min_lat_bbox_max_lat_bbox_min_ln_idx";

-- RenameIndex
ALTER INDEX "graph_layout_states_owner_key_scope_type_scope_key_graph_mode_f" RENAME TO "graph_layout_states_owner_key_scope_type_scope_key_graph_mo_key";

-- RenameIndex
ALTER INDEX "ingest_events_ingest_run_dedupe_uq" RENAME TO "ingest_events_ingest_run_id_dedupe_key_key";

-- RenameIndex
ALTER INDEX "ingest_events_ingest_run_sequence_uq" RENAME TO "ingest_events_ingest_run_id_sequence_key";

-- RenameIndex
ALTER INDEX "ingest_events_run_created_idx" RENAME TO "ingest_events_ingest_run_id_created_at_idx";

-- RenameIndex
ALTER INDEX "ingest_source_runs_ingest_run_source_uq" RENAME TO "ingest_source_runs_ingest_run_id_source_id_key";

-- RenameIndex
ALTER INDEX "ingest_source_runs_source_run_idx" RENAME TO "ingest_source_runs_source_run_id_idx";

-- RenameIndex
ALTER INDEX "ingest_source_runs_status_created_idx" RENAME TO "ingest_source_runs_status_created_at_idx";

-- RenameIndex
ALTER INDEX "provider_boundary_assignments_provider_location_id_boundary_id_" RENAME TO "provider_boundary_assignments_provider_location_id_boundary_key";

-- RenameIndex
ALTER INDEX "provider_decision_history_class_idx" RENAME TO "provider_decision_history_decision_class_recorded_at_idx";

-- RenameIndex
ALTER INDEX "provider_decision_history_npi_idx" RENAME TO "provider_decision_history_npi_recorded_at_idx";

-- RenameIndex
ALTER INDEX "provider_decision_states_class_idx" RENAME TO "provider_decision_states_decision_class_evaluated_at_idx";

-- RenameIndex
ALTER INDEX "provider_decision_states_expires_idx" RENAME TO "provider_decision_states_expires_at_idx";

-- RenameIndex
ALTER INDEX "storyline_entity_links_storyline_ref_id_entity_type_entity_key_" RENAME TO "storyline_entity_links_storyline_ref_id_entity_type_entity__key";

-- RenameIndex
ALTER INDEX "vcv_cred_expires_idx" RENAME TO "vcv_credentials_expires_at_idx";

-- RenameIndex
ALTER INDEX "vcv_cred_family_idx" RENAME TO "vcv_credentials_credential_family_key_idx";

-- RenameIndex
ALTER INDEX "vcv_cred_issuer_idx" RENAME TO "vcv_credentials_issuer_id_idx";

-- RenameIndex
ALTER INDEX "vcv_cred_observed_idx" RENAME TO "vcv_credentials_observed_at_idx";

-- RenameIndex
ALTER INDEX "vcv_cred_subject_domain_idx" RENAME TO "vcv_credentials_subject_id_domain_idx";

-- RenameIndex
ALTER INDEX "vcv_cred_subject_status_idx" RENAME TO "vcv_credentials_subject_id_status_idx";

-- RenameIndex
ALTER INDEX "vcv_cred_type_jur_idx" RENAME TO "vcv_credentials_credential_type_jurisdiction_idx";

-- RenameIndex
ALTER INDEX "vcv_edu_acgme_idx" RENAME TO "vcv_education_records_acgme_code_idx";

-- RenameIndex
ALTER INDEX "vcv_edu_completed_idx" RENAME TO "vcv_education_records_subject_id_completed_idx";

-- RenameIndex
ALTER INDEX "vcv_edu_institution_idx" RENAME TO "vcv_education_records_institution_id_idx";

-- RenameIndex
ALTER INDEX "vcv_edu_subject_type_idx" RENAME TO "vcv_education_records_subject_id_record_type_idx";

-- RenameIndex
ALTER INDEX "vcv_entities_canonical_uq" RENAME TO "vcv_entities_canonical_id_key";

-- RenameIndex
ALTER INDEX "vcv_entities_type_idx" RENAME TO "vcv_entities_entity_type_idx";

-- RenameIndex
ALTER INDEX "vcv_entities_type_npi_idx" RENAME TO "vcv_entities_entity_type_npi_idx";

-- RenameIndex
ALTER INDEX "vcv_rel_object_type_idx" RENAME TO "vcv_entity_relationships_object_id_relationship_type_idx";

-- RenameIndex
ALTER INDEX "vcv_rel_pair_idx" RENAME TO "vcv_entity_relationships_subject_id_object_id_idx";

-- RenameIndex
ALTER INDEX "vcv_rel_subject_type_idx" RENAME TO "vcv_entity_relationships_subject_id_relationship_type_idx";

-- RenameIndex
ALTER INDEX "vcv_entity_roles_entity_role_idx" RENAME TO "vcv_entity_roles_entity_id_role_type_idx";

-- RenameIndex
ALTER INDEX "vcv_entity_roles_role_idx" RENAME TO "vcv_entity_roles_role_type_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_evt_ctx_idx" RENAME TO "vcv_org_context_status_events_context_id_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_subj_ctx_idx" RENAME TO "vcv_org_context_subjects_context_id_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_subj_status_idx" RENAME TO "vcv_org_context_subjects_subject_status_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_subj_subj_idx" RENAME TO "vcv_org_context_subjects_subject_id_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_subj_uq" RENAME TO "vcv_org_context_subjects_context_id_subject_id_key";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_ext_ref_idx" RENAME TO "vcv_organization_contexts_external_ref_id_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_requestor_type_idx" RENAME TO "vcv_organization_contexts_requestor_id_context_type_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_status_idx" RENAME TO "vcv_organization_contexts_status_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_type_status_idx" RENAME TO "vcv_organization_contexts_context_type_status_idx";

-- RenameIndex
ALTER INDEX "vcv_org_ctx_user_idx" RENAME TO "vcv_organization_contexts_created_by_user_id_idx";

-- RenameIndex
ALTER INDEX "vcv_uec_entity_idx" RENAME TO "vcv_user_entity_claims_entity_id_idx";

-- RenameIndex
ALTER INDEX "vcv_uec_level_idx" RENAME TO "vcv_user_entity_claims_verification_level_idx";

-- RenameIndex
ALTER INDEX "vcv_uec_user_idx" RENAME TO "vcv_user_entity_claims_clerk_user_id_idx";

-- RenameIndex
ALTER INDEX "vcv_user_entity_claims_uq" RENAME TO "vcv_user_entity_claims_clerk_user_id_entity_id_claim_type_key";

-- RenameIndex
ALTER INDEX "workspace_memberships_org_idx" RENAME TO "workspace_memberships_organization_profile_id_idx";

-- RenameIndex
ALTER INDEX "workspace_memberships_person_idx" RENAME TO "workspace_memberships_person_profile_id_idx";

-- RenameIndex
ALTER INDEX "workspace_memberships_person_org_key" RENAME TO "workspace_memberships_person_profile_id_organization_profil_key";

-- RenameIndex
ALTER INDEX "workspace_preferences_user_idx" RENAME TO "workspace_preferences_user_id_idx";

