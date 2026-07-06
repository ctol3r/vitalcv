# M0-6 — Resolve orphan `manual_start_activation_*.sql`

**Date:** 2026-07-06
**Status:** Plan (apply step is founder-gated — no `prisma migrate` without approval)

## Problem

Two hand-written SQL files sat in `apps/api/backend/prisma/migrations/` outside
Prisma's migration tracking, polluting `prisma migrate status`:

- `manual_start_activation_graph.sql`
- `manual_start_activation_sidecar.sql`

They are two competing designs for the same "start activation" feature.

## Verified reality (against `schema.prisma` @ HEAD)

| File | Design | Reflected in schema? | Disposition |
|---|---|---|---|
| `..._graph.sql` | Mutates `start_attestations`: drops old FK, adds `clinician_npi`/`org_id`/`activation_state`/`activated_at`, re-points FK to `employer_acceptances` | **No.** `model StartAttestation` (schema.prisma:3651) kept its original shape — none of these columns exist. | **Abandoned → delete** |
| `..._sidecar.sql` | New `start_activations` table, no FK constraints, CHECK on `activation_state` | **Yes.** `model StartActivation` (schema.prisma:1644) matches the DDL field-for-field. Referenced by `driftEngine.ts`, `omegaOrchestrator.ts`, `driftPropagation.ts`. | **Chosen → promote to proper migration** |

The sidecar approach won: safer (no FK to break existing relations), and it is
the one wired into the decision-engine services.

## Actions taken (this commit — all inert, no DB writes)

1. **Deleted** `manual_start_activation_graph.sql` (abandoned design).
2. **Promoted** the sidecar DDL to a proper Prisma migration directory:
   `prisma/migrations/20260706000000_start_activation_sidecar/migration.sql`
   (idempotent `CREATE TABLE IF NOT EXISTS` preserved). Migration files are
   inert until `prisma migrate deploy` is run.
3. **Deleted** `manual_start_activation_sidecar.sql` (superseded by #2).

## Founder-gated apply step (do NOT run without approval — doctrine Rule 4)

Before applying, verify prod DB state, because the manual sidecar SQL may have
already been applied out-of-band:

```bash
# 1. Check whether start_activations already exists in the target DB
psql "$DATABASE_URL" -c "\dt start_activations"

# 2a. If the table does NOT exist → apply the new migration
pnpm --filter @vitalcv/backend exec prisma migrate deploy

# 2b. If the table ALREADY exists (applied manually earlier) → baseline it
#     so migrate history matches without re-running DDL:
pnpm --filter @vitalcv/backend exec prisma migrate resolve \
  --applied 20260706000000_start_activation_sidecar

# 3. Confirm schema == DB
pnpm --filter @vitalcv/backend exec prisma migrate status   # expect: up to date
```

## Acceptance (M0-6)

- [x] No orphan `manual_*.sql` in the migrations dir.
- [x] Sidecar DDL preserved as a tracked, properly-named migration.
- [ ] `prisma migrate status` == "up to date" — **founder-gated** (needs prod `DATABASE_URL`).
