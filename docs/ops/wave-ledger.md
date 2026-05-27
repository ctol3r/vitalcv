# Wave Ledger

A wave-by-wave record of what was actually done. One row per wave. **Outcome** records only confirmed facts (merged / deployed / validated live); a PR existing is not an outcome.

Companion to:

- `docs/ops/merge-ledger.md` — per-PR merge-decision record.
- `docs/ops/vitalcv-completion-board.md` — full-scope percent completion board.

## How to read this ledger

| Column | Meaning |
|---|---|
| **Wave** | Sequential number within a batch. |
| **Date** | UTC date the wave executed. |
| **Mission** | One-line goal as instructed. |
| **Outcome** | Confirmed completed facts only. PR existing ≠ outcome. |
| **Artifacts** | Concrete commits, SHAs, PR numbers, docs files. |
| **Blockers (if any)** | What stopped the wave from advancing further. |

---

## Batch 2026-05-26 — Build-gap repair, NPPES truth-state transplant, and merge cascade

`main` SHA at batch start: `7f1cfb0501dc0bcc314c8c63848513393785c06c`
`main` SHA at batch end:   `9f272c80ce842366a4ee43274b6584668c0a9e0c`

### Afternoon half

| Wave | Date | Mission | Outcome | Artifacts | Blockers |
|---:|---|---|---|---|---|
| 1 | 2026-05-26 | Diagnose why PR #420 is not mergeable | PR #420 is mechanically MERGEABLE; mergeStateStatus UNSTABLE due to failing Vercel checks ("Account is blocked"). No conflicts; no rebase required. | report posted | Vercel account-block (operator-side). |
| 2 | 2026-05-26 | Repair `@vitalcv/api` Railway build failure | PR #421 opened with 5 helper modules restored + docs. Build green (15/15). | PR #421 (`fix/api-railway-build-gap`) head `44ab7501`; `docs/ops/api-railway-build-gap.md` | n/a |
| 3 | 2026-05-26 | Exclude Playwright spec from Vitest discovery | PR #422 opened — 1-line `vitest.config.ts` exclude broadened to `tests/**`. | PR #422 (`fix/web-quality-playwright-vitest-exclude`) head `e294657a` | Web Quality CI red due to upstream API build (not the vitest exclude). |
| 4 | 2026-05-26 | Merge wave (Codex SAFE gate) | NEITHER merged. Codex returned UNSAFE on PR #421 (3 findings). PR #422 dep-blocked. | ledger updated | Codex UNSAFE. |
| 5 | 2026-05-26 | Verify main API build smoke | Build FAILS on pre-#421 main (7 `TS2307` errors). `delightful-essence` cannot deploy main. | `docs/ops/api-main-build-smoke.md` Run 1 | Same #421 helper gap. |
| 6 | 2026-05-26 | Bring PR #420 backend onto main without merging wave-10a/docs-status | PR #423 (DRAFT) opened — backend slice cherry-pick. Build dependency-blocked on #421. ingestOrchestrator tests pass 6/6. | PR #423 (`fix/api-nppes-truth-state-main`) head `01f618738`; `docs/ops/api-nppes-truth-state-main.md` | #421 helper gap. |
| 7 | 2026-05-26 | Update VitalCV completion tracking | Board + merge ledger + smoke doc written. **No percentages moved** — nothing merged this half. | `docs/wave-batch-tracking` PR #424 | n/a |
| 8 | 2026-05-26 | Remediate PR #421 for Codex SAFE | 3 fixes + 20 focused regression tests + docs. Build/tsc/lint/tests all green. **Codex re-audit BLOCKED by ChatGPT quota** ("try again at 10:00 AM"). | PR #421 head `8e9aabe55` | Codex quota. |

### Evening half (operator authorized Local Claude Code audit substitute)

| Wave | Date | Mission | Outcome | Artifacts | Blockers |
|---:|---|---|---|---|---|
| 1L | 2026-05-26 | Audit PR #421 locally as Codex substitute | **SAFE.** Clean merge sim; security checklist passes; truth/deploy scan clean; build 15/15; tsc clean; lint clean; 20/20 focused regression tests. | verdict in conversation transcript | n/a |
| 9 | 2026-05-26 | Merge PR #421 if Wave 1L SAFE | **MERGED** as `fe9c6f9c12381cb49a9786cb1ff45918e2450cf0` at 20:45:09Z. | merge commit `fe9c6f9c1` | n/a |
| 10 | 2026-05-26 | Post-merge main API build smoke | Build green on `main` (15/15, 0 cached, ~15s). The 7 `TS2307` errors are gone. | `docs/ops/api-main-build-smoke.md` Run 2 | n/a |
| 11 | 2026-05-26 | Verify `delightful-essence` deployment (read-only) | `api.vitalcv.com/health` returns 200 with `git_branch:"main"`, `git_sha:"fe9c6f9c1…"`. **PR #421 is deployed live.** Web `/api/health` says backend "degraded" (likely stale snapshot, not error). | curl outputs | n/a |
| 5L | 2026-05-26 | Rebase + ready PR #423 | Rebased onto post-#421 main; head `221dba07b`. Build 15/15, ingestOrchestrator 6/6, tsc clean, lint clean. `gh pr ready 423` flipped draft → ready. | PR #423 head `221dba07b` | n/a |
| 6L | 2026-05-26 | Audit PR #423 locally | **SAFE** on all 11 checklist items. NPPES-only promotion gate confirmed; status/resultStatus structurally cannot contradict; empty payload preserves FAILED; OIG/LEIE/PECOS/STATE_BOARD/FSMB/NURSYS never promoted; no migration/env/secret mutation; banned phrases only in design-QA negative checks. | verdict in conversation transcript | n/a |
| 12 | 2026-05-26 | Merge PR #423 if Wave 6L SAFE | **MERGED** as `9f272c80ce842366a4ee43274b6584668c0a9e0c` at 20:53:43Z. | merge commit `9f272c80c` | n/a |
| 13 | 2026-05-26 | Update completion tracking + wave ledger | This document + extended completion board + merge ledger update. **All percentage moves backed by merged/deployed/live evidence.** | `docs/wave-batch-tracking` PR #424 (extended) | n/a |

### Carry-overs from this batch (NOT validated live)

- **PR #423 redeploy** to `delightful-essence` — should auto-build; operator can poll `/health` for `git_sha:"9f272c80c…"` or trigger manual redeploy.
- **Authenticated SSE smoke for NPI 1699264564** — required to move Product Truth Contract from "merged" → "validated live".
- **PR #422** — its #421 dependency is cleared; CI can be re-triggered, audited, merged.

### Operator instructions recorded this batch

- **2026-05-26 afternoon**: "Do not merge any PR unless Codex returned SAFE." (Hard rule.)
- **2026-05-26 evening**: "Codex is unavailable/quota-blocked and should not be used. This wave replaces Codex with a strict Claude Code audit." (Authorized substitute — applies to PRs #421 and #423 in this batch.)
- **Throughout**: "Do not modify Railway/DNS/env/secrets. No Prisma migrations. No product copy changes unless required for banned-phrase cleanup. No stubs that hide runtime errors."

### Convergence half (2026-05-27 — post-cascade)

| Wave | Date | Mission | Outcome | Artifacts | Blockers |
|---:|---|---|---|---|---|
| 14 | 2026-05-27 | Diagnose PR #423 deployment gap | **Resolved.** `api.vitalcv.com/health` 2026-05-27 03:18Z returns `git_sha:"9f272c80c…"` — PR #423 deployed live. Auto-deploy lag was ~6.4 hours. "Deploy health probe" CI failure is unrelated `CRON_SECRET` workflow misconfig. | `docs/ops/pr423-deployment-gap.md` | n/a |
| 15 | 2026-05-27 | Operator-safe authenticated SSE smoke runbook | Drafted. Browser-first path (no credential surfacing); curl path documented with safety constraints. Failure classes enumerated (AUTH BLOCKED, PATCH LIVE BUT SOURCE NO-PAYLOAD, DEPLOYMENT GAP, RUNTIME FAILURE, TRUTH-STATE CONTRADICTION). | `docs/ops/authenticated-sse-smoke-runbook.md` | Operator must run the smoke. |
| 16 | 2026-05-27 | NPPES source-health next-wave spec | 8-task observability moat scoped: adapter trace logging, per-source health endpoint, failure taxonomy, runId diagnostics, no-PHI debug snapshot, retry/backoff, freshness budget, web-classifier alignment. Truth constraints enforced; no migration in this wave. | `docs/ops/nppes-source-health-next-wave.md` | None — docs only. |
| 17 | 2026-05-27 | Main-branch convergence snapshot | Snapshot recorded: `main` head `9f272c80c`; API live on `9f272c80c`; web on `wave-10a/docs-status`. Split-branch reality + 4 convergence options + 8-item risk register. Highest risk: SSE smoke not yet run. | `docs/ops/main-convergence-snapshot.md` | None — docs only. |
| 18 | 2026-05-27 | Confirm PR #424 / docs branch status | PR #424 verified OPEN. Branch `docs/wave-batch-tracking` clean; this update extends it. | (this PR) | None. |
| 19 | 2026-05-27 | Completion-board update with operator baseline | Applied baseline (PTC 48, Core 30, PSV 18 held, BAR 29, DB 16, T/P/R 32, FE 35, Auth 22 held, Interop 26, Demo 24 held, Dep 28, T/CI 30, Agents 14, GTM 17, Overall 26 / 394). Trust/Proof/Receipts pulled back 1% from prior over-credit; Testing/CI pulled back 1% pending PR #422 merge. | `docs/ops/vitalcv-completion-board.md` | None. |

### Convergence half continuation (2026-05-27)

| Wave | Date | Mission | Outcome | Artifacts | Blockers |
|---:|---|---|---|---|---|
| 20 | 2026-05-27 | Audit + merge PR #422 (Web Quality vitest exclude) | **SAFE** local audit; **MERGED** as `801100c7f24f69b2ed5810197f3f5f58fc81333d` on 2026-05-27 03:28:22Z. Playwright collision error confirmed gone (`Vitest` no longer collects `apps/web/tests/trust-register.spec.ts`). 5–6 remaining `__tests__/` failures are pre-existing drift, not caused by this PR. | merge commit `801100c7f` | None — landed. |
| 21 | 2026-05-27 | Browser verification of PR #423 live deployment | **CONFIRMED PR423 LIVE.** Independent Browser-side verification of Railway active deployment + cache-busted `/health` probe. Railway active deployment subject literally contains `(#423)`; `api.vitalcv.com/health?cb=v423r3` returns `git_sha:9f272c80c…` (exact PR #423 merge SHA), `status:"ok"`, 12 requests / 0 errors / p90 73ms (fresh container). Railway history shows PR #421 deployment in `REMOVED` state (superseded by #423 as expected). No Railway FAILED rows reference #421 or #423. Browser session: read-only, no buttons clicked, no env/DNS/Railway/secret mutation. | classification `PR423 LIVE` | None for deployment. Authenticated SSE smoke still pending (needs operator browser session). |

### Carry-overs to next batch

- **Authenticated SSE smoke for NPI 1699264564** — operator-only; smallest wave that gates the largest move (PTC from 48% → "validated live"). With Browser confirming the container is live on PR #423, this is now the only gate between "deployed" and "validated live" for NPPES truth-state.
- ~~**PR #422 audit + merge**~~ ✅ landed (Wave 20).
- ~~**Browser deployment confirmation for PR #423**~~ ✅ done (Wave 21 — `PR423 LIVE`).
- **`fix/nppes-source-health-observability`** — Wave D's task 1 + task 3 bundled; first coding wave after the cascade.
- **Web `/api/health` `backend.status: "degraded"` investigation** — likely-truthful signal (composite of lane-connectivity, where OIG/PECOS/STATE_BOARD/FSMB/NURSYS are intentionally not-connected per PR #419 honest copy), but might be stale cache. Operator hypothesis from Wave 21: the web aggregator may flag "degraded" based on source-lane status rather than backend process health. Worth a code-side inspection of `apps/web/app/api/health/route.ts` (Claude Code, not Browser).
- **Operator: configure `CRON_SECRET`** — fixes the two failing scheduled workflows. Cosmetic but worth it.
- **`__tests__/` drift cleanup** (5–6 failing tests on `main` post-#422): `wave1-external-pilot-flow`, `status-page-compliance-evidence`, `foundation-sweep-6-analytics-status`, `foundation-sweep-6-commercial`, `passport-ingest-page`, `review-page-contract`. Not new; surfaced by PR #422 making Vitest finally reachable in CI. Worth opening a triage wave.

## Ledger maintenance rule

Append one row per wave at the end of the current batch's table. Open a new `## Batch` section when starting a new batch. Never edit historical rows; if a fact changes (e.g. a deploy is later validated), append a new row.
