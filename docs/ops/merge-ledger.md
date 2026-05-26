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
| Head | `fix/api-railway-build-gap` @ `8e9aabe55c060398550e974fc96ffda772064d43` (post-remediation) |
| Prior head | `44ab7501860dc719422c4d2bd3e1999f7b1a7dfd` (first Codex audit) |
| Codex verdict | **UNSAFE** on prior head; **pending re-audit** on new head (Codex usage quota hit; resets at 10:00 AM) |
| Merge result | **NOT merged** — hard rule respected. |
| `mergeable` | `MERGEABLE` |
| `mergeStateStatus` | `UNSTABLE` |
| Codex findings | <ul><li>**P1** `apps/api/backend/src/services/multi-tenant/tenantIsolation.ts:152-160` — When `requesterTenantId` is omitted, returns `OPEN` even when the capsule has an owner tenant. Audit replay routes call `replayDecision(id)` without forwarding the request organization, so any request that passes the org-context middleware can replay another tenant's capsule by id. Fail closed for tenanted capsules unless a matching requester or explicit internal/system authorization is provided.</li><li>**P2** `apps/api/backend/src/services/runtimeTrustCohesion.ts:242-251` — When `replayDecision` supplies a `tenantId` together with hashes read from capsule metadata, the fallback paths reuse the stored `payloadHash` / `mutationFingerprint` and the function later marks the replay as `tenantBound: true`. Existing mutation metadata is often unbound, so the replay can advertise tenant-scoped hashes whose preimage never included the tenant, defeating the cross-tenant collision guarantee. Recompute when `tenantId` is present, or only reuse hashes that are explicitly known to be tenant-bound.</li><li>**P2** `apps/api/backend/src/config/loadDotenv.ts:17` — In the built API, `__dirname` is `apps/api/backend/dist/apps/api/backend/src/config` because the backend `tsconfig` emits from the repo root into `dist`. `../..` therefore resolves to `apps/api/backend/dist/apps/api/backend`, not the package root, so the packaged server never loads `.env.local` / `.env`. Resolve from the real package root or detect the compiled layout.</li></ul> |
| Other checks | `Railway Deploy Preflight` SUCCESS; `Vercel – vcv-web` FAILURE (account blocked); `Vercel – vitalcv` FAILURE (account blocked); `Vercel Agent Review` NEUTRAL. |
| Remediation applied (commit `8e9aabe55`, 2026-05-26) | <ul><li>**P1 fix** — Added `RequesterAuthority` axis + new violation `MISSING_REQUESTER_FOR_TENANT_OWNED` to `tenantIsolation.ts`. `assertTenantScope` now refuses tenant-owned reads when `requesterTenantId` is null unless caller passes `requesterAuthority: 'system'` explicitly. Wired through `replayDecision` / `buildAuditBundle` and every `auditReplay.ts` route via a new `tenantScopeFromRequest(req)` helper that reads `getRequestOrganizationId(req)`. `TenantIsolationError` now maps to `403 Forbidden`.</li><li>**P2 fix** — `runtimeTrustCohesion.buildRuntimeReplayMetadata` recomputes `payloadHash` + `mutationFingerprint` whenever `tenantBound` is true; caller-supplied hashes are honored only on the un-anchored back-compat path.</li><li>**P2 fix** — `loadDotenv` walks up matching on `package.json#name === 'chai-vc-platform-backend'` to locate the package root in both source and compiled-dist layouts. `process.cwd()` fallback for the Railway `--prefix` case.</li><li>**Tests** — 3 new files, 20 new test cases under `apps/api/backend/__tests__/*.codex.test.ts`. All 20 pass on `8e9aabe55`.</li><li>**Validation on remediated branch** — `pnpm turbo run build --filter @vitalcv/api --force` 15/15 PASS; `tsc --noEmit` clean; lint clean.</li></ul> |
| Codex re-audit attempt | **BLOCKED**: `codex exec review` errored with `You've hit your usage limit. […] try again at 10:00 AM.` This is an operator-side ChatGPT/Codex account quota — `--oss` substitute would not satisfy the merge-protection hook ("real Codex SAFE verdict in transcript"). |
| Next required operator action | Wait for Codex quota reset (10:00 AM per the error message), then re-run `codex exec review` against `fix/api-railway-build-gap` head `8e9aabe55`. If SAFE → `gh pr merge 421 --squash --delete-branch=false` → cascade #422, #423. If UNSAFE → triage the new finding. |

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
| Head | `fix/api-nppes-truth-state-main` @ `01f618738a7858f8e2b20de4f2221cbf79a291ca` |
| Codex verdict | **Not yet run.** `reviews: []`, `comments: []`. Codex quota still exhausted as of this update; cannot audit. |
| Merge result | **NOT merged.** Stops at the hard rule. Additionally: |
| Hard rule | "Do not merge any PR unless Codex returned SAFE." Codex verdict absent → stop. |
| Compounding blockers | <ul><li>PR is still `isDraft: true` — GitHub will refuse a draft merge.</li><li>`Railway Deploy Preflight` check is FAILURE (because `main` still lacks PR #421's helpers — the build cannot pass until #421 lands).</li><li>Vercel checks FAILURE (account blocked, operator-side).</li><li>Codex quota exhausted → cannot run audit even if other blockers were resolved.</li></ul> |
| Status | Backend-only transplant of PR #420's orchestrator slice onto `main` (because `delightful-essence` watches `main`, and `wave-10a/docs-status` must not be merged wholesale). |
| Validation on draft branch | Focused `pnpm --filter @vitalcv/api test -- ingestOrchestrator` → 6/6 PASS. `pnpm lint` clean. `pnpm turbo run build --filter @vitalcv/api` FAILS — same pre-existing helper-module gap on `main`, not from this branch's changes. |
| Next required operator action (in order) | <ol><li>Land PR #421 on `main` (needs Codex SAFE after quota reset).</li><li>Rebase `fix/api-nppes-truth-state-main` onto post-#421 `main` (`git rebase origin/main`).</li><li>Confirm `pnpm turbo run build --filter @vitalcv/api --force` is now green on the rebased branch.</li><li>`gh pr ready 423` to flip draft → ready.</li><li>Run `codex exec review --base origin/main` against the rebased branch with the 11-point checklist (no source-truth changes, NPPES-only promotion gate, no other source promoted, no migrations / env / Railway / DNS / secret mutation, no banned phrases, build passes, focused tests pass).</li><li>If SAFE → `gh pr merge 423 --squash --delete-branch=false`.</li><li>Trigger `delightful-essence` redeploy.</li><li>Run authenticated SSE smoke for NPI 1699264564 — NPPES `source_complete` should be `"status":"SUCCESS"`; OIG/PECOS still `"status":"FAILED"`.</li></ol> |

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

1. **PR #421 Codex quota** is now the single root blocker. The three original Codex findings have been remediated on `fix/api-railway-build-gap` head `8e9aabe55` with 20 passing focused tests, but the re-audit cannot run until the Codex/ChatGPT usage limit resets (~10:00 AM per the error message). Once Codex is available, re-run `codex exec review --base origin/main` against this branch.
2. **Vercel account block** is a separate operator-side issue surfaced on every PR's check rollup; not gating because branch protection is empty, but cosmetic noise on every PR.
3. **PR #420 backend deployment path** is via PR #423 (transplant), not via merging `wave-10a/docs-status`.

## Downstream waves currently blocked behind PR #421 SAFE

- Merge `gh pr merge 421 --squash --delete-branch=false` (cannot proceed without SAFE).
- API main build smoke (cannot reproduce success on `main` until #421 lands).
- `gh pr ready 423` + rebase + re-validate (cannot prove the build green until #421 lands on `main`).
- Codex audit on PR #423 (cannot run until quota resets).
- `delightful-essence` redeploy + live SSE smoke (cannot run until #421 → #423 → main → redeploy).
