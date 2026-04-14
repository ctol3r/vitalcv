-- StartActivation: sidecar activation graph table. Non-FK reference to
-- Acceptance to avoid imposing constraints on the existing audit chain.

CREATE TABLE "start_activation" (
  "id"              UUID NOT NULL,
  "clinician_npi"   TEXT NOT NULL,
  "org_id"          TEXT,
  "acceptance_ref"  TEXT NOT NULL,
  "activation_state" TEXT NOT NULL,
  "activated_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "start_activation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "start_activation_clinician_npi_idx"  ON "start_activation" ("clinician_npi");
CREATE INDEX "start_activation_acceptance_ref_idx" ON "start_activation" ("acceptance_ref");
CREATE INDEX "start_activation_created_at_idx"     ON "start_activation" ("created_at");
