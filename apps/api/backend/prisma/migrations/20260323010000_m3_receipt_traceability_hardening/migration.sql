-- Milestone 3: canonical evidence + replayable receipt hardening
-- Persist claim explanations/freshness and full receipt traceability fields
-- so trust-critical evidence survives the DB round-trip.

ALTER TABLE "claim_records"
  ADD COLUMN "explanation" TEXT,
  ADD COLUMN "freshness_window_hours" INTEGER;

UPDATE "claim_records"
SET "explanation" = COALESCE(
  "explanation",
  "review_reason",
  CONCAT("claim_type", ' from ', "source_id", ' observed at ', TO_CHAR("observed_at", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
)
WHERE "explanation" IS NULL;

ALTER TABLE "verification_receipt_records"
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "retrieved_at" TIMESTAMPTZ,
  ADD COLUMN "raw_artifact_ref" TEXT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "claim_type" TEXT,
  ADD COLUMN "match_confidence" TEXT,
  ADD COLUMN "freshness_window_hours" INTEGER,
  ADD COLUMN "integrity_hash" TEXT;
