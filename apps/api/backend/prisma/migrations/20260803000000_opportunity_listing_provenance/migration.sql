-- Listing provenance: where an opportunity actually came from.
--
-- Until now every row in "Opportunity" was posted by an employer who claimed a
-- Type 2 NPI, so the read path could safely describe all of them as coming from
-- an employer profile. Ingested listings break that assumption: they are copied
-- from a public feed, nobody at that employer has claimed anything on VitalCV,
-- and the employer has stated no credential requirements to us.
--
-- Without a discriminator the read path would keep asserting employer-backed
-- provenance for rows that have none, and buildFallbackRequirements() would
-- publish VitalCV's own guesses under the words "Employer requires". These
-- columns exist so that cannot happen.
--
-- Additive and idempotent. Existing rows default to 'employer_posted', which is
-- what every current row genuinely is.

ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "listing_source" TEXT NOT NULL DEFAULT 'employer_posted';

-- Which feed produced it ('usajobs', …). NULL for employer-posted rows.
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "source_feed" TEXT;

-- The feed's own identifier for the posting. Together with source_feed this is
-- the idempotency key: re-running an ingest updates rather than duplicates.
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "source_ref" TEXT;

-- The original posting, so a reader can always leave and check the source.
-- Applying to a feed listing means applying THERE, not through VitalCV.
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "source_url" TEXT;

-- When the feed was last read. This is a fetch time, never a verification time.
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "fetched_at" TIMESTAMP(3);

-- One row per (feed, feed id) — the ingestion idempotency key.
--
-- NOT partial, deliberately. The obvious form of this index carries
-- `WHERE source_feed IS NOT NULL AND source_ref IS NOT NULL`, to keep
-- employer-posted rows out of it. That breaks the upsert: Prisma emits
-- `INSERT … ON CONFLICT (source_feed, source_ref)`, and Postgres cannot infer a
-- PARTIAL index for a conflict target unless the statement repeats the
-- predicate, which it does not — every ingest then fails with 42P10, one error
-- per listing, on a code path no unit test reaches.
--
-- The predicate was never needed anyway: Postgres treats NULLs as distinct in a
-- unique index, so any number of employer-posted rows can hold (NULL, NULL)
-- without colliding.
CREATE UNIQUE INDEX IF NOT EXISTS "Opportunity_source_feed_ref_key"
  ON "Opportunity" ("source_feed", "source_ref");

-- The public board separates the two populations constantly; index the
-- discriminator alongside the status it is always queried with.
CREATE INDEX IF NOT EXISTS "Opportunity_status_listing_source_idx"
  ON "Opportunity" ("status", "listing_source");
