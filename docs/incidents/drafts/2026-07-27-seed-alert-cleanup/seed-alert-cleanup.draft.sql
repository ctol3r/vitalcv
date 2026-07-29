-- ===========================================================================
-- DRAFT — DO NOT RUN. NOT A PRISMA MIGRATION.
--
-- Requires explicit written production approval, and fresh production counts
-- taken immediately before execution. See README.md in this directory for the
-- full preconditions. This file is deliberately outside prisma/migrations/ so
-- that `prisma migrate deploy` can never pick it up.
-- ===========================================================================
--
-- Purpose: remove one fabricated seed alert that makes a credential claim about
-- a real physician.
--
-- `seed-alert-license-expiring` asserted "California Medical License for NPI
-- 1003000126 expires on 2026-03-19." NPI 1003000126 is ARDALAN ENKESHAFI, M.D.,
-- a real registrant; no source ever reported that licence or that date. The row
-- was written to production by TrustAlertsRepository.seedDefaults and is served
-- from GET /api/alerts.
--
-- Note on the code side: #945 deliberately does NOT rename the seed's alertId.
-- Because seedDefaults keys on alertId, renaming it is exactly what would turn a
-- code deploy into a production write. The id is therefore left as-is, the
-- corrected seed content reaches only fresh databases, and clearing the existing
-- row is this separate, separately-authorised operation. No code deploy removes
-- this row.
--
-- SCOPE — exact seeded alertId, never a broad NPI predicate.
--   PROHIBITED:  WHERE "subject" = '1003000126'
--   PROHIBITED:  WHERE "description" LIKE '%1003000126%'
-- Other rows carry that same subject. Whether they are legitimate has NOT been
-- established (see README, "What is explicitly NOT established"). The exact-ID
-- scope below is correct regardless of how that reconciliation lands, which is
-- why it is the only acceptable predicate.
--
-- Run rollback.draft.sql STEP 1 (capture) before this, in the same transaction.

BEGIN;

-- Expect exactly 1. If this is not 1, STOP and re-establish state.
SELECT count(*) AS rows_to_delete
FROM "TrustAlertRecord"
WHERE "alertId" = 'seed-alert-license-expiring';

DELETE FROM "TrustAlertRecord"
WHERE "alertId" = 'seed-alert-license-expiring';

-- Verify before committing. Expect 0.
SELECT count(*) AS rows_remaining
FROM "TrustAlertRecord"
WHERE "alertId" = 'seed-alert-license-expiring';

-- COMMIT;   -- left commented deliberately; uncomment only under approval
ROLLBACK;    -- default posture: prove the counts, change nothing
