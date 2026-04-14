-- Start Activation Graph Migration
-- 1. Remove broken FK from start_attestations.acceptance_id -> vcv_entities.id
-- 2. Add proper FK to employer_acceptances.id
-- 3. Add activation state machine fields
-- 4. Add denormalized clinician_npi and org_id for query performance

-- Drop old FK constraint (if exists)
DO $$ BEGIN
  ALTER TABLE start_attestations DROP CONSTRAINT IF EXISTS start_attestations_acceptance_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add new columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='start_attestations' AND column_name='clinician_npi') THEN
    ALTER TABLE start_attestations ADD COLUMN clinician_npi TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='start_attestations' AND column_name='org_id') THEN
    ALTER TABLE start_attestations ADD COLUMN org_id TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='start_attestations' AND column_name='activation_state') THEN
    ALTER TABLE start_attestations ADD COLUMN activation_state TEXT NOT NULL DEFAULT 'NOT_STARTABLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='start_attestations' AND column_name='activated_at') THEN
    ALTER TABLE start_attestations ADD COLUMN activated_at TIMESTAMPTZ;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add new FK to employer_acceptances.id
DO $$ BEGIN
  ALTER TABLE start_attestations
    ADD CONSTRAINT start_attestations_acceptance_id_fkey
    FOREIGN KEY (acceptance_id) REFERENCES employer_acceptances(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_start_attestations_clinician_npi ON start_attestations(clinician_npi);
  CREATE INDEX IF NOT EXISTS idx_start_attestations_org_id ON start_attestations(org_id);
  CREATE INDEX IF NOT EXISTS idx_start_attestations_activation_state ON start_attestations(activation_state);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update existing rows
UPDATE start_attestations SET activation_state = 'NOT_STARTABLE' WHERE activation_state IS NULL OR activation_state = '';
