-- ISSUER-10 — PSV receipt + issuer audit-event persistence (contract-aligned)
--
-- Closes the schema-alignment blockers recorded in
-- docs/architecture/vitalcv-backend-persistence-defer-decision.md (ISSUER-9).
-- The legacy "PsvReceipt" table stays untouched: it stores the pre-issuer-chain
-- PsvReceiptSnapshot shape and is NOT the issuer-chain PSVReceipt. These two
-- new tables mirror the ISSUER-4/7 TypeScript contracts in
-- apps/web/lib/issuer-verification/types.ts and auditPersistence.ts.
--
-- Truth invariants enforced at the database level via CHECK constraints:
--   * IssuerPsvReceipt."proofTier" must equal 'psv_receipt' (literal type).
--   * IssuerPsvReceipt."decisionGrade" must be TRUE — decision-grade for the
--     source check the receipt records, nothing wider.
--   * IssuerPsvReceipt."globalCredentialTruth" must be FALSE — a receipt can
--     never be read as global credential truth, by construction.
--   * IssuerPsvReceipt."limitations" must be a JSON array (may be empty;
--     legally_only/contracted_agent enforcement lives in the promotion gate).
--   * recordedBy stays inside the ReceiptCandidateAuditMetadata enum.
--
-- NOTE (CI visibility): backend-tests builds its ephemeral DB with `db push`,
-- which cannot express CHECK constraints — they exist only where this chain is
-- replayed (`prisma migrate deploy`: production and ci-preflight). Same gap as
-- the 20260504000000 scaffold constraints. The writer never constructs a
-- violating row; the CHECKs are defense-in-depth against any other writer.
--
-- Deliberately NO foreign key from "IssuerPsvReceipt"."requestId" to
-- "IssuerRequest"("requestId"): persistence rollout is incremental and
-- flag-gated, so a promoted receipt may be persisted for a request whose own
-- row predates the flag flip. A required FK would make the receipt write fail
-- for exactly the earliest real rows. Referential pairing is by requestId
-- value + index, same as the audit-event table.

CREATE TABLE "IssuerPsvReceipt" (
  "id"                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "psvReceiptId"           TEXT         NOT NULL UNIQUE,
  "psvCandidateId"         TEXT         NOT NULL,
  "receiptCandidateId"     TEXT         NOT NULL,
  "requestId"              TEXT         NOT NULL,
  "claimId"                TEXT         NOT NULL,
  "claimType"              TEXT         NOT NULL,
  "promotedAt"             TIMESTAMP(3) NOT NULL,
  "promotedBy"             JSONB        NOT NULL,
  "sourceBasis"            JSONB        NOT NULL,
  "attributedResponder"    JSONB        NOT NULL,
  "scope"                  JSONB        NOT NULL,
  "limitations"            JSONB        NOT NULL,
  "freshness"              JSONB        NOT NULL,
  "proofTier"              TEXT         NOT NULL DEFAULT 'psv_receipt',
  "decisionGrade"          BOOLEAN      NOT NULL DEFAULT TRUE,
  "globalCredentialTruth"  BOOLEAN      NOT NULL DEFAULT FALSE,
  "recordedBy"             TEXT         NOT NULL DEFAULT 'demo',
  "correlationId"          TEXT         NOT NULL,
  "idempotencyKey"         TEXT         UNIQUE,
  "notes"                  TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssuerPsvReceipt_proofTier_literal"
    CHECK ("proofTier" = 'psv_receipt'),
  CONSTRAINT "IssuerPsvReceipt_decisionGrade_must_be_true"
    CHECK ("decisionGrade" = TRUE),
  CONSTRAINT "IssuerPsvReceipt_globalCredentialTruth_must_be_false"
    CHECK ("globalCredentialTruth" = FALSE),
  CONSTRAINT "IssuerPsvReceipt_limitations_is_array"
    CHECK (jsonb_typeof("limitations") = 'array'),
  CONSTRAINT "IssuerPsvReceipt_recordedBy_enum"
    CHECK ("recordedBy" IN ('demo','review_surface','system'))
);

CREATE INDEX "IssuerPsvReceipt_psvReceiptId_idx"    ON "IssuerPsvReceipt"("psvReceiptId");
CREATE INDEX "IssuerPsvReceipt_psvCandidateId_idx"  ON "IssuerPsvReceipt"("psvCandidateId");
CREATE INDEX "IssuerPsvReceipt_requestId_idx"       ON "IssuerPsvReceipt"("requestId");
CREATE INDEX "IssuerPsvReceipt_claimId_idx"         ON "IssuerPsvReceipt"("claimId");
CREATE INDEX "IssuerPsvReceipt_createdAt_idx"       ON "IssuerPsvReceipt"("createdAt");

-- ISSUER-7 IssuerAuditEventRecord. `actor` is persisted whole (JSONB) plus a
-- mirrored "actorRole" column for filtering, exactly as the TS record carries
-- both. "payloadHash" may be the empty-string placeholder — the record type
-- forbids fabricating a hash, and so does this table (NOT NULL, no default).
CREATE TABLE "IssuerAuditEvent" (
  "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId"           TEXT         NOT NULL UNIQUE,
  "correlationId"     TEXT         NOT NULL,
  "requestId"         TEXT         NOT NULL,
  "subjectId"         TEXT,
  "actor"             JSONB        NOT NULL,
  "actorRole"         TEXT         NOT NULL,
  "eventType"         TEXT         NOT NULL,
  "occurredAt"        TIMESTAMP(3) NOT NULL,
  "source"            TEXT         NOT NULL,
  "payloadHash"       TEXT         NOT NULL,
  "limitationNote"    TEXT,
  "relatedArtifactId" TEXT,
  "recordedBy"        TEXT         NOT NULL DEFAULT 'system',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssuerAuditEvent_recordedBy_enum"
    CHECK ("recordedBy" IN ('demo','review_surface','system'))
);

CREATE INDEX "IssuerAuditEvent_correlationId_idx"       ON "IssuerAuditEvent"("correlationId");
CREATE INDEX "IssuerAuditEvent_requestId_idx"           ON "IssuerAuditEvent"("requestId");
CREATE INDEX "IssuerAuditEvent_eventType_occurredAt_idx" ON "IssuerAuditEvent"("eventType", "occurredAt");
CREATE INDEX "IssuerAuditEvent_createdAt_idx"           ON "IssuerAuditEvent"("createdAt");
