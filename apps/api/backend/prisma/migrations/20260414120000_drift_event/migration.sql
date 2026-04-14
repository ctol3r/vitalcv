-- DriftEvent: append-only ingest-time record of source-state drift.
-- Old verificationArtifact rows and attestations are never mutated —
-- this table preserves historical replayability of past decisions.

CREATE TABLE "drift_event" (
  "id"             UUID NOT NULL,
  "subject_npi"    TEXT NOT NULL,
  "source"         TEXT NOT NULL,
  "previous_value" JSONB,
  "new_value"      JSONB NOT NULL,
  "drift_type"     TEXT NOT NULL,
  "detected_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "drift_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drift_event_subject_npi_idx" ON "drift_event" ("subject_npi");
CREATE INDEX "drift_event_source_idx"      ON "drift_event" ("source");
CREATE INDEX "drift_event_detected_at_idx" ON "drift_event" ("detected_at");
CREATE INDEX "drift_event_drift_type_idx"  ON "drift_event" ("drift_type");
