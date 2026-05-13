-- TRUST-PERSIST-1 — Issuer-verification persistence scaffold (schema-only)
--
-- Adds the database tables that mirror the issuer-verification TypeScript
-- types in apps/web/lib/issuer-verification/types.ts (ReceiptCandidate,
-- IssuerVerificationRequest). No writer is wired in this PR; tables are
-- empty until a subsequent PR introduces the feature flag + Postgres writer.
--
-- Truth invariants enforced at the database level via CHECK constraints:
--   * ReceiptCandidate."decisionGrade" must be FALSE (mirrors the literal
--     `false` type in the TS layer; the candidate is by definition not
--     decision-grade).
--   * ReceiptCandidate."proofTier" when present must equal
--     'receipt_candidate' (mirrors the literal type in TS).
--   * ReceiptCandidate."recordedBy" must be one of 'demo' |
--     'review_surface' | 'system' (mirrors ReceiptCandidateAuditMetadata).

CREATE TABLE "IssuerRequest" (
  "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId"        TEXT         NOT NULL UNIQUE,
  "claimType"        TEXT         NOT NULL,
  "claimSummary"     TEXT         NOT NULL,
  "issuerCandidate"  JSONB        NOT NULL,
  "route"            JSONB        NOT NULL,
  "consent"          JSONB        NOT NULL,
  "status"           TEXT         NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  "expiresAt"        TIMESTAMP(3)
);

CREATE INDEX "IssuerRequest_requestId_idx" ON "IssuerRequest"("requestId");
CREATE INDEX "IssuerRequest_status_idx"    ON "IssuerRequest"("status");
CREATE INDEX "IssuerRequest_createdAt_idx" ON "IssuerRequest"("createdAt");

CREATE TABLE "ReceiptCandidate" (
  "id"                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "candidateId"              TEXT         NOT NULL UNIQUE,
  "requestId"                TEXT,
  "basis"                    TEXT         NOT NULL,
  "agentName"                TEXT,
  "sourceOrganizationName"   TEXT         NOT NULL,
  "attributionStatus"        TEXT         NOT NULL,
  "decisionGrade"            BOOLEAN      NOT NULL DEFAULT FALSE,
  "proofTier"                TEXT,
  "notes"                    TEXT,
  "limitationNote"           TEXT,
  "responseStatus"           TEXT,
  "responseSummary"          TEXT,
  "responseReceivedAt"       TIMESTAMP(3),
  "reviewState"              TEXT,
  "recordedBy"               TEXT         NOT NULL DEFAULT 'demo',
  "signedReceiptJwt"         TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReceiptCandidate_decisionGrade_must_be_false"
    CHECK ("decisionGrade" = FALSE),
  CONSTRAINT "ReceiptCandidate_proofTier_literal"
    CHECK ("proofTier" IS NULL OR "proofTier" = 'receipt_candidate'),
  CONSTRAINT "ReceiptCandidate_recordedBy_enum"
    CHECK ("recordedBy" IN ('demo','review_surface','system')),

  CONSTRAINT "ReceiptCandidate_request_fk"
    FOREIGN KEY ("requestId") REFERENCES "IssuerRequest"("requestId")
);

CREATE INDEX "ReceiptCandidate_candidateId_idx" ON "ReceiptCandidate"("candidateId");
CREATE INDEX "ReceiptCandidate_requestId_idx"   ON "ReceiptCandidate"("requestId");
CREATE INDEX "ReceiptCandidate_reviewState_idx" ON "ReceiptCandidate"("reviewState");
CREATE INDEX "ReceiptCandidate_createdAt_idx"   ON "ReceiptCandidate"("createdAt");
