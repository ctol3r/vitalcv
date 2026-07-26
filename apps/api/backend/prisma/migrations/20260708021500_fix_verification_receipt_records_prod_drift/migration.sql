-- Prod `verification_receipt_records` had drifted from the Prisma schema:
--   * match_confidence was `double precision` (schema: text) → the Prisma
--     client's binary bind desynced and every verificationReceiptRecord.create()
--     failed with Postgres 08P01 "insufficient data left in message";
--   * id had no `gen_random_uuid()` default (schema: dbgenerated) → null-id
--     violation once the type mismatch was fixed;
--   * retrieved_at was `timestamp` (schema: timestamptz(6)).
-- The net effect: every identity source (NPPES/OIG/PECOS) reported
-- "temporarily unavailable" on a fresh passport ingest, and readiness stuck low.
-- This realigns the columns to the schema. Idempotent + guarded so it is a
-- no-op on databases already at the correct types (e.g. fresh migrate deploy).
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'verification_receipt_records' AND column_name = 'match_confidence') = 'double precision' THEN
    ALTER TABLE "verification_receipt_records"
      ALTER COLUMN "match_confidence" TYPE text USING "match_confidence"::text;
  END IF;

  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'verification_receipt_records' AND column_name = 'retrieved_at') = 'timestamp without time zone' THEN
    ALTER TABLE "verification_receipt_records"
      ALTER COLUMN "retrieved_at" TYPE timestamptz(6) USING "retrieved_at" AT TIME ZONE 'UTC';
  END IF;

  ALTER TABLE "verification_receipt_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
END $$;
