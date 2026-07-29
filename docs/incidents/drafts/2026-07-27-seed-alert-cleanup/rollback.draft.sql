-- ===========================================================================
-- DRAFT — DO NOT RUN. NOT A PRISMA MIGRATION.
-- Rollback material for seed-alert-cleanup.draft.sql.
-- ===========================================================================
--
-- STEP 1 is the real rollback mechanism. STEP 2 is a fallback and is NOT
-- trustworthy on its own — read its warning.

-- ---------------------------------------------------------------------------
-- STEP 1 — CAPTURE BEFORE DELETE  (mandatory, run in the same transaction)
--
-- Snapshots the full row, every column, whatever the schema happens to be at
-- execution time. This is the only rollback source that is guaranteed complete.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "_incident_20260727_seed_alert_backup"
AS SELECT * FROM "TrustAlertRecord" WHERE false;

INSERT INTO "_incident_20260727_seed_alert_backup"
SELECT * FROM "TrustAlertRecord"
WHERE "alertId" = 'seed-alert-license-expiring';

-- Expect exactly 1 before proceeding to the DELETE.
SELECT count(*) AS rows_captured FROM "_incident_20260727_seed_alert_backup";

-- ---------------------------------------------------------------------------
-- STEP 1R — RESTORE from the capture (this is the rollback)
-- ---------------------------------------------------------------------------

-- INSERT INTO "TrustAlertRecord"
-- SELECT * FROM "_incident_20260727_seed_alert_backup"
-- WHERE "alertId" = 'seed-alert-license-expiring';

-- Drop the backup table only after the operation is signed off.
-- DROP TABLE "_incident_20260727_seed_alert_backup";

-- ---------------------------------------------------------------------------
-- STEP 2 — RECONSTRUCTED RE-INSERT  (fallback only)
--
-- !! WARNING — INCOMPLETE AND UNVERIFIED !!
--
-- These values come from two stale sources: the pre-#945 SEED_ALERTS literal in
-- trustAlerts.ts, and a SELECT run on 2026-07-27 that returned only alertId,
-- subject, description, acknowledged and createdAt.
--
-- The following columns were NEVER observed and are guessed as NULL/default:
--   id, credentialId, acknowledgedAt, sourceRunId, sourceRecordId,
--   verificationArtifactId, identityDeltaId, checksum, observedAt
--
-- If any of those carried a real value in production, this re-insert silently
-- loses it. Use STEP 1 instead. Only fall back to this if the capture was not
-- taken, and record that the restored row is a reconstruction.
-- ---------------------------------------------------------------------------

-- INSERT INTO "TrustAlertRecord" (
--   "alertId", "type", "severity", "title", "description",
--   "credentialId", "issuerId", "subject", "recommendedAction",
--   "acknowledged", "acknowledgedAt", "createdAt"
-- ) VALUES (
--   'seed-alert-license-expiring',
--   'credential_expiring',
--   'WARNING',
--   'License expiring in 14 days',
--   'California Medical License for NPI 1003000126 expires on 2026-03-19.',
--   NULL,
--   'did:vitalcv:issuer:ca-medical-board',
--   '1003000126',
--   'Initiate license renewal with California Medical Board.',
--   false,
--   NULL,
--   '2026-03-05T18:00:00.000Z'
-- );

-- ---------------------------------------------------------------------------
-- NOTE ON RE-SEEDING
--
-- Do not rely on seedDefaults to restore this row. It inserts only when the
-- alertId is absent, so after a successful DELETE the next boot would re-create
-- it from whatever SEED_ALERTS then contains — which, post-#945, is the
-- corrected content, not the original. That is the intended end state, but it
-- means "just restart the service" is NOT a rollback to the prior row.
-- ---------------------------------------------------------------------------
