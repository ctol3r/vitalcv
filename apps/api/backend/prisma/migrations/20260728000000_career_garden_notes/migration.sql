-- Career Garden persistence, bundle 1: private notes ("seeds") and the
-- Living CV lines a clinician explicitly grows from them.
--
-- Additive and idempotent (CREATE TABLE / INDEX IF NOT EXISTS). No FK to
-- users: rows are scoped by the internal User.id UUID resolved from the
-- verified Clerk identity in the route layer, matching the person-profile
-- family's convention. provenance defaults to the literal 'self_attested'
-- and the route layer rejects any other value — promotion can never mint a
-- source-backed claim.

CREATE TABLE IF NOT EXISTS "garden_notes" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"      UUID         NOT NULL,
  "title"       TEXT         NOT NULL,
  "body"        TEXT         NOT NULL,
  "tags"        TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"      TEXT         NOT NULL DEFAULT 'unfiled',
  "promotedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "garden_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "garden_notes_userId_createdAt_idx"
  ON "garden_notes" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "garden_cv_entries" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"      UUID         NOT NULL,
  "section"     TEXT         NOT NULL,
  "headline"    TEXT         NOT NULL,
  "detail"      TEXT         NOT NULL,
  "provenance"  TEXT         NOT NULL DEFAULT 'self_attested',
  "origin"      TEXT         NOT NULL,
  "fromNoteId"  UUID,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "garden_cv_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "garden_cv_entries_userId_createdAt_idx"
  ON "garden_cv_entries" ("userId", "createdAt");
