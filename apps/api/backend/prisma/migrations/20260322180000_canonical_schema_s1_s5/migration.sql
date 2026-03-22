-- Canonical Schema Waves S1/S4/S5
-- VcvCredential, VcvEducationRecord, VcvOrganizationContext,
-- VcvOrgContextSubject, VcvOrgContextStatusEvent, VcvUserEntityClaim
-- + 4 new enums: VcvCredentialDomain, VcvVerificationLevel,
--   VcvOrgContextType, VcvOrgContextStatus

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "VcvCredentialDomain" AS ENUM (
  'LICENSURE','BOARD_CERTIFICATION','DEA_REGISTRATION','MEDICARE_ENROLLMENT',
  'EXCLUSION_CHECK','EDUCATION','TRAINING','MALPRACTICE','HOSPITAL_PRIVILEGE',
  'EMPLOYMENT','IDENTITY'
);

CREATE TYPE "VcvVerificationLevel" AS ENUM (
  'SELF_REPORTED','SOURCE_MATCHED','SOURCE_VERIFIED',
  'CRYPTOGRAPHICALLY_SIGNED','BIOMETRICALLY_CONFIRMED'
);

CREATE TYPE "VcvOrgContextType" AS ENUM (
  'APPLICATION','EMPLOYMENT_REVIEW','PRIVILEGING','CREDENTIALING',
  'RECREDENTIALING','TRAINING_ENROLLMENT','ISSUER_REVIEW',
  'MONITORING','COMPLIANCE_AUDIT'
);

CREATE TYPE "VcvOrgContextStatus" AS ENUM (
  'PENDING','ACTIVE','COMPLETED','EXPIRED','REVOKED'
);

-- ── VcvCredential ─────────────────────────────────────────────────────────────

CREATE TABLE "vcv_credentials" (
  "id"                UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "subject_id"        UUID                   NOT NULL,
  "issuer_id"         UUID,
  "domain"            "VcvCredentialDomain"  NOT NULL,
  "credential_type"   TEXT                   NOT NULL,
  "status"            TEXT                   NOT NULL DEFAULT 'ACTIVE',
  "verification_level" "VcvVerificationLevel" NOT NULL DEFAULT 'SELF_REPORTED',
  "claim_value"       JSONB                  NOT NULL DEFAULT '{}',
  "artifact_ids"      TEXT[]                 NOT NULL DEFAULT '{}',
  "claim_id"          TEXT,
  "issued_at"         TIMESTAMPTZ,
  "expires_at"        TIMESTAMPTZ,
  "verified_at"       TIMESTAMPTZ,
  "revoked_at"        TIMESTAMPTZ,
  "next_reverify_at"  TIMESTAMPTZ,
  "jurisdiction"      TEXT,
  "metadata"          JSONB                  NOT NULL DEFAULT '{}',
  "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vcv_credentials_subject_fk" FOREIGN KEY ("subject_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE,
  CONSTRAINT "vcv_credentials_issuer_fk"  FOREIGN KEY ("issuer_id")
    REFERENCES "vcv_entities"("id") ON DELETE SET NULL
);

CREATE INDEX "vcv_cred_subject_domain_idx" ON "vcv_credentials"("subject_id","domain");
CREATE INDEX "vcv_cred_subject_status_idx" ON "vcv_credentials"("subject_id","status");
CREATE INDEX "vcv_cred_issuer_idx"         ON "vcv_credentials"("issuer_id");
CREATE INDEX "vcv_cred_type_jur_idx"       ON "vcv_credentials"("credential_type","jurisdiction");
CREATE INDEX "vcv_cred_expires_idx"        ON "vcv_credentials"("expires_at");

-- ── VcvEducationRecord ────────────────────────────────────────────────────────

CREATE TABLE "vcv_education_records" (
  "id"                UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "subject_id"        UUID                   NOT NULL,
  "institution_id"    UUID,
  "credential_id"     UUID,
  "record_type"       TEXT                   NOT NULL,
  "degree_or_title"   TEXT,
  "specialty"         TEXT,
  "program_name"      TEXT,
  "acgme_code"        TEXT,
  "start_year"        INT,
  "end_year"          INT,
  "graduation_date"   TIMESTAMPTZ,
  "completed"         BOOLEAN                NOT NULL DEFAULT false,
  "pg_level"          TEXT,
  "country_code"      TEXT                   NOT NULL DEFAULT 'US',
  "accredited"        BOOLEAN,
  "verification_level" "VcvVerificationLevel" NOT NULL DEFAULT 'SELF_REPORTED',
  "source_data"       JSONB                  NOT NULL DEFAULT '{}',
  "metadata"          JSONB                  NOT NULL DEFAULT '{}',
  "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_education_records_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "vcv_edu_subject_fk"      FOREIGN KEY ("subject_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE,
  CONSTRAINT "vcv_edu_institution_fk"  FOREIGN KEY ("institution_id")
    REFERENCES "vcv_entities"("id") ON DELETE SET NULL,
  CONSTRAINT "vcv_edu_credential_fk"   FOREIGN KEY ("credential_id")
    REFERENCES "vcv_credentials"("id") ON DELETE SET NULL
);

CREATE INDEX "vcv_edu_subject_type_idx"  ON "vcv_education_records"("subject_id","record_type");
CREATE INDEX "vcv_edu_institution_idx"   ON "vcv_education_records"("institution_id");
CREATE INDEX "vcv_edu_acgme_idx"         ON "vcv_education_records"("acgme_code");
CREATE INDEX "vcv_edu_completed_idx"     ON "vcv_education_records"("subject_id","completed");

-- ── VcvOrganizationContext ────────────────────────────────────────────────────

CREATE TABLE "vcv_organization_contexts" (
  "id"                  UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "requestor_id"        UUID                 NOT NULL,
  "context_type"        "VcvOrgContextType"  NOT NULL,
  "status"              "VcvOrgContextStatus" NOT NULL DEFAULT 'PENDING',
  "title"               TEXT,
  "description"         TEXT,
  "due_at"              TIMESTAMPTZ,
  "completed_at"        TIMESTAMPTZ,
  "revoked_at"          TIMESTAMPTZ,
  "revoked_reason"      TEXT,
  "outcome"             JSONB,
  "webhook_url"         TEXT,
  "created_by_user_id"  TEXT,
  "external_ref_id"     TEXT,
  "metadata"            JSONB                NOT NULL DEFAULT '{}',
  "created_at"          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_org_ctx_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "vcv_org_ctx_requestor_fk"  FOREIGN KEY ("requestor_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE
);

CREATE INDEX "vcv_org_ctx_requestor_type_idx"  ON "vcv_organization_contexts"("requestor_id","context_type");
CREATE INDEX "vcv_org_ctx_status_idx"           ON "vcv_organization_contexts"("status");
CREATE INDEX "vcv_org_ctx_type_status_idx"      ON "vcv_organization_contexts"("context_type","status");
CREATE INDEX "vcv_org_ctx_user_idx"             ON "vcv_organization_contexts"("created_by_user_id");
CREATE INDEX "vcv_org_ctx_ext_ref_idx"          ON "vcv_organization_contexts"("external_ref_id");

-- ── VcvOrgContextSubject ──────────────────────────────────────────────────────

CREATE TABLE "vcv_org_context_subjects" (
  "id"                  UUID   NOT NULL DEFAULT gen_random_uuid(),
  "context_id"          UUID   NOT NULL,
  "subject_id"          UUID   NOT NULL,
  "credential_id"       UUID,
  "subject_status"      TEXT   NOT NULL DEFAULT 'PENDING',
  "submission_data"     JSONB,
  "review_notes"        TEXT,
  "reviewed_at"         TIMESTAMPTZ,
  "reviewed_by_user_id" TEXT,
  "invited_at"          TIMESTAMPTZ,
  "responded_at"        TIMESTAMPTZ,
  "metadata"            JSONB  NOT NULL DEFAULT '{}',
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_org_ctx_subj_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "vcv_org_ctx_subj_uq"      UNIQUE ("context_id","subject_id"),
  CONSTRAINT "vcv_org_ctx_subj_ctx_fk"  FOREIGN KEY ("context_id")
    REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE,
  CONSTRAINT "vcv_org_ctx_subj_subj_fk" FOREIGN KEY ("subject_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE,
  CONSTRAINT "vcv_org_ctx_subj_cred_fk" FOREIGN KEY ("credential_id")
    REFERENCES "vcv_credentials"("id") ON DELETE SET NULL
);

CREATE INDEX "vcv_org_ctx_subj_ctx_idx"    ON "vcv_org_context_subjects"("context_id");
CREATE INDEX "vcv_org_ctx_subj_subj_idx"   ON "vcv_org_context_subjects"("subject_id");
CREATE INDEX "vcv_org_ctx_subj_status_idx" ON "vcv_org_context_subjects"("subject_status");

-- ── VcvOrgContextStatusEvent ──────────────────────────────────────────────────

CREATE TABLE "vcv_org_context_status_events" (
  "id"            UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "context_id"    UUID                  NOT NULL,
  "from_status"   "VcvOrgContextStatus",
  "to_status"     "VcvOrgContextStatus" NOT NULL,
  "triggered_by"  TEXT,
  "reason"        TEXT,
  "metadata"      JSONB                 NOT NULL DEFAULT '{}',
  "created_at"    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_org_ctx_evt_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "vcv_org_ctx_evt_ctx_fk"  FOREIGN KEY ("context_id")
    REFERENCES "vcv_organization_contexts"("id") ON DELETE CASCADE
);

CREATE INDEX "vcv_org_ctx_evt_ctx_idx" ON "vcv_org_context_status_events"("context_id");

-- ── VcvUserEntityClaim ────────────────────────────────────────────────────────

CREATE TABLE "vcv_user_entity_claims" (
  "id"                   UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "clerk_user_id"        TEXT                   NOT NULL,
  "entity_id"            UUID                   NOT NULL,
  "claim_type"           TEXT                   NOT NULL DEFAULT 'SUBJECT',
  "verification_level"   "VcvVerificationLevel" NOT NULL DEFAULT 'SELF_REPORTED',
  "verified_at"          TIMESTAMPTZ,
  "verification_method"  TEXT,
  "artifact_id"          TEXT,
  "revoked_at"           TIMESTAMPTZ,
  "revoked_reason"       TEXT,
  "claimed_at"           TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "metadata"             JSONB                  NOT NULL DEFAULT '{}',
  CONSTRAINT "vcv_user_entity_claims_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "vcv_user_entity_claims_uq"      UNIQUE ("clerk_user_id","entity_id","claim_type"),
  CONSTRAINT "vcv_user_entity_claims_ent_fk"  FOREIGN KEY ("entity_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE
);

CREATE INDEX "vcv_uec_user_idx"   ON "vcv_user_entity_claims"("clerk_user_id");
CREATE INDEX "vcv_uec_entity_idx" ON "vcv_user_entity_claims"("entity_id");
CREATE INDEX "vcv_uec_level_idx"  ON "vcv_user_entity_claims"("verification_level");
