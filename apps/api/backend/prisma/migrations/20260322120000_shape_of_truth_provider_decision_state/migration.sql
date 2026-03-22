-- Shape-of-Truth: ProviderDecisionState + ProviderDecisionHistory
-- Canonical 6-class decision persistence layer.
-- Updated on each verification run; history is append-only.

CREATE TABLE "provider_decision_states" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "npi"                   TEXT        NOT NULL,
  "decision_class"        TEXT        NOT NULL,
  "aggregate_confidence"  FLOAT8      NOT NULL,
  "context"               TEXT        NOT NULL DEFAULT 'credentialing',
  "methodology_version"   TEXT        NOT NULL,
  "evaluated_at"          TIMESTAMPTZ NOT NULL,
  "expires_at"            TIMESTAMPTZ NOT NULL,
  "claim_count"           INT4        NOT NULL DEFAULT 0,
  "gold_claim_count"      INT4        NOT NULL DEFAULT 0,
  "silver_claim_count"    INT4        NOT NULL DEFAULT 0,
  "freshness_evals"       JSONB       NOT NULL DEFAULT '[]',
  "negative_findings"     JSONB       NOT NULL DEFAULT '[]',
  "conflicts"             JSONB       NOT NULL DEFAULT '[]',
  "explanation"           TEXT        NOT NULL,
  "claim_ids"             JSONB       NOT NULL DEFAULT '[]',
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "provider_decision_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_decision_states_npi_key"        ON "provider_decision_states"("npi");
CREATE INDEX "provider_decision_states_class_idx"             ON "provider_decision_states"("decision_class", "evaluated_at");
CREATE INDEX "provider_decision_states_expires_idx"           ON "provider_decision_states"("expires_at");

CREATE TABLE "provider_decision_history" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "npi"                   TEXT        NOT NULL,
  "state_id"              UUID        NOT NULL,
  "decision_class"        TEXT        NOT NULL,
  "aggregate_confidence"  FLOAT8      NOT NULL,
  "context"               TEXT        NOT NULL DEFAULT 'credentialing',
  "methodology_version"   TEXT        NOT NULL,
  "evaluated_at"          TIMESTAMPTZ NOT NULL,
  "expires_at"            TIMESTAMPTZ NOT NULL,
  "explanation"           TEXT        NOT NULL,
  "negative_findings"     JSONB       NOT NULL DEFAULT '[]',
  "conflicts"             JSONB       NOT NULL DEFAULT '[]',
  "claim_ids"             JSONB       NOT NULL DEFAULT '[]',
  "recorded_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "provider_decision_history_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "provider_decision_history_state_fk" FOREIGN KEY ("state_id")
    REFERENCES "provider_decision_states"("id") ON DELETE CASCADE
);

CREATE INDEX "provider_decision_history_npi_idx"   ON "provider_decision_history"("npi", "recorded_at");
CREATE INDEX "provider_decision_history_class_idx" ON "provider_decision_history"("decision_class", "recorded_at");
