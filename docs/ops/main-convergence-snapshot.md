# Main Branch Convergence Snapshot — 2026-05-27

Snapshot of `main`, deployed services, build state, and open PRs after the PR #421 + PR #423 merge cascade.

## Current `main` head

`9f272c80ce842366a4ee43274b6584668c0a9e0c` — `fix(api): align NPPES source_complete truth state on main (#423)`

### Latest 10 commits

```
9f272c80c fix(api): align NPPES source_complete truth state on main (#423)
fe9c6f9c1 fix(api): repair Railway build module resolution (#421)
7f1cfb050 fix(deploy): remove Vercel coupling, prepare Railway-native deploy (#415)
c103a1d14 fix(deploy): final cutover guardrails — API_BASE + rollback hierarchy
5214a9577 fix(deploy): activation-calm hardening — DNS/TLS preflight + freeze policy
015fb9454 fix(deploy): production activation hardening — keypair + smoke test
4fe670a12 fix(ci): remove dead "Deploy to Vercel" stub from monorepo workflow
e980d85e1 fix(deploy): resolve pre-flight deployment inconsistencies
3804b1cd8 fix(deploy): remove Vercel coupling, prepare Railway-native deploy
7f7ace104 feat(productization): refine activation continuity and trust readability
```

### Key merge commits

| Commit | PR | What | Effect |
|---|---|---|---|
| `9f272c80c` | #423 | NPPES truth-state correction transplant onto main | source_complete payload now agrees with derived truth (status=resultStatus, NPPES intact-payload promotion gate) |
| `fe9c6f9c1` | #421 | Restore 5 helper modules required by replayEngine / employerActions / server | `@vitalcv/api` builds cleanly on main; tenant isolation closed-by-default; tenant-bound hash recompute; loadDotenv compiled-layout robust |

## Deployed services

### `api.vitalcv.com` (Railway service: `delightful-essence`)

| Field | Value |
|---|---|
| Live SHA (2026-05-27 03:18Z) | `9f272c80c` |
| Live branch | `main` |
| `/health` status | `ok` |
| Recent requests | 13 successful, 0 errored, p90 73 ms |
| PR #421 live | **yes** |
| PR #423 live | **yes** (auto-deployed within ~6.4 hours of merge) |

### `vitalcv-web-production.up.railway.app` (Railway service: `vitalcv-web`)

| Field | Value |
|---|---|
| Branch | `wave-10a/docs-status` (per repo history; not re-verified this snapshot) |
| `/api/health` self-status | `ok` |
| `/api/health` backend status | `"degraded"` (web's own classifier disagrees with API's `/health` self-report; not blocking) |
| Clerk auth | enabled, production mode |

## Build state

### `@vitalcv/api` build smoke on `main`

Last run: 2026-05-26 ~20:55Z on `/tmp/vitalcv-main-api-smoke` (detached `origin/main`).

```
pnpm install --frozen-lockfile      → lockfile unchanged
pnpm turbo run build --filter @vitalcv/api --force
                                    → Tasks: 15 successful, 15 total; 0 cached; 15.14s
pnpm --filter @vitalcv/api exec tsc -p backend/tsconfig.json --noEmit → clean
pnpm lint                           → Tasks: 2 successful, 2 total
```

The 7 `TS2307` errors that kept `delightful-essence` stale for ~2 weeks before PR #421 are gone.

### Web build status

Not re-validated against post-#423 main in this snapshot. Last known state (from PR #422 worktree exploration in the prior batch): `pnpm turbo run build --filter @vitalcv/web` → 13/13 successful.

## Open PRs to revisit

| PR | Title | State | Status note |
|---|---|---|---|
| #420 | preserve NPPES identity success when source payload is intact | OPEN | Backend slice has reached `main` via PR #423 transplant. PR #420 itself still targets `wave-10a/docs-status` and was never merged. Operator decision: close as superseded, or leave open for any non-backend-slice content in that branch. |
| #422 | exclude Playwright specs from Vitest web quality run | OPEN | One-line `vitest.config.ts` exclude. Its #421 dependency is cleared on `main`; CI can be re-triggered, audited, merged. **Recommended: next docs-only-followup wave is PR #422 audit + merge.** |
| #424 | docs(ops): wave batch 2026-05-26 — merge ledger, main build smoke, completion board | OPEN | Tracking PR for this wave's docs (this file is being added on its branch). |
| Older PRs (#237, #240, #243, #247) | Wave A leftovers | OPEN | DB migrate baseline, cross-tenant reuse block, verifier RBAC, policy decision persistence. Have not been refreshed against modern main since 2026-05-05. **Risk of conflict with modern truth contract** — see Risk Register below. |

## Branch strategy (currently)

| Service | Watches branch | Modern? |
|---|---|---|
| `delightful-essence` (API) | `main` | **yes** — at `9f272c80c`, includes PR #421 build repair + PR #423 NPPES truth-state |
| `vitalcv-web` (web frontend) | `wave-10a/docs-status` | not on `main` — includes PR #419's web-side defensive copy, but does NOT track every API-side change automatically |

This is a **split-branch reality**: API tracks `main`, web tracks `wave-10a/docs-status`. They are not auto-reconciled.

## Convergence options

| Option | What it means | Trade-off |
|---|---|---|
| **A. Keep split intentionally** | API on `main`, web on `wave-10a/docs-status`. Forward features to web by cherry-picking onto `wave-10a/docs-status`. | Cheapest in the short term. Sustainable only if the two services don't accumulate truth-state divergence. Already strained: PR #419's web copy is on `wave-10a/docs-status`; PR #423's matching backend change had to be transplanted onto `main`. |
| **B. Migrate web to `main`** later | Bring `vitalcv-web` Railway service to watch `main` (or a release branch off `main`). | Requires reconciling whatever differences exist between `main` and `wave-10a/docs-status`. Should NOT be done by merging `wave-10a/docs-status` into `main` wholesale; that's the constraint we've been preserving. |
| **C. Service-specific release branches** | `release/api`, `release/web`, both branched off `main` on demand. | Highest discipline. Best for "billion-dollar platform" maturity. But adds a release-cut process and requires CI to know about both branches. |
| **D. Avoid blind `wave-10a/docs-status → main` merge** | Continue with narrow transplants like PR #423. | Safe. Operationally expensive — every web/API truth-state pair requires two PRs. |

**Recommendation:** Stay on **A** for the next 1–2 batches (operationally cheapest while we ship the NPPES source-health observability moat). Plan a deliberate transition to **B** or **C** before any new revenue commitment, because split-branch reality is incompatible with "near-zero-error, smooth-selling" maturity.

## Risk register

| # | Risk | Status | Mitigation |
|---|---|---|---|
| 1 | PR #423 not validated live by authenticated SSE smoke | **OPEN** | `docs/ops/authenticated-sse-smoke-runbook.md` — operator runs the runbook to flip Product Truth Contract from "deployed" to "validated live". |
| 2 | Browser SSE auth-blocked | OPEN | Same runbook — browser path uses operator's own session; no credential surfacing. |
| 3 | NPPES no-payload health not solved | OPEN | `docs/ops/nppes-source-health-next-wave.md` — 8-task spec for observability moat. |
| 4 | OIG / PECOS / STATE_BOARD / FSMB / NURSYS not connected | OPEN | None of these are claimed live anywhere; PR #423 explicitly does NOT promote them. Next batch: live adapter work for at least OIG/LEIE. |
| 5 | Older Wave A leftover PRs (#237, #240, #243, #247) may conflict with modern truth contract | OPEN | Stale; each needs a rebase + a fresh local audit before re-considering. Lower priority than items 1–4. |
| 6 | Web's `/api/health` reports `backend.status: "degraded"` despite API self-report `ok` | OPEN, cosmetic | Investigate the web classifier; not a deploy blocker. |
| 7 | `Deploy health probe` and `Source Health Probe` workflows failing every ~30 min due to missing `CRON_SECRET` repo secret | OPEN, cosmetic | Operator configures `CRON_SECRET` in repository Actions settings; outside this docs wave. |
| 8 | Vercel checks failing on every PR ("Account is blocked") | OPEN, operator-side | Already documented in `merge-ledger.md`; not gating because no branch protection requires it. |

## Highest risk

**Risk 1 — PR #423 not validated live by authenticated SSE smoke.** Until the smoke runs (per `docs/ops/authenticated-sse-smoke-runbook.md`), the NPPES truth-state correction is "deployed" but not "validated live" on the completion board. Every other risk in the register is observability or operational polish; this one is the truth-contract verification that gates the next revenue commitment.

## Next recommended action

1. Operator runs the authenticated SSE smoke runbook against `api.vitalcv.com` for NPI 1699264564. **Two-minute task; gates the entire next batch.**
2. If smoke passes: open `fix/nppes-source-health-observability` (Wave D's task 1 + task 3 — smallest combined increment) as the next coding wave.
3. If smoke surfaces a failure: classify per the runbook and open the appropriate triage wave.

## Audit trail

- Snapshot date: 2026-05-27 ~03:20Z
- `main` head at snapshot: `9f272c80c`
- API SHA at snapshot: `9f272c80c`
- No code change, no Railway settings, no env / DNS / secret mutation made during this snapshot.
