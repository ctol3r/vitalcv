# `@vitalcv/api` Build Smoke — `main` 2026-05-26

Empirical record of whether `delightful-essence` (Railway API for `api.vitalcv.com`) can deploy `main` as-is.

## Inputs

| Field | Value |
|---|---|
| Date | 2026-05-26 |
| `main` SHA | `7f1cfb0501dc0bcc314c8c63848513393785c06c` (`fix(deploy): remove Vercel coupling, prepare Railway-native deploy (#415)`) |
| Worktree | `/tmp/vitalcv-api-main-smoke` (detached at `origin/main`) |
| Install | `pnpm install --frozen-lockfile` — lockfile unchanged |

## Command results

### `pnpm turbo run build --filter @vitalcv/api --force`

**FAIL.** `@vitalcv/api#build` exits 2. Other 14 workspace packages build successfully (0 cached due to `--force`).

Errors from `apps/api/backend`:

```text
backend/src/routes/employerActions.ts(53,8):  TS2307 Cannot find module '../services/runtimeTrustCohesion'
backend/src/server.ts(180,39):                TS2307 Cannot find module './config/loadDotenv'
backend/src/services/audit/replayEngine.ts(24,8):  TS2307 Cannot find module '../runtimeTrustCohesion'
backend/src/services/audit/replayEngine.ts(31,8):  TS2307 Cannot find module '../multi-tenant/tenantIsolation'
backend/src/services/audit/replayEngine.ts(41,8):  TS2307 Cannot find module './replayCorruptionContainment'
backend/src/services/audit/replayEngine.ts(45,8):  TS2307 Cannot find module './confidenceCalibration'
backend/src/services/audit/replayEngine.ts(610,40): TS7006 Parameter 'r' implicitly has 'any' type
```

The five missing modules are exactly the modules PR #421 attempts to restore. The implicit-`any` is a downstream effect of the missing `tenantIsolation` module.

### `pnpm --filter @vitalcv/api exec tsc --noEmit`

Same set of TS2307 errors, plus inherited type-resolution noise unrelated to the gap. Not separately reported here; same root cause.

### `pnpm lint`

PASS — 2/2 successful (web lint clean; marketing has its pre-existing `react-hooks/exhaustive-deps` warning unrelated to API).

## Conclusion

**`delightful-essence` cannot deploy `main` as of `7f1cfb050`.** Active Railway deployment remains stale at PR #359-era (~2 weeks old). Every newer deploy attempt fails at `@vitalcv/api` build with these same module-resolution errors.

## Smallest next repair wave

Land **PR #421 — `fix(api): repair Railway build module resolution`** (or an equivalent set of helper-module restorations that satisfies Codex's three findings).

Order of operations after #421 lands:

1. Re-run this smoke on the new `main` — expect `Tasks: 15 successful, 15 total`.
2. Mark PR #422 ready, re-run CI, expect green Web Quality.
3. Mark PR #423 ready, re-run CI, expect green build + green focused tests.
4. Merge #422 (CI hygiene).
5. Merge #423 (backend truth-state fix on `main`).
6. Confirm Railway auto-redeploys `delightful-essence` from new `main`.
7. Run authenticated SSE smoke against `delightful-essence` for NPI 1699264564 — expect NPPES `source_complete` `status:"SUCCESS"` and OIG/PECOS still `status:"FAILED"`.

## Browser / Railway deploy verification

**Not yet appropriate.** Don't run the deploy smoke until `main` actually builds. Browser/Cowork QA after step 6 above, not before.
