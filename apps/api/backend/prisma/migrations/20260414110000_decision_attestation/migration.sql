-- DecisionAttestation: tamper-evident sidecar capturing the decision +
-- evidence + trust snapshot at the moment an employer action was taken.

CREATE TABLE "decision_attestation" (
  "id"                  UUID NOT NULL,
  "clinician_npi"       TEXT NOT NULL,
  "action_taken"        TEXT NOT NULL,
  "decision_state"      TEXT NOT NULL,
  "decision_timestamp"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot"            JSONB NOT NULL,
  "hash"                TEXT NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decision_attestation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_attestation_clinician_npi_idx"     ON "decision_attestation" ("clinician_npi");
CREATE INDEX "decision_attestation_decision_timestamp_idx" ON "decision_attestation" ("decision_timestamp");
CREATE INDEX "decision_attestation_hash_idx"               ON "decision_attestation" ("hash");
