-- AcceptanceSnapshot: sidecar table for decision + trust-state memory
-- captured at accept action time. Independent of Acceptance audit rows.

CREATE TABLE "acceptance_snapshot" (
  "id"                     UUID NOT NULL,
  "clinician_npi"          TEXT NOT NULL,
  "decision_state"         TEXT NOT NULL,
  "trust_signals_snapshot" JSONB NOT NULL,
  "role"                   TEXT,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptance_id"          TEXT,

  CONSTRAINT "acceptance_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "acceptance_snapshot_clinician_npi_idx" ON "acceptance_snapshot" ("clinician_npi");
CREATE INDEX "acceptance_snapshot_created_at_idx"    ON "acceptance_snapshot" ("created_at");
CREATE INDEX "acceptance_snapshot_acceptance_id_idx" ON "acceptance_snapshot" ("acceptance_id");
