# `@vitalcv/api` Build Smoke — `main` 2026-05-26

Empirical record of whether `delightful-essence` (Railway API for `api.vitalcv.com`) can deploy `main` as-is.

## Run 1 — pre-#421 baseline (kept for record)

| Field | Value |
|---|---|
| Date | 2026-05-26 ~15:00Z |
| `main` SHA | `7f1cfb0501dc0bcc314c8c63848513393785c06c` (pre-#421) |
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

---

## Run 2 — post-#421 (and post-#423) main 2026-05-26 ~20:55Z

| Field | Value |
|---|---|
| Date | 2026-05-26 ~20:55Z |
| `main` SHA | `9f272c80ce842366a4ee43274b6584668c0a9e0c` (`fix(api): align NPPES source_complete truth state on main (#423)`) — both #421 and #423 now landed |
| Prior commit on main | `fe9c6f9c12381cb49a9786cb1ff45918e2450cf0` (#421) |
| Worktree | `/tmp/vitalcv-main-api-smoke` (fresh, detached at `origin/main`) |
| Install | `pnpm install --frozen-lockfile` — lockfile unchanged |

### Commands

```bash
pnpm turbo run build --filter @vitalcv/api --force
  Tasks: 15 successful, 15 total
  Cached: 0 cached, 15 total
  Time:    15.14s

pnpm --filter @vitalcv/api exec tsc -p backend/tsconfig.json --noEmit
  # clean (empty output)

pnpm lint
  Tasks: 2 successful, 2 total
  # web lint clean; only pre-existing marketing useCallback warning
```

### Conclusion

**`delightful-essence` CAN now build `main`.** The seven `TS2307` errors from Run 1 are gone. The single build-gap blocker that kept the Railway API service stuck at PR #359-era for ~2 weeks is resolved.

### Live deployment state

```bash
curl -fsS https://api.vitalcv.com/health
  {
    "status":"ok",
    "git_branch":"main",
    "git_sha":"fe9c6f9c12381cb49a9786cb1ff45918e2450cf0",   # = PR #421 merge commit
    "metrics": {...}
  }
```

`api.vitalcv.com` is live on PR #421 (`fe9c6f9c1`). PR #423 merged ~8 minutes later (`9f272c80c`); Railway should be auto-building the new deploy. Operator should confirm the next `/health` poll shows `git_sha:"9f272c80c..."` (or trigger a manual redeploy).

### Next action

1. Poll `https://api.vitalcv.com/health` until `git_sha` updates to `9f272c80c…` (or trigger Railway manual redeploy).
2. Run authenticated SSE smoke for NPI 1699264564 against `api.vitalcv.com`:

   ```bash
   BASE=https://vitalcv-web-production.up.railway.app
   RUNID=$(curl -fsS -X POST -m 20 "$BASE/api/ingest/1699264564" \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["runId"])')
   curl -sSN -m 8 -H 'Accept: text/event-stream' "$BASE/api/ingest/stream/$RUNID" \
     | grep -E '"status":"FAILED"|"status":"SUCCESS"' | head -5
   ```

   Expected once PR #423 is live: NPPES `source_complete` shows `"status":"SUCCESS"`; OIG/PECOS still `"status":"FAILED"`.
