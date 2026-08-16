-- The profession an EMPLOYER stated, when the feed carries one.
--
-- Nullable on purpose and with no default: null means the employer said
-- nothing, and the read path falls back to classifying the job title. A
-- default would turn silence into a stored claim.
ALTER TABLE "Opportunity" ADD COLUMN "stated_profession" TEXT;
