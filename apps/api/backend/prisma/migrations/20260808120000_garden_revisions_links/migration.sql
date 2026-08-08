-- CC-05 / WB-02: Career Garden (customer-facing: VitalCV Workbench) revision
-- and typed-link persistence.
--
-- Additive and idempotent (CREATE TABLE / INDEX IF NOT EXISTS), matching the
-- 20260728000000_career_garden_notes idiom. No FK to users: rows are scoped
-- by the internal User.id UUID resolved from the verified identity in the
-- route layer. Revisions are immutable pre-images; links carry a closed
-- targetType allowlist enforced in the service layer, and their label is a
-- server-derived display snapshot, never caller-supplied.

CREATE TABLE IF NOT EXISTS "garden_note_revisions" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "noteId"    UUID         NOT NULL,
  "userId"    UUID         NOT NULL,
  "title"     TEXT         NOT NULL,
  "body"      TEXT         NOT NULL,
  "tags"      TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cause"     TEXT         NOT NULL DEFAULT 'update',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "garden_note_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "garden_note_revisions_userId_noteId_createdAt_idx"
  ON "garden_note_revisions" ("userId", "noteId", "createdAt");

CREATE TABLE IF NOT EXISTS "garden_note_links" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"     UUID         NOT NULL,
  "fromNoteId" UUID         NOT NULL,
  "targetType" TEXT         NOT NULL,
  "targetId"   TEXT         NOT NULL,
  "label"      TEXT         NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "garden_note_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "garden_note_links_userId_fromNoteId_targetType_targetId_key"
  ON "garden_note_links" ("userId", "fromNoteId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "garden_note_links_userId_targetType_targetId_idx"
  ON "garden_note_links" ("userId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "garden_note_links_userId_fromNoteId_idx"
  ON "garden_note_links" ("userId", "fromNoteId");
