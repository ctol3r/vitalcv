-- REPLAY-PERSIST-α — Minimum durable replay-run + replay-event persistence.
--
-- Adds two tables that together carry the canonical replay identity
-- scheme v1: (lineageKey, runId, ordered-events). Pure-additive
-- migration; no existing table is modified. Both tables stay empty
-- until a writer is wired into the ingest path (follow-up PR).
--
-- Identity scheme v1 (enforced at the application layer, not in SQL):
--   * `lineageKey` is SHA-256 over the canonical entity-scoped payload
--     `entity|<id>|channel|<ch>|artifacts|<sorted-checksums>`, truncated
--     to 16 hex chars, prefixed `lin_v1_`. Two runs with the same
--     entity + channel + sorted-artifact-set produce the same lineageKey.
--   * `runId` is SHA-256 over the canonical run-scoped payload
--     (lineage payload extended with `|checkedAt|<iso>`), truncated to
--     16 hex chars, prefixed `run_v1_`. Two runs that additionally
--     share `checkedAt` produce the same runId.
--   * `payloadDigest` is the full-length SHA-256 hex of the run-scoped
--     payload, retained for audit / debugging without enabling
--     identifier-collision attacks.
--
-- Cardinality:
--   * Multiple ReplayRun rows MAY share a lineageKey (one row per
--     distinct checkedAt for the same entity + channel + artifacts).
--   * runId is UNIQUE — two rows with the same runId are by
--     construction the same run; the writer treats UNIQUE-violation
--     as idempotent.
--   * (replayRunId, sequenceNumber) is UNIQUE — each event within a
--     run has a deterministic, gap-free sort position.

CREATE TABLE "ReplayRun" (
  "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId"             TEXT         NOT NULL UNIQUE,
  "lineageKey"        TEXT         NOT NULL,
  "entityId"          TEXT         NOT NULL,
  "channel"           TEXT         NOT NULL,
  "checkedAt"         TIMESTAMP(3) NOT NULL,
  "artifactChecksums" TEXT[]       NOT NULL,
  "payloadDigest"     TEXT         NOT NULL,
  "recordedBy"        TEXT         NOT NULL DEFAULT 'system',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ReplayRun_lineageKey_idx" ON "ReplayRun"("lineageKey");
CREATE INDEX "ReplayRun_entityId_idx"   ON "ReplayRun"("entityId");
CREATE INDEX "ReplayRun_checkedAt_idx"  ON "ReplayRun"("checkedAt");

CREATE TABLE "ReplayEvent" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "replayRunId"    UUID         NOT NULL REFERENCES "ReplayRun"("id") ON DELETE CASCADE,
  "sequenceNumber" INTEGER      NOT NULL,
  "eventType"      TEXT         NOT NULL,
  "checksum"       TEXT         NOT NULL,
  "occurredAt"     TIMESTAMP(3) NOT NULL,
  "payload"        JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReplayEvent_run_seq_unique" UNIQUE ("replayRunId", "sequenceNumber")
);

CREATE INDEX "ReplayEvent_replayRunId_idx" ON "ReplayEvent"("replayRunId");
CREATE INDEX "ReplayEvent_eventType_idx"   ON "ReplayEvent"("eventType");
