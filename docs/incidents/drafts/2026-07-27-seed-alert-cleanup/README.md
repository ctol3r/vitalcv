# DRAFT — seed alert cleanup (2026-07-27)

**Draft only. This is not a Prisma migration and must not be run.**

These files were drafted in worktree `claude/vigilant-raman-d672c7` (branch superseded
by #945, kept as evidence, never committed). They were originally written to
`apps/api/backend/prisma/migrations/20260727120000_remove_fabricated_seed_alert/`,
which is the path `preDeployCommand` executes via `npx prisma migrate deploy`. They
were moved here so they cannot be picked up by a deploy. Nothing in this directory is
wired to any runner.

## Preconditions — all four are mandatory

1. **Requires explicit written production approval.** No part of this touches
   production until that approval exists. Deploying #945, or any other code, does not
   satisfy this and does not change any row.
2. **Requires fresh production counts immediately before execution.** Every number and
   row description in this directory is a snapshot from 2026-07-27 and is stale by
   definition. Re-derive counts against production in the same session as execution.
3. **The target must be the exact seed alert ID.** `"alertId" = 'seed-alert-license-expiring'`.
   Never a broad NPI predicate. A `WHERE subject = '1003000126'` or
   `description LIKE '%1003000126%'` form is prohibited: it would take rows that are
   not in scope.
4. **Claims about the other rows are unverified.** The working assumption below has
   NOT been established and must not be relied on until the canonical reconciliation
   receipt is complete.

## What is in scope

One row, identified by its seeded `alertId`:

| column | value observed 2026-07-27 (stale) |
| --- | --- |
| `alertId` | `seed-alert-license-expiring` |
| `subject` | `1003000126` |
| `description` | `California Medical License for NPI 1003000126 expires on 2026-03-19.` |
| `acknowledged` | `false` |
| `createdAt` | `2026-03-05 18:00:00` |

Why it is in scope: NPI 1003000126 is a real registrant (ARDALAN ENKESHAFI, M.D. in
NPPES). No source reported that licence or that expiry date. The row was written by
`TrustAlertsRepository.seedDefaults` and is served from `GET /api/alerts`.

## What is explicitly NOT established

A `SELECT` on 2026-07-27 returned other `TrustAlertRecord` rows carrying
`subject = '1003000126'` — appearing to be source-freshness SLA alerts
(`OIG_LEIE has exceeded its 24h freshness SLA for …`, `CLINICAL_TRIALS …`). The
reading that these describe our own lane freshness rather than making a claim about
the clinician, and are therefore legitimate and must survive, is **an unverified
working assumption**, not a finding. It has not been reconciled.

Do not use it to justify a predicate, a row count, or a decision to retain or delete
anything. Resolve it through the canonical reconciliation receipt first. This is the
single reason the exact-ID scope in precondition 3 is non-negotiable: it is correct
regardless of how that reconciliation lands.

## Files

| file | what it is |
| --- | --- |
| `ORIGINAL-migration.sql.txt` | Byte-for-byte copy of the draft as first written, kept as evidence. Its header contains a since-corrected premise — see below. `.txt` so no tool treats it as runnable SQL. |
| `seed-alert-cleanup.draft.sql` | The operative `DELETE`, unchanged from the original, with the stale premise removed from the header. Still a draft. |
| `rollback.draft.sql` | Capture-before-delete procedure and a reconstructed re-insert. Read its warnings before relying on either. |

### Corrected premise

`ORIGINAL-migration.sql.txt` states that the seed "has been rewritten in
trustAlerts.ts … under a new alertId". That is **not** true of the deployment path.
Renaming the `alertId` is precisely what would make a deploy write to the production
table, so #945 deliberately leaves the id unchanged. The corrected content therefore
reaches only fresh databases; existing rows are untouched by any deploy, and clearing
them stays this separate, separately-authorised data operation.

## Sequence this belongs to

1. Merge and deploy #945 (safe runtime containment; changes zero production rows).
2. Open the route-unregistration PR after removing overlap with #945/P0.2.
3. Then, and only then, authorise this cleanup with fresh production counts.
