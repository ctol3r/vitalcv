# Merge Ledger — Wave Batch 2026-05-26

Permanent record of merge decisions for this multi-wave batch.
Only PRs with a **Codex SAFE** verdict (from `codex exec`, never a subagent stand-in) are eligible for merge.

`main` SHA at the start of this wave batch: `7f1cfb0501dc0bcc314c8c63848513393785c06c` (`fix(deploy): remove Vercel coupling, prepare Railway-native deploy (#415)`).

## PR #420 — `fix(api): preserve NPPES identity success when source payload is intact`

| Field | Value |
|---|---|
| Base | `wave-10a/docs-status` |
| Head | `wave/passport-deployment-evidence-repair` @ `1c1ce177fde27725df52f6e9e46d4756828b7f32` |
| Codex verdict | Not part of this wave's merge gate |
| Merge result | Not attempted in this wave (explicit out-of-scope) |
| `mergeable` | `MERGEABLE` (local merge into `wave-10a/docs-status` is clean) |
| `mergeStateStatus` | `UNSTABLE` |
| Blocking checks | `Vercel – vcv-web` FAILURE ("Account is blocked"), `Vercel – vitalcv` FAILURE ("Account is blocked"). Vercel Agent Review NEUTRAL. |
| Block source | Operator-side (Vercel account block). `main` branch protection is **NONE**, so failing Vercel statuses do not formally gate `gh pr merge`, but the explicit "do not bypass" rule applies. |
| Next required operator action | Unblock the Vercel account (or change Railway/Vercel-side strategy). PR #420 itself remains unmodified; if its backend slice is required on `main`, see PR #423 (transplant). |

## PR #421 — `fix(api): repair Railway build module resolution`

| Field | Value |
|---|---|
| Base | `main` |
| Head | `fix/api-railway-build-gap` @ `44ab7501860dc719422c4d2bd3e1999f7b1a7dfd` |
| Codex verdict | **UNSAFE** (implementation audit, 2026-05-26) |
| Merge result | **NOT merged** — hard rule respected. |
| `mergeable` | `MERGEABLE` |
| `mergeStateStatus` | `UNSTABLE` |
| Codex findings | <ul><li>**P1** `apps/api/backend/src/services/multi-tenant/tenantIsolation.ts:152-160` — When `requesterTenantId` is omitted, returns `OPEN` even when the capsule has an owner tenant. Audit replay routes call `replayDecision(id)` without forwarding the request organization, so any request that passes the org-context middleware can replay another tenant's capsule by id. Fail closed for tenanted capsules unless a matching requester or explicit internal/system authorization is provided.</li><li>**P2** `apps/api/backend/src/services/runtimeTrustCohesion.ts:242-251` — When `replayDecision` supplies a `tenantId` together with hashes read from capsule metadata, the fallback paths reuse the stored `payloadHash` / `mutationFingerprint` and the function later marks the replay as `tenantBound: true`. Existing mutation metadata is often unbound, so the replay can advertise tenant-scoped hashes whose preimage never included the tenant, defeating the cross-tenant collision guarantee. Recompute when `tenantId` is present, or only reuse hashes that are explicitly known to be tenant-bound.</li><li>**P2** `apps/api/backend/src/config/loadDotenv.ts:17` — In the built API, `__dirname` is `apps/api/backend/dist/apps/api/backend/src/config` because the backend `tsconfig` emits from the repo root into `dist`. `../..` therefore resolves to `apps/api/backend/dist/apps/api/backend`, not the package root, so the packaged server never loads `.env.local` / `.env`. Resolve from the real package root or detect the compiled layout.</li></ul> |
| Other checks | `Railway Deploy Preflight` SUCCESS; `Vercel – vcv-web` FAILURE (account blocked); `Vercel – vitalcv` FAILURE (account blocked); `Vercel Agent Review` NEUTRAL. |
| Next required operator action | Decide between: (a) author a follow-up commit that hardens `tenantIsolation` / `runtimeTrustCohesion` / `loadDotenv` per Codex's three findings, re-audit, then merge; or (b) accept these helpers as transplanted-from-prior-wave and explicitly document that the call-site (`replayEngine.ts`, route handlers) is responsible for forwarding tenant context — but this is a substantive call that needs human review, not a bypass. |

## PR #422 — `fix(test): exclude Playwright specs from Vitest web quality run`

| Field | Value |
|---|---|
| Base | `main` |
| Head | `fix/web-quality-playwright-vitest-exclude` @ `e294657a7b61eb605db233b45b0b7f0dc03b8e30` |
| Codex verdict | Not run — pre-empted by hard dependency. |
| Merge result | **NOT merged** — depends on PR #421's helpers. |
| `mergeable` | `MERGEABLE` |
| `mergeStateStatus` | `UNSTABLE` |
| Blocking checks | `Web Quality` FAILURE — but the failure is not in the vitest step. The job dies at the **"Build workspace package dependencies"** step (`pnpm turbo build --filter='!@vitalcv/web'`), which builds `@vitalcv/api` among others. Without PR #421's helper modules on `main`, `@vitalcv/api` cannot compile, so Web Quality cannot reach the vitest step regardless of `vitest.config.ts`. Vercel statuses also fail (account block). |
| Block source | **Downstream of PR #421.** This PR is mechanically correct (one-line config) but cannot demonstrate a green Web Quality run until PR #421's helpers reach `main`. |
| Next required operator action | After PR #421 lands, rebase this branch onto post-#421 main, re-run CI, run Codex audit, then merge. No code change needed here. |

## PR #423 — `fix(api): align NPPES source_complete truth state on main` (DRAFT)

| Field | Value |
|---|---|
| Base | `main` |
| Head | `fix/api-nppes-truth-state-main` @ `01f6187380000000000000000000000000000000` (head SHA recorded at draft open) |
| Codex verdict | Not yet run — draft. |
| Merge result | Draft / not eligible to merge until PR #421 lands. |
| Status | Backend-only transplant of PR #420's orchestrator slice onto `main` (because `delightful-essence` watches `main`, and `wave-10a/docs-status` must not be merged wholesale). |
| Validation | Focused `pnpm --filter @vitalcv/api test -- ingestOrchestrator` → 6/6 PASS, including both new regression tests. `pnpm lint` clean. `pnpm turbo run build --filter @vitalcv/api` FAILS — but failure is the same pre-existing helper-module gap on `main`, not from this branch's changes. |
| Block source | Same as PR #422 — depends on PR #421 landing first. |
| Next required operator action | Land PR #421, rebase, mark ready, Codex audit, merge. |

## Resulting `main` after this wave

```
$ git fetch origin main && git log --oneline -5 origin/main
7f1cfb050 fix(deploy): remove Vercel coupling, prepare Railway-native deploy (#415)
c103a1d1  fix(deploy): final cutover guardrails — API_BASE + rollback hierarchy
5214a957  fix(deploy): activation-calm hardening — DNS/TLS preflight + freeze policy
…
```

**No new commits landed on `main`.** Wave batch produced four open PRs (#420 untouched, #421 blocked by Codex, #422 blocked by #421, #423 draft blocked by #421) and one tracking PR (this docs-only branch).

## Aggregate blockers / next operator action

1. **PR #421 Codex findings** are the single root blocker. Resolving #421 unblocks #422 and #423 (and consequently allows `delightful-essence` to deploy from `main`).
2. **Vercel account block** is a separate operator-side issue surfaced on every PR's check rollup; not gating because branch protection is empty, but cosmetic noise on every PR.
3. **PR #420 backend deployment path** is via PR #423 (transplant), not via merging `wave-10a/docs-status`.
