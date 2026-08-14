-- Align the database constraint with the StartMission state vocabulary already
-- used by the canonical reader. Preserve the three legacy sidecar values so
-- existing rows and older adapters remain readable during convergence.
ALTER TABLE "start_activations"
  DROP CONSTRAINT IF EXISTS "chk_activation_state";

ALTER TABLE "start_activations"
  ADD CONSTRAINT "chk_activation_state"
  CHECK ("activation_state" IN (
    'NOT_STARTABLE',
    'READY_TO_START',
    'ACTIVE',
    'under_review',
    'head_start_accepted',
    'requirements_in_progress',
    'waiting_on_clinician',
    'waiting_on_issuer',
    'manual_review',
    'start_ready',
    'started',
    'withdrawn',
    'cancelled',
    'closed'
  ));
