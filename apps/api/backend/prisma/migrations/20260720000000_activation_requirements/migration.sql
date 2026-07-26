-- ACT-1.3 — the application-linked activation requirement ledger: the "remaining
-- work to a qualified start" for one application. Instantiated only after an
-- employer decision; one canonical record drives both the clinician and
-- employer views. Additive new table, idempotent (CREATE TABLE / INDEX IF NOT
-- EXISTS), with a real FK to applications (single writer, so the FK is safe).
CREATE TABLE IF NOT EXISTS "activation_requirements" (
  "id"                    UUID         NOT NULL DEFAULT gen_random_uuid(),
  "application_id"        UUID         NOT NULL,
  "organization_id"       TEXT         NOT NULL,
  "source_requirement_id" TEXT,
  "category"              TEXT         NOT NULL,
  "label"                 TEXT         NOT NULL,
  "necessity"             TEXT         NOT NULL DEFAULT 'required',
  "status"                TEXT         NOT NULL DEFAULT 'not_started',
  "owner"                 TEXT         NOT NULL DEFAULT 'system',
  "evidence_rule"         TEXT,
  "dependency_ids"        TEXT[]       NOT NULL DEFAULT '{}',
  "due_at"                TIMESTAMP(3),
  "resolved_by"           TEXT,
  "resolved_at"           TIMESTAMP(3),
  "policy_version"        TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activation_requirements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activation_requirements_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "activation_requirements_application_id_idx" ON "activation_requirements" ("application_id");
CREATE INDEX IF NOT EXISTS "activation_requirements_organization_id_idx" ON "activation_requirements" ("organization_id");
CREATE INDEX IF NOT EXISTS "activation_requirements_status_idx" ON "activation_requirements" ("status");
