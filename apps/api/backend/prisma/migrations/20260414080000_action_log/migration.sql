-- Employer action layer: lightweight log for non-accept actions
-- (request_data | flag). Accept actions continue to use the existing
-- Acceptance model.

CREATE TABLE "action_log" (
  "id"         UUID NOT NULL,
  "npi"        TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "rationale"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "action_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "action_log_npi_idx" ON "action_log" ("npi");
CREATE INDEX "action_log_createdAt_idx" ON "action_log" ("createdAt");
