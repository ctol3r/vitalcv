-- Opportunity search: a real keyword index, and the index the public board's
-- own access path was missing.
--
-- Until now there was no full-text search anywhere in this database — every
-- text search in the product is ILIKE '%q%' or a JS String.includes. That is
-- fine at the current row count and useless at the row count the ingestion
-- wave produces, because neither can use an index.
--
-- Additive and idempotent (IF NOT EXISTS throughout). No data is written or
-- rewritten: the tsvector is a GENERATED column, so Postgres derives it from
-- columns that already exist and keeps it in step on every write. Nothing here
-- invents a value or promotes a derived value into a stated one.
--
-- Note the table is "Opportunity" (PascalCase) — it has no @@map, unlike most
-- of its neighbours.

-- ── 1. Keyword search ────────────────────────────────────────────────────────
-- Weighted so a title hit outranks a specialty hit outranks a body hit, which
-- is the ranking the board applied in JS and can now get from ts_rank.
--
-- 'english'::regconfig is passed explicitly. The two-argument to_tsvector(text)
-- resolves the config from default_text_search_config at call time, which makes
-- it STABLE rather than IMMUTABLE, and a generated column requires IMMUTABLE.
--
-- The employer name deliberately is NOT in this vector: it lives on
-- organizations, and a generated column may only read its own row. Employer
-- search stays a relation filter.
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce("specialty", '')), 'B') ||
    -- hiring_type carries the commitment word people actually type ("locums
    -- psychiatry", "-telehealth"). Without it, an exclusion on a commitment
    -- silently matches nothing, because the term appears only in a column the
    -- vector never read. Weight D: it should qualify a search, not win one.
    setweight(to_tsvector('english'::regconfig, coalesce("hiring_type", '')), 'D') ||
    setweight(to_tsvector('english'::regconfig, coalesce("description", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Opportunity_search_vector_idx"
  ON "Opportunity" USING GIN ("search_vector");

-- ── 2. The missing index for the board's actual query ────────────────────────
-- listPublicOpportunities runs `WHERE status = 'ACTIVE' ORDER BY updated_at
-- DESC, created_at DESC`. The table had an index on status alone, which cannot
-- serve the ordering, so every board request sorted the whole active set.
CREATE INDEX IF NOT EXISTS "Opportunity_status_updated_at_idx"
  ON "Opportunity" ("status", "updated_at" DESC, "created_at" DESC);

-- ── 3. Structured filter columns ─────────────────────────────────────────────
-- pay_min/pay_max/employer_type/start_urgency are written on create and are now
-- read as authoritative. Index them so the filters that use them can be served
-- from the index once the legacy rows carry values too.
--
-- Partial on status: every public query is scoped to ACTIVE, and a partial index
-- stays small as closed roles accumulate.
CREATE INDEX IF NOT EXISTS "Opportunity_active_pay_idx"
  ON "Opportunity" ("pay_min", "pay_max")
  WHERE "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "Opportunity_active_employer_type_idx"
  ON "Opportunity" ("employer_type")
  WHERE "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "Opportunity_active_start_urgency_idx"
  ON "Opportunity" ("start_urgency")
  WHERE "status" = 'ACTIVE';
