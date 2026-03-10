-- Wave 196: Production Hardening Reconciliation
-- Adds tables for: PersonProfile, OrganizationProfile, WorkspaceMembership,
-- WorkspacePreference, DecisionCapsule, SearchObject, SearchObjectACL, SearchIndexRun
-- that were introduced in waves 180-195 but not yet migrated.

-- Enums (skip if already exist from prior migrations)
DO $$ BEGIN
  CREATE TYPE "NpiType" AS ENUM ('TYPE_1', 'TYPE_2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ActivePersona" AS ENUM ('CLINICIAN', 'EMPLOYER', 'ADMIN', 'VERIFIER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER', 'VERIFIER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmployerHiringStatus" AS ENUM ('HIRING_NOW', 'ACTIVELY_HIRING', 'ACCEPTING_APPLICATIONS', 'NOT_HIRING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SearchObjectType" AS ENUM ('PUBLIC_PAGE', 'EMPLOYER_PROFILE', 'OPPORTUNITY', 'ISSUER_PROFILE', 'TRUST_STATE_SUMMARY', 'AUDIT_EVENT_SUMMARY', 'FAQ_DOC', 'CONNECTED_RECORD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SearchAclLevel" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'HOLDER', 'VERIFIER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PersonProfile
CREATE TABLE IF NOT EXISTS "person_profiles" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           UUID        NOT NULL,
  "npi"               TEXT,
  "npi_type"          "NpiType"   DEFAULT 'TYPE_1',
  "first_name"        TEXT,
  "last_name"         TEXT,
  "specialty"         TEXT,
  "state_of_practice" TEXT,
  "work_auth_status"  TEXT,
  "resume_url"        TEXT,
  "linkedin_url"      TEXT,
  "portfolio_url"     TEXT,
  "completeness"      INTEGER     NOT NULL DEFAULT 0,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "person_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "person_profiles_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "person_profiles_npi_key" UNIQUE ("npi"),
  CONSTRAINT "person_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "person_profiles_npi_idx" ON "person_profiles"("npi");
CREATE INDEX IF NOT EXISTS "person_profiles_user_id_idx" ON "person_profiles"("user_id");

-- OrganizationProfile
CREATE TABLE IF NOT EXISTS "organization_profiles" (
  "id"                        UUID                    NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"           UUID                    NOT NULL,
  "npi"                       TEXT,
  "npi_type"                  "NpiType"               DEFAULT 'TYPE_2',
  "org_did"                   TEXT,
  "facility_type"             TEXT,
  "specialties"               TEXT[]                  NOT NULL DEFAULT '{}',
  "states_covered"            TEXT[]                  NOT NULL DEFAULT '{}',
  "website"                   TEXT,
  "tagline"                   TEXT,
  "description"               TEXT,
  "trust_score"               INTEGER                 NOT NULL DEFAULT 0,
  "open_roles"                INTEGER                 NOT NULL DEFAULT 0,
  "recent_hires"              INTEGER                 NOT NULL DEFAULT 0,
  "hiring_status"             "EmployerHiringStatus"  NOT NULL DEFAULT 'NOT_HIRING',
  "hiring_types"              TEXT[]                  NOT NULL DEFAULT '{}',
  "time_to_start"             TEXT,
  "time_to_onboard"           TEXT,
  "clear_to_start_threshold"  TEXT,
  "pay_transparency"          BOOLEAN                 NOT NULL DEFAULT false,
  "pay_range"                 TEXT,
  "requirements"              JSONB                   NOT NULL DEFAULT '[]',
  "verified_since"            TIMESTAMP(3),
  "verified"                  BOOLEAN                 NOT NULL DEFAULT false,
  "created_at"                TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_profiles_organization_id_key" UNIQUE ("organization_id"),
  CONSTRAINT "organization_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "organization_profiles_npi_idx" ON "organization_profiles"("npi");
CREATE INDEX IF NOT EXISTS "organization_profiles_organization_id_idx" ON "organization_profiles"("organization_id");
CREATE INDEX IF NOT EXISTS "organization_profiles_hiring_status_idx" ON "organization_profiles"("hiring_status");
CREATE INDEX IF NOT EXISTS "organization_profiles_trust_score_idx" ON "organization_profiles"("trust_score");

-- WorkspaceMembership
CREATE TABLE IF NOT EXISTS "workspace_memberships" (
  "id"                        UUID              NOT NULL DEFAULT gen_random_uuid(),
  "person_profile_id"         UUID              NOT NULL,
  "organization_profile_id"   UUID              NOT NULL,
  "role"                      "MembershipRole"  NOT NULL DEFAULT 'VERIFIER',
  "active"                    BOOLEAN           NOT NULL DEFAULT true,
  "invited_at"                TIMESTAMP(3),
  "accepted_at"               TIMESTAMP(3),
  "created_at"                TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_memberships_person_org_key" UNIQUE ("person_profile_id", "organization_profile_id"),
  CONSTRAINT "workspace_memberships_person_fkey" FOREIGN KEY ("person_profile_id") REFERENCES "person_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_memberships_org_fkey" FOREIGN KEY ("organization_profile_id") REFERENCES "organization_profiles"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "workspace_memberships_person_idx" ON "workspace_memberships"("person_profile_id");
CREATE INDEX IF NOT EXISTS "workspace_memberships_org_idx" ON "workspace_memberships"("organization_profile_id");

-- WorkspacePreference
CREATE TABLE IF NOT EXISTS "workspace_preferences" (
  "id"               UUID            NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          UUID            NOT NULL,
  "active_persona"   "ActivePersona" NOT NULL DEFAULT 'CLINICIAN',
  "active_org_id"    UUID,
  "sidebar_collapsed" BOOLEAN        NOT NULL DEFAULT false,
  "last_switched_at" TIMESTAMP(3),
  "created_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_preferences_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "workspace_preferences_user_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_preferences_org_fkey" FOREIGN KEY ("active_org_id") REFERENCES "Organization"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "workspace_preferences_user_idx" ON "workspace_preferences"("user_id");

-- DecisionCapsule
CREATE TABLE IF NOT EXISTS "DecisionCapsule" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "subjectDid"         TEXT         NOT NULL,
  "subjectNpi"         TEXT         NOT NULL,
  "decisionType"       TEXT         NOT NULL,
  "decisionTimestamp"  TIMESTAMP(3) NOT NULL,
  "credentialIds"      TEXT[]       NOT NULL DEFAULT '{}',
  "issuerIds"          TEXT[]       NOT NULL DEFAULT '{}',
  "artifactHash"       TEXT         NOT NULL,
  "methodology"        TEXT         NOT NULL DEFAULT 'CRS_v1.0',
  "status"             TEXT         NOT NULL DEFAULT 'VALID',
  "metadata"           JSONB        NOT NULL DEFAULT '{}',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionCapsule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DecisionCapsule_subjectNpi_idx" ON "DecisionCapsule"("subjectNpi");
CREATE INDEX IF NOT EXISTS "DecisionCapsule_subjectDid_idx" ON "DecisionCapsule"("subjectDid");
CREATE INDEX IF NOT EXISTS "DecisionCapsule_status_idx" ON "DecisionCapsule"("status");
CREATE INDEX IF NOT EXISTS "DecisionCapsule_decisionType_idx" ON "DecisionCapsule"("decisionType");
CREATE INDEX IF NOT EXISTS "DecisionCapsule_decisionTimestamp_idx" ON "DecisionCapsule"("decisionTimestamp");
CREATE INDEX IF NOT EXISTS "DecisionCapsule_subjectNpi_status_idx" ON "DecisionCapsule"("subjectNpi", "status");

-- SearchObject
CREATE TABLE IF NOT EXISTS "SearchObject" (
  "id"          UUID               NOT NULL DEFAULT gen_random_uuid(),
  "type"        "SearchObjectType" NOT NULL,
  "title"       TEXT               NOT NULL,
  "body"        TEXT               NOT NULL,
  "sourceUrl"   TEXT,
  "referenceId" TEXT,
  "aclLevel"    "SearchAclLevel"   NOT NULL DEFAULT 'PUBLIC',
  "metadata"    JSONB              NOT NULL DEFAULT '{}',
  "embedding"   FLOAT8[]           NOT NULL DEFAULT '{}',
  "indexedAt"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "freshAt"     TIMESTAMP(3),
  "active"      BOOLEAN            NOT NULL DEFAULT true,
  CONSTRAINT "SearchObject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchObject_type_idx" ON "SearchObject"("type");
CREATE INDEX IF NOT EXISTS "SearchObject_aclLevel_idx" ON "SearchObject"("aclLevel");
CREATE INDEX IF NOT EXISTS "SearchObject_active_idx" ON "SearchObject"("active");
CREATE INDEX IF NOT EXISTS "SearchObject_type_active_idx" ON "SearchObject"("type", "active");
CREATE INDEX IF NOT EXISTS "SearchObject_referenceId_idx" ON "SearchObject"("referenceId");

-- SearchObjectACL
CREATE TABLE IF NOT EXISTS "SearchObjectACL" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "searchObjectId" UUID         NOT NULL,
  "roleRequired"   TEXT,
  "orgId"          UUID,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchObjectACL_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SearchObjectACL_searchObject_fkey" FOREIGN KEY ("searchObjectId") REFERENCES "SearchObject"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SearchObjectACL_searchObjectId_idx" ON "SearchObjectACL"("searchObjectId");
CREATE INDEX IF NOT EXISTS "SearchObjectACL_orgId_idx" ON "SearchObjectACL"("orgId");

-- SearchIndexRun
CREATE TABLE IF NOT EXISTS "SearchIndexRun" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "objectType"   TEXT         NOT NULL,
  "totalIndexed" INTEGER      NOT NULL DEFAULT 0,
  "totalSkipped" INTEGER      NOT NULL DEFAULT 0,
  "totalErrors"  INTEGER      NOT NULL DEFAULT 0,
  "durationMs"   INTEGER,
  "status"       TEXT         NOT NULL DEFAULT 'PENDING',
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  "errorMessage" TEXT,
  CONSTRAINT "SearchIndexRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchIndexRun_status_idx" ON "SearchIndexRun"("status");
CREATE INDEX IF NOT EXISTS "SearchIndexRun_objectType_idx" ON "SearchIndexRun"("objectType");
