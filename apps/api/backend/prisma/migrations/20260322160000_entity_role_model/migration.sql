-- Entity-Role Model — Wave E1/E3/E4
-- VcvEntity, VcvEntityRole, VcvEntityRelationship + supporting enums.
-- Entities exist independently of VCV user accounts.

CREATE TYPE "VcvEntityType" AS ENUM (
  'PERSON', 'ORGANIZATION', 'FACILITY', 'EDUCATIONAL_INSTITUTION',
  'TRAINING_PROGRAM', 'ISSUER_AUTHORITY', 'SOURCE_RECORD'
);

CREATE TYPE "VcvRoleType" AS ENUM (
  'CLINICIAN', 'EMPLOYER', 'VERIFIER', 'ISSUER',
  'COORDINATOR', 'SPONSOR', 'TRAINEE', 'ADMIN_REVIEWER'
);

CREATE TYPE "VcvRelationshipType" AS ENUM (
  'WORKS_FOR', 'EMPLOYED_BY', 'AFFILIATED_WITH', 'PRIVILEGES_AT', 'ENROLLED_WITH',
  'TRAINED_AT', 'GRADUATED_FROM', 'COMPLETED_RESIDENCY_AT', 'COMPLETED_FELLOWSHIP_AT',
  'SPONSORS', 'LICENSED_BY', 'CERTIFIED_BY', 'REGISTERED_WITH',
  'ISSUES', 'VERIFIES', 'REQUESTS_FROM', 'SHARES_WITH'
);

CREATE TYPE "VcvRoleSource" AS ENUM (
  'NPPES_DERIVED', 'USER_CLAIMED', 'CLAIM_DERIVED', 'ADMIN_ASSIGNED', 'INFERRED'
);

CREATE TABLE "vcv_entities" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "entity_type"  "VcvEntityType" NOT NULL,
  "canonical_id" TEXT         NOT NULL,
  "display_name" TEXT         NOT NULL,
  "npi"          TEXT,
  "npi_type"     "NpiType",
  "org_did"      TEXT,
  "source_ids"   TEXT[]       NOT NULL DEFAULT '{}',
  "verified_at"  TIMESTAMPTZ,
  "metadata"     JSONB        NOT NULL DEFAULT '{}',
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_entities_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "vcv_entities_canonical_uq" UNIQUE ("canonical_id")
);

CREATE INDEX "vcv_entities_npi_idx"         ON "vcv_entities"("npi");
CREATE INDEX "vcv_entities_type_idx"        ON "vcv_entities"("entity_type");
CREATE INDEX "vcv_entities_type_npi_idx"    ON "vcv_entities"("entity_type", "npi");

CREATE TABLE "vcv_entity_roles" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "entity_id"   UUID           NOT NULL,
  "role_type"   "VcvRoleType"  NOT NULL,
  "context"     TEXT,
  "valid_from"  TIMESTAMPTZ,
  "valid_until" TIMESTAMPTZ,
  "source"      "VcvRoleSource" NOT NULL DEFAULT 'INFERRED',
  "evidence_id" TEXT,
  "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_entity_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vcv_entity_roles_entity_fk" FOREIGN KEY ("entity_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE
);

CREATE INDEX "vcv_entity_roles_entity_role_idx" ON "vcv_entity_roles"("entity_id", "role_type");
CREATE INDEX "vcv_entity_roles_role_idx"        ON "vcv_entity_roles"("role_type");

CREATE TABLE "vcv_entity_relationships" (
  "id"                UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "subject_id"        UUID                   NOT NULL,
  "object_id"         UUID                   NOT NULL,
  "relationship_type" "VcvRelationshipType"  NOT NULL,
  "state"             TEXT,
  "start_date"        TIMESTAMPTZ,
  "end_date"          TIMESTAMPTZ,
  "artifact_id"       UUID,
  "claim_id"          TEXT,
  "confidence"        FLOAT8                 NOT NULL DEFAULT 0.5,
  "tier"              TEXT                   NOT NULL DEFAULT 'SILVER',
  "metadata"          JSONB                  NOT NULL DEFAULT '{}',
  "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  CONSTRAINT "vcv_entity_relationships_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "vcv_entity_relationships_subject_fk" FOREIGN KEY ("subject_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE,
  CONSTRAINT "vcv_entity_relationships_object_fk"  FOREIGN KEY ("object_id")
    REFERENCES "vcv_entities"("id") ON DELETE CASCADE
);

CREATE INDEX "vcv_rel_subject_type_idx" ON "vcv_entity_relationships"("subject_id", "relationship_type");
CREATE INDEX "vcv_rel_object_type_idx"  ON "vcv_entity_relationships"("object_id",  "relationship_type");
CREATE INDEX "vcv_rel_pair_idx"         ON "vcv_entity_relationships"("subject_id", "object_id");
