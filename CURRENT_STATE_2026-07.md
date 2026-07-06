# VitalCV — Current State Snapshot (2026-07, origin/main-anchored)

**Date:** 2026-07-06
**Branch:** `wave/master-plan-enterprise-ga` off `origin/main` @ `a27ea64ca` (#583)
**Supersedes** prior FINAL_*/INSTITUTIONAL_*/LIVE_* audits (archived in `docs/archive/2026-H1/`) for planning.

## Deployment
- **Prod is LIVE on Railway** (web + api synced on commit `9525877`, Clerk on,
  tenant guard enforcing). Sentry disabled (gap → M5-1). Evidence:
  `docs/ops/deployment-truth-2026-07-06.md`.

## Apps / packages
- GA product surface: `apps/web` (877 route/page files) + `apps/api/backend`
  (157 route files). `marketing`/`admin-api`/`mobile` partial;
  `issuer-api`/`verifier-api`/`status-api`/`authz` thin/stub; `router`/`sample-api`/`docs` placeholders.
- Substantive packages: `source-adapters`, `trust-contract`, `psv-adapters`,
  `domain-evidence`, `domain-common`, `trust-state` (ships from `dist/`, turbo-prebuild).
  ~8 phantom dist-only packages (`claims`, `idempotency`, `rate-limiter`, `tracing`, `vitalindex`…).

## Security posture (origin/main)
- ASVS L2 scorecard + gap register **G1–G12** live at `docs/security/ASVS-scorecard-2026-07.md`.
  Open code gaps: **G1** header-trust authn (backend trusts `x-clerk-user-id`/`x-user-role`/`x-org-id`
  unverified — highest priority), **G2** verifier RBAC in shadow mode
  (`VERIFIER_RBAC_ENFORCED=false`), **G3** rate-limit keying (in-memory, no trust-proxy).
- Done on main: SCA critical-gate + dependabot (#572), Clerk CSP fix (#536),
  strong web security headers (`security-headers.mjs`).

## What this branch adds (M0–M2 port + M3+ ahead)
- M0-3 secrets hygiene, M0-6 orphan-SQL resolution, M0-2 root-doc archive (53→archive),
  M0-4/5/7 inventories + deployment truth.
- M1 CI gates: `canonical-path-gate` (67-case guard proof), `audit-coverage-gate`
  (93-file baseline freeze), `copy-compliance-gate` (extended: marketing scan +
  bare-`Verified` + allowlist).
- M2 marketing doctrine-honesty (removed SAM.gov/ABIM/DEA claims).
- M3+ work continues on this branch (see status docs under `docs/security`).

## Verify-before-asserting
Prod flag values, migration-apply status, and signed-in walkthroughs need prod
credentials (Clerk bot-blocks automated browsers). `prisma migrate` stays
founder-gated (doctrine Rule 4).
