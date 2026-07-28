# Migration: `20260728000000_career_garden_notes`

**Scope (named, per the production-data doctrine):** two additive tables and
nothing else — `garden_notes` (private clinician notes / "seeds") and
`garden_cv_entries` (self-attested Living CV lines grown from them). No
existing table, column, index, or row is touched. No backfill. No data reads
during migration.

## What ships on top of it

- Backend: `src/services/garden/gardenService.ts` + `src/routes/gardenNotes.ts`
  under `/api/profile/garden/*` (tenant-guard skip inherited from the
  `/api/profile/` clinician-personal family; identity via the intake family's
  `requireInternalUserId`, so no new file reads identity headers).
- Truth contract: `garden_cv_entries.provenance` is the literal
  `'self_attested'` — the route layer rejects/ignores any caller value, and
  the origin sentence is derived server-side from the real note. Promotion is
  the only path from note → CV line; removing a line reopens its seed.
- Audits: `garden_note_created / _updated / _deleted / _promoted` and
  `garden_cv_entry_removed` written as durable `AuditEvent` rows in the route
  layer before every 2xx.

## Rollback

Both tables are leaf tables with no foreign keys and no readers outside the
garden routes. Rollback = revert the deploy; the tables sit inert. Dropping
them (if ever desired) loses only clinician notes/lines created in the
window — no other feature reads them.

## Verification plan

1. **Pre-merge:** migration SQL is idempotent (`CREATE TABLE / INDEX IF NOT
   EXISTS`) and replayed end-to-end by `scripts/backend-test-db.sh` (ephemeral
   Postgres + `prisma migrate deploy`) with the 9-test route suite on top.
   `check-migration-drift` passes (both models created by the chain).
2. **On merge:** Railway `preDeployCommand` runs `prisma migrate deploy`
   automatically.
3. **Post-deploy:** confirm `/api/version` serves the merge commit, then
   confirm both tables exist via `information_schema.tables` on the prod DB;
   first-touch smoke = Chris captures one note at `/holder/garden/notes`,
   sees it after reload, deletes it (exercises create/list/delete + audit).

## Receipt

- Author: Claude Code Terminal, 2026-07-28, branch `wave/career-garden-persistence`.
- Gates at authoring time: backend tsc ✓, migration-drift ✓, audit-coverage ✓,
  header-trust ratchet flat at 34 ✓, garden route suite 9/9 ✓.
