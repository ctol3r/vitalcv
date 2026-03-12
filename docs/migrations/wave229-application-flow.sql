-- Wave 229 — Clinician Application Flow
-- DRY-RUN ONLY: Do NOT run automatically; apply via `prisma migrate deploy` in production

CREATE TYPE "ApplicationStatus" AS ENUM (
  'PENDING',
  'REVIEWED',
  'ACCEPTED',
  'DECLINED',
  'WITHDRAWN'
);

CREATE TABLE "Application" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "opportunity_id" UUID NOT NULL REFERENCES "Opportunity"("id") ON DELETE CASCADE,
  "clerk_user_id"  TEXT NOT NULL,
  "npi"            TEXT,
  "cover_note"     TEXT,
  "status"         "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by"    TEXT,
  "reviewed_at"    TIMESTAMPTZ,
  "review_note"    TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("opportunity_id", "clerk_user_id")
);

CREATE INDEX "Application_clerk_user_id_idx" ON "Application"("clerk_user_id");
CREATE INDEX "Application_opportunity_id_idx" ON "Application"("opportunity_id");
CREATE INDEX "Application_status_idx"         ON "Application"("status");
