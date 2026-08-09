-- Anchor witness: one row per anchored Merkle batch root, with external
-- witness evidence (Rekor transparency-log entry + RFC 3161 TSA token).
--
-- Additive and idempotent (CREATE TABLE / INDEX IF NOT EXISTS), matching the
-- career_garden_notes idiom. Only bare hex root hashes reach this table —
-- assertHashOnlyAnchor (M4-1, zero-PHI-on-chain) gates the boundary in the
-- anchor worker before any row is written.

CREATE TABLE IF NOT EXISTS "anchor_roots" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "merkleRoot"      TEXT         NOT NULL,
  "eventCount"      INTEGER      NOT NULL,
  "rekorStatus"     TEXT         NOT NULL DEFAULT 'pending',
  "rekorUuid"       TEXT,
  "rekorLogIndex"   TEXT,
  "tsaStatus"       TEXT         NOT NULL DEFAULT 'pending',
  "tsaToken"        BYTEA,
  "tsaUrl"          TEXT,
  "witnessAttempts" INTEGER      NOT NULL DEFAULT 0,
  "witnessedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "anchor_roots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "anchor_roots_merkleRoot_key"
  ON "anchor_roots" ("merkleRoot");

CREATE INDEX IF NOT EXISTS "anchor_roots_rekorStatus_idx"
  ON "anchor_roots" ("rekorStatus");

CREATE INDEX IF NOT EXISTS "anchor_roots_tsaStatus_idx"
  ON "anchor_roots" ("tsaStatus");
