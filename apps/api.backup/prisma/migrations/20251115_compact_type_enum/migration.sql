-- Extend CompactType enum with COUNSELING support
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompactType') THEN
    RAISE NOTICE 'CompactType enum does not exist yet';
  ELSE
    ALTER TYPE "CompactType" ADD VALUE IF NOT EXISTS 'COUNSELING';
  END IF;
END $$;
