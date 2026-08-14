-- Credential operations core: reviewed/versioned workflow templates, tenant-
-- owned clinician cases, and frozen requirement tasks. Additive only.

CREATE TYPE "CredentialOpsCaseType" AS ENUM (
  'CVO_CREDENTIALING', 'STATE_LICENSING', 'PAYER_ENROLLMENT',
  'FACILITY_PRIVILEGING', 'RECREDENTIALING', 'REAPPOINTMENT',
  'DELEGATION_SETUP', 'DELEGATION_OVERSIGHT', 'RENEWAL'
);

CREATE TYPE "CredentialOpsTargetKind" AS ENUM (
  'CREDENTIALING_PROGRAM', 'STATE_BOARD', 'PAYER', 'FACILITY',
  'DELEGATION_PROGRAM'
);

CREATE TYPE "CredentialOpsTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "CredentialOpsCaseState" AS ENUM (
  'INTAKE', 'IN_PROGRESS', 'WAITING_ON_CLINICIAN',
  'WAITING_ON_ORGANIZATION', 'WAITING_ON_SOURCE', 'READY_FOR_REVIEW',
  'UNDER_REVIEW', 'SUBMITTED', 'EXTERNAL_REVIEW', 'DECIDED', 'CLOSED',
  'CANCELLED'
);
CREATE TYPE "CredentialOpsTaskCategory" AS ENUM (
  'EVIDENCE', 'POLICY', 'APPLICATION', 'SUBMISSION', 'FOLLOW_UP',
  'COMMITTEE', 'MONITORING', 'MANUAL_REVIEW'
);
CREATE TYPE "CredentialOpsTaskOwner" AS ENUM (
  'CLINICIAN', 'CUSTOMER_OPERATOR', 'VITALCV_OPERATOR', 'PARTNER_REVIEWER',
  'COMMITTEE', 'SYSTEM'
);
CREATE TYPE "CredentialOpsTaskNecessity" AS ENUM ('REQUIRED', 'PREFERRED');
CREATE TYPE "CredentialOpsTaskState" AS ENUM (
  'NOT_STARTED', 'READY', 'IN_PROGRESS', 'WAITING', 'SUBMITTED',
  'UNDER_REVIEW', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE', 'BLOCKED',
  'EXPIRED'
);
CREATE TYPE "CredentialOpsDataHandling" AS ENUM ('STANDARD', 'REFERENCE_ONLY', 'EXTERNAL_ONLY');

CREATE TABLE "credential_ops_workflow_templates" (
  "id" UUID NOT NULL,
  "scope_key" TEXT NOT NULL,
  "organization_id" UUID,
  "template_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "case_type" "CredentialOpsCaseType" NOT NULL,
  "target_kind" "CredentialOpsTargetKind" NOT NULL,
  "target_authority_name" TEXT NOT NULL,
  "jurisdiction" TEXT,
  "profession_codes" TEXT[],
  "status" "CredentialOpsTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "source_references" JSONB NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "content_hash" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credential_ops_workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credential_ops_template_requirements" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "requirement_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" "CredentialOpsTaskCategory" NOT NULL,
  "owner" "CredentialOpsTaskOwner" NOT NULL,
  "necessity" "CredentialOpsTaskNecessity" NOT NULL DEFAULT 'REQUIRED',
  "evidence_rule" JSONB NOT NULL DEFAULT '{}',
  "dependency_keys" TEXT[],
  "due_offset_days" INTEGER,
  "data_handling" "CredentialOpsDataHandling" NOT NULL DEFAULT 'STANDARD',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credential_ops_template_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credential_operations_cases" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "subject_entity_id" UUID NOT NULL,
  "subject_npi_snapshot" TEXT,
  "workflow_template_id" UUID NOT NULL,
  "workflow_template_hash" TEXT NOT NULL,
  "case_type" "CredentialOpsCaseType" NOT NULL,
  "profession_code" TEXT NOT NULL,
  "target_kind" "CredentialOpsTargetKind" NOT NULL,
  "target_authority_snapshot" JSONB NOT NULL,
  "state" "CredentialOpsCaseState" NOT NULL DEFAULT 'INTAKE',
  "application_id" UUID,
  "activation_requirement_id" UUID,
  "start_activation_id" UUID,
  "idempotency_key" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "target_due_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credential_operations_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credential_ops_case_tasks" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "requirement_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" "CredentialOpsTaskCategory" NOT NULL,
  "owner" "CredentialOpsTaskOwner" NOT NULL,
  "necessity" "CredentialOpsTaskNecessity" NOT NULL,
  "state" "CredentialOpsTaskState" NOT NULL DEFAULT 'NOT_STARTED',
  "evidence_rule" JSONB NOT NULL,
  "dependency_keys" TEXT[],
  "data_handling" "CredentialOpsDataHandling" NOT NULL,
  "due_at" TIMESTAMP(3),
  "external_ref" TEXT,
  "receipt_ref" TEXT,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolution_note" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credential_ops_case_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credential_ops_templates_scope_key_version_uq"
  ON "credential_ops_workflow_templates"("scope_key", "template_key", "version");
CREATE INDEX "credential_ops_templates_active_lookup_idx"
  ON "credential_ops_workflow_templates"("status", "case_type", "effective_at");
CREATE INDEX "credential_ops_templates_org_idx"
  ON "credential_ops_workflow_templates"("organization_id");

CREATE UNIQUE INDEX "credential_ops_template_requirements_key_uq"
  ON "credential_ops_template_requirements"("template_id", "requirement_key");
CREATE INDEX "credential_ops_template_requirements_order_idx"
  ON "credential_ops_template_requirements"("template_id", "sort_order");

CREATE UNIQUE INDEX "credential_ops_cases_org_idempotency_uq"
  ON "credential_operations_cases"("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "credential_operations_cases_activation_requirement_id_key"
  ON "credential_operations_cases"("activation_requirement_id");
CREATE INDEX "credential_ops_cases_queue_idx"
  ON "credential_operations_cases"("organization_id", "state", "updated_at");
CREATE INDEX "credential_ops_cases_subject_idx"
  ON "credential_operations_cases"("subject_entity_id", "updated_at");
CREATE INDEX "credential_ops_cases_template_idx"
  ON "credential_operations_cases"("workflow_template_id");
CREATE INDEX "credential_ops_cases_application_idx"
  ON "credential_operations_cases"("application_id");
CREATE INDEX "credential_ops_cases_start_activation_idx"
  ON "credential_operations_cases"("start_activation_id");

CREATE UNIQUE INDEX "credential_ops_case_tasks_key_uq"
  ON "credential_ops_case_tasks"("case_id", "requirement_key");
CREATE INDEX "credential_ops_case_tasks_queue_idx"
  ON "credential_ops_case_tasks"("case_id", "state", "sort_order");

ALTER TABLE "credential_ops_workflow_templates"
  ADD CONSTRAINT "credential_ops_workflow_templates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credential_ops_template_requirements"
  ADD CONSTRAINT "credential_ops_template_requirements_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "credential_ops_workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credential_operations_cases"
  ADD CONSTRAINT "credential_operations_cases_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credential_operations_cases"
  ADD CONSTRAINT "credential_operations_cases_subject_entity_id_fkey"
  FOREIGN KEY ("subject_entity_id") REFERENCES "vcv_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credential_operations_cases"
  ADD CONSTRAINT "credential_operations_cases_workflow_template_id_fkey"
  FOREIGN KEY ("workflow_template_id") REFERENCES "credential_ops_workflow_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credential_operations_cases"
  ADD CONSTRAINT "credential_operations_cases_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credential_operations_cases"
  ADD CONSTRAINT "credential_operations_cases_activation_requirement_id_fkey"
  FOREIGN KEY ("activation_requirement_id") REFERENCES "activation_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credential_operations_cases"
  ADD CONSTRAINT "credential_operations_cases_start_activation_id_fkey"
  FOREIGN KEY ("start_activation_id") REFERENCES "start_activations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credential_ops_case_tasks"
  ADD CONSTRAINT "credential_ops_case_tasks_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "credential_operations_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
