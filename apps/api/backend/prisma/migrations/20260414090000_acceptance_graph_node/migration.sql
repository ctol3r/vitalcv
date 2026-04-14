-- Acceptance graph-node extension: additive, optional columns.
-- Existing callers of prisma.acceptance.create are untouched.

ALTER TABLE "Acceptance"
  ADD COLUMN "decisionState"          TEXT,
  ADD COLUMN "trust_signals_snapshot" JSONB,
  ADD COLUMN "role"                   TEXT;
