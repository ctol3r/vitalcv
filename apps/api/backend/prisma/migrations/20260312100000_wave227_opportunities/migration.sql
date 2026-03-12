-- Wave 227: Opportunities table for employer-posted roles

CREATE TABLE "Opportunity" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"  UUID NOT NULL,
  "title"            TEXT NOT NULL,
  "specialty"        TEXT NOT NULL,
  "hiring_type"      TEXT NOT NULL,
  "state"            TEXT NOT NULL,
  "pay_range"        TEXT,
  "requirement_level" TEXT NOT NULL DEFAULT 'L1',
  "description"      TEXT,
  "remote"           BOOLEAN NOT NULL DEFAULT false,
  "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Opportunity_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "Organization"("id")
    ON DELETE CASCADE
);

CREATE INDEX "Opportunity_organization_id_idx" ON "Opportunity"("organization_id");
CREATE INDEX "Opportunity_specialty_state_idx" ON "Opportunity"("specialty", "state");
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");
