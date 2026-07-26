-- Structured matching inputs on opportunities so employer-posted nuance drives
-- MATCHA scoring (comp via pay_max, urgency via start_urgency, employer-fit via
-- employer_type) instead of being defaulted in the mapper. Additive + nullable
-- + IF NOT EXISTS → safe and idempotent on any environment.
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "pay_min" INTEGER;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "pay_max" INTEGER;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "employer_type" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "start_urgency" TEXT;
