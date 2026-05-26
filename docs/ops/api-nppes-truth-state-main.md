# NPPES Truth-State Backend Patch — Transplant onto `main`

**Date:** 2026-05-26
**Branch:** `fix/api-nppes-truth-state-main`
**Base:** `origin/main`
**Source of the patch:** the backend portion of PR #420 (`fix(api): preserve NPPES identity success when source payload is intact`), which targets `wave-10a/docs-status`.

## Why this branch exists

`delightful-essence` (Railway API service for `api.vitalcv.com`) watches `main`. PR #420 targets `wave-10a/docs-status`, so even after PR #420 merges to that branch, its backend SSE truth-state correction will never reach `delightful-essence` unless either:

- the relevant commits also land on `main`, or
- the operator intentionally changes the Railway watched branch.

Per session policy, `wave-10a/docs-status` must not be merged into `main` wholesale. This branch is the narrow alternative — only the backend ingest-orchestrator truth-state fix is transplanted.

## Relationship to PR #420

This is a **subset** of PR #420, not a copy:

| File | Included on `fix/api-nppes-truth-state-main` | Notes |
|---|---|---|
| `apps/api/backend/src/services/ingest/ingestOrchestrator.ts` | yes | Backend SSE truth-state fix + extras-spread ordering. |
| `apps/api/backend/__tests__/ingestOrchestrator.test.ts` | yes | Regression tests for both invariants. |
| `docs/ops/passport-railway-evidence-gate.md` | yes | Phase 1 evidence record (NPI 1699264564). |
| `docs/ops/passport-post-deploy-design-qa.md` | yes | Design re-QA checklist. |
| `apps/web/app/onboarding/page.tsx` | **excluded** | `main` already cleaned the prior banned phrase; current copy on `main` differs from the wave-10a baseline that PR #420 was rewriting. Skipping per "no unrelated web changes unless required for banned phrase cleanup." |

## Behavior changed (same as PR #420 backend slice)

`deriveSourceCompleteStatus(sourceId, result, extras)`:

- Promotes `status: FAILED → SUCCESS` for `source_complete` **only** when all of:
  - `sourceId === 'nppes'`,
  - `extras.displayName` is a non-empty string,
  - `extras.identityStatus` is set and not `'UNKNOWN'`,
  - `extras.entityId` is a non-empty string.
- Persists `IngestSourceRun.status` (`DONE` / `ERROR`) and clears `errorCode` to align with the effective status.
- Emits `status` and `resultStatus` **after** the `...extras` spread, so a stale `extras.status` or `extras.resultStatus` can never disagree with the derived truth.

## What this does NOT change

- OIG / LEIE / PECOS / STATE_BOARD / FSMB / NURSYS are never promoted; their `FAILED` truly means no evidence in this run.
- Empty / no-payload NPPES still emits `FAILED` (the promotion gate refuses).
- No source-outage or no-payload state is rebranded as success.
- No identity / pipeline / adapter code is touched.
- No Prisma schema, migration, env var, Railway service config, DNS, or secret is touched.
- No web copy changes.

## Build-gap dependency

`@vitalcv/api` build currently fails on `main` because helper modules referenced by `replayEngine.ts`, `employerActions.ts`, and `server.ts` were never landed on `main` (see PR #421 — `fix(api): repair Railway build module resolution`).

Until PR #421 (or an equivalent build repair) lands on `main`, this branch cannot pass `pnpm turbo run build --filter @vitalcv/api`. The orchestrator change itself is syntactically valid, but the surrounding package will not compile.

## Post-deploy SSE smoke (after `delightful-essence` redeploys from `main`)

```bash
BASE=https://vitalcv-web-production.up.railway.app
RUNID=$(curl -fsS -X POST -m 20 "$BASE/api/ingest/1699264564" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["runId"])')

curl -sSN -m 8 -H 'Accept: text/event-stream' \
  "$BASE/api/ingest/stream/$RUNID" \
  | grep -E '"status":"FAILED"|"status":"SUCCESS"' | head -5
# Expected:
#   NPPES source_complete  → "status":"SUCCESS"
#   OIG / PECOS source_complete → "status":"FAILED"
```

If the SSE event payload ever shows `"status":"SUCCESS","resultStatus":"FAILED"` (or vice versa) for the same source, the extras-spread ordering has regressed and the branch must be rolled back.
