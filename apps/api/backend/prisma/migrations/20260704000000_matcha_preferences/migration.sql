-- MATCHA career preferences / Career DNA persistence.
-- One row per authenticated Clerk user; `data` is the sanitized
-- MatchaPreferences bag (self-stated, editable preferences — never credentials
-- or evidence). Keyed by clerkUserId so preferences follow the provider across
-- devices instead of living only in the browser's localStorage.

CREATE TABLE "MatchaPreference" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchaPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchaPreference_clerkUserId_key" ON "MatchaPreference"("clerkUserId");

CREATE INDEX "MatchaPreference_clerkUserId_idx" ON "MatchaPreference"("clerkUserId");
