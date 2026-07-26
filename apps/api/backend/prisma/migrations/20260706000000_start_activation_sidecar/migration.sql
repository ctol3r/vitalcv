-- Start Activation Graph (Sidecar)
-- NO FK constraints — acceptanceId is a string reference only.
-- Safe to deploy without breaking existing relations.

CREATE TABLE IF NOT EXISTS start_activations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_npi   TEXT NOT NULL,
  org_id          TEXT NOT NULL,
  acceptance_id   UUID,
  role            TEXT,
  activation_state TEXT NOT NULL DEFAULT 'NOT_STARTABLE',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at    TIMESTAMPTZ,
  metadata        JSONB
);

CREATE INDEX IF NOT EXISTS idx_start_activations_clinician_npi ON start_activations(clinician_npi);
CREATE INDEX IF NOT EXISTS idx_start_activations_org_id ON start_activations(org_id);
CREATE INDEX IF NOT EXISTS idx_start_activations_acceptance_id ON start_activations(acceptance_id);
CREATE INDEX IF NOT EXISTS idx_start_activations_activation_state ON start_activations(activation_state);

-- Activation state check constraint
ALTER TABLE start_activations DROP CONSTRAINT IF EXISTS chk_activation_state;
ALTER TABLE start_activations ADD CONSTRAINT chk_activation_state
  CHECK (activation_state IN ('NOT_STARTABLE', 'READY_TO_START', 'ACTIVE'));
