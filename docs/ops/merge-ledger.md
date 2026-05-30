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
| Codex re-audit attempt | **BLOCKED**: `codex exec review` errored with `You've hit your usage limit. […] try again at 10:00 AM.` |
| Substitute audit | **Local Claude Code audit** authorized by operator. Returned **SAFE** on head `8e9aabe55` against `origin/main` `7f1cfb050`. All 11 audit items pass: closed-by-default tenant access; tenant-bound hash recompute; loadDotenv layout-robust; 20/20 focused regression tests; build 15/15; tsc clean; lint clean; no banned phrases; no migration/env/secret mutation; no stubs; merge simulation clean. |
| Merge result | **MERGED** as `fe9c6f9c12381cb49a9786cb1ff45918e2450cf0` on 2026-05-26 20:45:09Z. |
| Post-merge deploy | `delightful-essence` (api.vitalcv.com) auto-redeployed and is live on this SHA (verified via `/health` at 20:54Z — `git_branch:"main"`, `git_sha:"fe9c6f9c12381cb49a9786cb1ff45918e2450cf0"`). |

## PR #422 — `fix(test): exclude Playwright specs from Vitest web quality run`

| Field | Value |
|---|---|
| Base | `main` |
| Head | `fix/web-quality-playwright-vitest-exclude` @ `e294657a7b61eb605db233b45b0b7f0dc03b8e30` |
| Dependency | PR #421 landed on `main` as `fe9c6f9c1`; PR #422's upstream blocker is cleared. |
| Local audit verdict | **SAFE** on 2026-05-27 against post-cascade main (`9f272c80c`). One-line change (`apps/web/vitest.config.ts`: `tests/e2e/**` → `tests/**`). Merge sim clean (only that one file changed). Playwright collision error gone (Vitest no longer collects `apps/web/tests/trust-register.spec.ts`). `pnpm turbo run build --filter @vitalcv/web` 13/13 PASS. `pnpm lint` clean. 5–6 remaining `__tests__/` failures are pre-existing drift unrelated to this PR (`__tests__/wave1-external-pilot-flow.test.ts`, `__tests__/status-page-compliance-evidence.test.tsx`, etc.). |
| Merge result | **MERGED** as `801100c7f24f69b2ed5810197f3f5f58fc81333d` on 2026-05-27 03:28:22Z. |
| Post-merge | `main` is now at `801100c7f`. Three infrastructure PRs (#421 + #423 + #422) all landed. |

## PR #423 — `fix(api): align NPPES source_complete truth state on main` (DRAFT)

| Field | Value |
|---|---|
| Base | `main` |
| Head | `fix/api-nppes-truth-state-main` @ `01f618738a7858f8e2b20de4f2221cbf79a291ca` |
| Codex verdict | **Not yet run.** `reviews: []`, `comments: []`. Codex quota still exhausted as of this update; cannot audit. |
| Merge result | **NOT merged.** Stops at the hard rule. Additionally: |
| Resolution path | After PR #421 landed, branch was rebased onto post-#421 main (new head `221dba07bf81273402a73af9f4baa27043a2ba85`); validation re-ran green; `gh pr ready 423` flipped draft → ready; local Claude Code audit replaced Codex per operator instruction. |
| Local audit verdict | **SAFE** on head `221dba07b` against post-#421 main `fe9c6f9c1`. All 11 checklist items pass: subset of PR #420, NPPES-only promotion gate (sourceId='nppes' + displayName + identityStatus≠UNKNOWN + entityId), status/resultStatus structurally cannot contradict (written after extras spread), empty payload preserves FAILED, OIG/LEIE/PECOS/STATE_BOARD/FSMB/NURSYS never promoted, no migration / env / Railway / DNS / secret mutation, no overclaims (banned phrases only appear in design-QA negative-check list), build 15/15, ingestOrchestrator 6/6 incl. 2 NPPES regressions, lint clean, merge simulation clean. |
| Merge result | **MERGED** as `9f272c80ce842366a4ee43274b6584668c0a9e0c` on 2026-05-26 20:53:43Z. |
| Post-merge deploy | **CONFIRMED LIVE via Browser verification 2026-05-27** (~6h after merge). Railway active deployment subject is literally `fix(api): align NPPES source_complete truth state on main (#423)` with `ACTIVE / Deployment successful` status. `api.vitalcv.com/health?cb=v423r3` returns 200 with `git_sha:"9f272c80ce842366a4ee43274b6584668c0a9e0c"` (exact match) and metrics `total_requests:12, error_requests:0, p90:73ms` (fresh container — not recycled). PR #421's deployment now shows `REMOVED` in Railway history (superseded by #423, as expected). No Railway FAILED rows reference #421 or #423. |
| Live behavior validation | **Still pending — AUTH BLOCKED.** Wave 22 (2026-05-27): operator-safe SSE smoke attempted via Browser; stopped cleanly at the auth gate per runbook safety constraints. `POST https://vitalcv-web-production.up.railway.app/api/ingest/1699264564` returned `HTTP 403` with `x-cors-blocked: 1` header (no `runId` issued, no SSE stream opened, no SSE result fabricated). No credentials entered, no accounts created. Classification per runbook = **AUTH BLOCKED**. Side-finding (useful): unauthenticated `/passport?npi=1699264564` page contains **zero banned phrases** ("verified", "Identity confirmed", "source-confirmed", etc.) and renders honest "Unavailable / not connected / Do not treat this as an exclusion clearance" copy for NPPES, OIG/LEIE, PECOS, state board. To proceed: operator signs into vitalcv.com themselves; smoke can then be retried by an agent within the operator's authenticated session. |

## Resulting `main` after this wave

```
$ git fetch origin main && git log --oneline -5 origin/main
7f1cfb050 fix(deploy): remove Vercel coupling, prepare Railway-native deploy (#415)
c103a1d1  fix(deploy): final cutover guardrails — API_BASE + rollback hierarchy
5214a957  fix(deploy): activation-calm hardening — DNS/TLS preflight + freeze policy
…
```

**No new commits landed on `main`.** Wave batch produced four open PRs (#420 untouched, #421 blocked by Codex, #422 blocked by #421, #423 draft blocked by #421) and one tracking PR (this docs-only branch).

## Aggregate state (2026-05-26 ~20:55Z)

**Resolved:**

1. ✅ PR #421 merged to `main` as `fe9c6f9c1` (local audit SAFE; Codex unavailable).
2. ✅ Main API build green on post-#421 main (15/15, 0 cached) — verified in `docs/ops/api-main-build-smoke.md`.
3. ✅ PR #423 rebased, ready, locally audited SAFE, merged to `main` as `9f272c80c`.
4. ✅ `delightful-essence` (api.vitalcv.com) auto-redeployed from main — currently live on `fe9c6f9c1` (#421). `/health` confirms.

**Still in flight:**

1. **`delightful-essence` redeploy to #423.** Current API SHA is `fe9c6f9c1` (#421). New main head is `9f272c80c` (#423). Railway should auto-build; operator can confirm in the inspiring-reflection project.

**Carry-overs:**

1. **PR #422** (Web Quality vitest exclude) — still open; Web Quality CI may now pass on `main` because the upstream API build is no longer red. Worth a CI re-trigger + Codex/local audit.
2. **Vercel account block** — operator-side, unrelated to code.

## Next required operator action

1. Wait for `delightful-essence` to redeploy to `9f272c80c` (or trigger a manual redeploy).
2. Run authenticated SSE smoke for NPI 1699264564 against `api.vitalcv.com` — NPPES `source_complete` should be `"status":"SUCCESS"`; OIG/PECOS still `"status":"FAILED"`.
3. Re-trigger PR #422 CI now that main builds; audit; merge if green.
4. Address Vercel account block (separate / cosmetic).

## Cascade merges 2026-05-26 22:24–22:26 PDT (San Jose / Pacific)

Three PRs merged through the Local Claude Code audit gate (Codex disabled per operator instruction). Sequential cascade; each audit run against the latest post-merge `main`.

### PR #425 — `feat(web): TruthStateChip + TruthStateLegend visual foundation`

| Field | Value |
|---|---|
| Base | `main` (started at `801100c7f`; cascade-rebased to `801100c7f` head still — audit was off that SHA) |
| Head | `feat/truth-state-chip` @ `54b60d39d` |
| Local audit verdict | **SAFE** on 2026-05-26 22:23 PDT. Clean merge sim; 19/19 vitest; build 13/13; tsc clean; lint clean; banned-copy scan clean. |
| Merge result | **MERGED** as `a368a1ffb64f4ac20028fb0dbb22bb3f38607736` on 2026-05-27 05:24:07Z (2026-05-26 22:24:07 PDT). |
| Post-merge deploy | Not applicable — design-system component; no API or runtime route change. |

### PR #426 — `docs(design): define VitalCV visual system and screen language`

| Field | Value |
|---|---|
| Base | `main` (post-#425, `a368a1ffb`) |
| Head | `docs/design-system-foundation` @ `18eee2c3d` |
| Local audit verdict | **SAFE** on 2026-05-26 22:25 PDT. Single commit on branch touching 6 files all under `docs/design/`; merge sim clean against post-#425 main; banned-phrase hits only in avoid/risk enumeration per operator allowance. |
| Merge result | **MERGED** as `a88e014e463fdd53a948bb02b93a057554a97902` on 2026-05-27 05:25:16Z (2026-05-26 22:25:16 PDT). |

### PR #424 — `docs(ops): wave batch 2026-05-26 — merge ledger, main build smoke, completion board`

| Field | Value |
|---|---|
| Base | `main` (post-#426, `a88e014e4`) |
| Head | `docs/wave-batch-tracking` @ `453cb6fc1` |
| Local audit verdict | **SAFE** on 2026-05-26 22:26 PDT. 8 docs files in `docs/ops/`; merge sim clean against post-#426 main; banned-phrase hits in scan are all in PRE-EXISTING `docs/ops/` files (not in PR #424's diff) and all document banned lists as banned. |
| Merge result | **MERGED** as `50942ad1e47ef2e30c8587bed32582b41f818bab` on 2026-05-27 05:26:16Z (2026-05-26 22:26:16 PDT). |

## Final main state after cascade

```
$ git log --oneline -6 origin/main
50942ad1e docs(ops): wave batch 2026-05-26 — merge ledger, main build smoke, completion board (#424)
a88e014e4 docs(design): define VitalCV visual system and screen language (#426)
a368a1ffb feat(web): add TruthStateChip + TruthStateLegend visual foundation (#425)
801100c7f fix(test): exclude Playwright specs from Vitest web quality run (#422)
9f272c80c fix(api): align NPPES source_complete truth state on main (#423)
fe9c6f9c1 fix(api): repair Railway build module resolution (#421)
```

## Next required operator action

1. **Authenticated SSE smoke for NPI 1699264564** — operator-only, per `docs/ops/authenticated-sse-smoke-runbook.md`. Gates Product Truth Contract from "deployed" → "validated live".
2. **Wave H — Passport calm-degradation integration** — now unblocked by #425 + #426 on `main`. Recommended next coding wave.

## PR #428 — `docs(ops): define VitalCV agent operating SOP`

| Field | Value |
|---|---|
| Base | `main` (at `50942ad1e`) |
| Head | `docs/agent-operating-sop` @ `9b7799312` |
| Local audit verdict | **SAFE** on 2026-05-27 04:25 PDT. Merge sim clean; 3 docs only under `docs/ops/`; banned-phrase hits classified as banned-list documentation / negative-example bullets / workflow-approval language (all per operator allowance). |
| Merge result | **MERGED** as `97971b5780e7ccb0f58af19a5062796cc7f930a6` at 2026-05-27 11:26:55Z (= 04:26 PDT). |
| Post-merge | `main` is now at `97971b578`. The SOP doctrine is now the canonical operating reference for every AI tool that touches VitalCV (Claude Code primary; Claude Design always included; Browser only for live verification; Codex disabled; OpenClaw only on explicit request). |

## Visual-system cascade — Wave H → K (2026-05-27 → 2026-05-28 PDT)

Four PRs merged through Local Claude Code audit (Codex disabled per operator instruction). Sequential cascade against the latest post-merge `main` each time.

### PR #429 — `feat(web): calm degraded passport truth states` (Wave H)

| Field | Value |
|---|---|
| Base | `main` (post-cascade) |
| Head | `feat/passport-calm-degradation` @ `702f5d220` |
| Local audit verdict | **SAFE** on 2026-05-27 04:54 PDT. 3-file additive diff; merge sim clean; build 13/13; tsc clean; lint clean; 12/12 vitest including banned-phrase regression; truth-state behavior preserved (NPPES no-payload stays unavailable, OIG/PECOS stay not-connected). |
| Merge result | **MERGED** as `5b0e78c7eb94ab50bc81a0146b8fbc1510260121` on 2026-05-27 04:56 PDT (11:56:38Z). |

### PR #430 — `feat(web): make homepage NPI-first with role doors` (Wave I)

| Field | Value |
|---|---|
| Base | `main` (post-#429) |
| Head | `feat/home-npi-role-doors` @ `660cba87f` |
| Local audit verdict | **SAFE** on 2026-05-27 05:08 PDT. 2 files; only `verified` hits are internal CSS variable token names; banned-phrase scan clean; 11/11 vitest; build 13/13; tsc + lint clean. |
| Merge result | **MERGED** as `f7b5b367af6ff16f7b22f17e47e51e2e90ac80ea` on 2026-05-27 05:09 PDT (12:09:23Z). |

### PR #434 — `feat(web): clarify auth gate with calm sign-in surfaces` (Wave J)

| Field | Value |
|---|---|
| Base | `main` (post-cascade including #432/#433 other-agent merges) |
| Head | `feat/auth-calm-disclosure` @ `24bffe666` |
| Local audit verdict | **SAFE** on 2026-05-28 21:32 PDT. 4 files (new AuthDisclosureCard + 2 page rewrites + new test); Clerk config NOT touched; canonical sign-in / sign-up disclosure copy pinned by tests; 14/14 vitest including banned-phrase regression for "verify your email to get verified". |
| Merge result | **MERGED** as `3f5afc6223e270624a018cee7949758d118e9760` on 2026-05-28 21:33 PDT (04:33:55Z UTC). |

### PR #435 — `feat(web): render status and attribution as receipt registers` (Wave K)

| Field | Value |
|---|---|
| Base | `main` (post-#434) |
| Head | `feat/status-attribution-receipts` @ post-fix head |
| Local audit verdict | **SAFE** on 2026-05-28 21:39 PDT. 5 files (2 new components + 1 page edit + 1 new page + 1 new test). OIG/LEIE/PECOS/FSMB/Nursys all `connector-not-live`. NPPES at matrix level is `temporarily-unavailable` (per-request behavior left to backend gate). State board is `access-required`. Canonical disclaimer ("we do not claim HIPAA, SOC 2, or NCQA certification") surfaced on both /status and /trust/attribution. 16/16 vitest. Build-error fix mid-implementation: moved TRUST_ATTRIBUTION_DISCLAIMER constant off the Next page (only `default` / `metadata` / `generateMetadata` / `generateStaticParams` allowed) into the register component. |
| Merge result | **MERGED** as `e7b4e7e6caaa4e1a15b7164723b3e16531fcbe28` on 2026-05-28 21:40 PDT (04:40:46Z UTC). |

### Final `main` after cascade

```
$ git log --oneline -8 origin/main
e7b4e7e6c feat(web): render status and attribution as receipt registers (#435)
3f5afc622 feat(web): clarify auth gate with calm sign-in surfaces (#434)
f9049d258 fix(web): restore /passport completed-without-anchor copy + /status … (#433)
5a6ac229f fix(web): restore truth-contract copy on onboarding + review surfaces (#432)
f7b5b367a feat(web): make homepage NPI-first with role doors (#430)
5b0e78c7e feat(web): calm degraded passport truth states (#429)
f8721ff30 docs(ops): record cascade merge of PRs #425 #426 #424 (#427)
97971b578 docs(ops): define VitalCV agent operating SOP (#428)
```

### Next required operator action

1. **Authenticated SSE smoke** for NPI 1699264564 — biggest single percentage move on Product Truth Contract; releases the 18% hold on Source Integrations / PSV.
2. **Browser visual QA** of merged surfaces (/passport, /, /sign-in, /sign-up, /status, /trust/attribution) — closes the design-quality feedback loop.
3. **`fix/nppes-source-health-observability`** — next coding wave outside the visual-system arc.
