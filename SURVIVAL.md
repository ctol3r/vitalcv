# Survival / Cloudflare Migration Branch

**Branch**: `survival/cloudflare-migration`
**Status**: documentation + migration-prep only. **NO automatic deploy. Not safe to merge to main without operator review.**

## What this branch contains

Four audit documents in `docs/architecture/`:

1. **`build-churn-audit.md`** — eliminates duplicate CI triggers + reduces cron frequency for ~70% CI-minute reduction
2. **`cloudflare-compatibility-audit.md`** — three migration paths (A: full edge rewrite, B: nodejs_compat partial, C: CDN-proxy hybrid). Recommends Path C for survival mode.
3. **`minimal-runtime-env.md`** — deterministic env-var migration inventory; extraction procedure from Vercel; import procedure to Cloudflare
4. **`minimal-dynamic-runtime.md`** — smallest possible dynamic surface (~10 routes); the rest can be static. Target cost <$50/mo.

Plus one Cloudflare config stub: `wrangler.toml.example` (not active; example only).

## What this branch does NOT contain

- No `next.config.mjs` modifications
- No route-runtime declaration changes
- No code modifications (no `apps/web/**` changes)
- No CI workflow modifications (audit only)
- No active `wrangler.toml` (the `.example` is reference-only)
- No DNS / Cloudflare-account configuration

The branch is **documentation-grade migration prep**, not an active
migration.

## How to use this branch

### Decision flow

1. Read `cloudflare-compatibility-audit.md` §9 — pick Path A / B / C.
2. Read `minimal-dynamic-runtime.md` §6 — confirm the launchable surface area.
3. Read `minimal-runtime-env.md` §6 — operator extraction checklist.
4. Read `build-churn-audit.md` §5 — concrete CI workflow diffs.

### If proceeding with migration

Each audit doc has a concrete-changes section. The operator chooses
which to apply:

- `build-churn-audit.md` §5.1–§5.3 — CI workflow edits (low-risk, can land on `main` separately)
- `cloudflare-compatibility-audit.md` §5–§6 — Cloudflare config + DNS (operator-side; no repo code change for Path C)
- `minimal-runtime-env.md` §4 — env extraction commands (operator-side)
- `minimal-dynamic-runtime.md` §6 — static-ifying opt-in per surface

### If pausing

This branch is safe to leave dormant. It tracks `origin/main`; pull
to refresh. The audits remain valid as long as the underlying code
doesn't change the runtime topology of the surfaces enumerated.

## Recommended next steps

In priority order (lowest risk → highest impact):

1. **Apply CI workflow diffs from `build-churn-audit.md` §5** as a small PR to `main`. Reduces ongoing CI cost ~70% immediately. No production risk.
2. **Move DNS through Cloudflare as a proxy** (`cloudflare-compatibility-audit.md` §6 Path C). Static-page traffic absorbed at CF edge. Vercel only sees dynamic. Repo-level: no change.
3. **Configure aggressive CF cache rules** for static routes per `minimal-dynamic-runtime.md` §2. Operator-side; cache config in CF dashboard.
4. **(Optional, later)** opt-in static-ification of specific marketing routes when traffic patterns reveal which routes drive cost.

## Constraints honored

Per the user's directive for this wave:

- DO NOT expand architecture — ✓ (audit only)
- DO NOT add speculative systems — ✓
- DO NOT create infra complexity — ✓ (Path C is the simplest migration path)
- DO NOT optimize for future hyperscale — ✓ (target is <$50/mo, not 100k req/s)
- Optimize for: low cost, low complexity, static-first, fast launch, real signup flows, operational sustainability — all addressed

## Bottom line

If the operator follows the recommended path (Driver 1+2+3 from
`build-churn-audit.md` + Path C from `cloudflare-compatibility-audit.md`),
the runtime survives at near-zero cost without disrupting current
signup flows. No code rewrite required.

The branch sits in the repo as a reference operators can return to
when cost or platform decisions need re-litigation.
