# Wave Batch Template

The canonical shape for one wave batch. Copy this file at the start of every batch, fill in tasks 1–N (up to 20), and append the report at the end. See `docs/ops/agent-operating-sop.md` for the doctrine that binds this template.

## Batch header

```
Wave Batch <N> — <theme>
Date: <YYYY-MM-DD HH:MM PDT (San Jose / Pacific)>
Operator: <name>
Mode: <money | design | backend | pilot> (default if mixed)
`main` head at batch start: <SHA>
```

## Task table (1–20 rows max)

| # | Mission | Branch | Mode | Depends on | Status |
|--:|---|---|---|---|---|
| 1 | <one sentence; one branch's worth of work> | `feat\|docs\|fix\|chore/<slug>` | 🎨\|🧱\|🔐\|💰\|🚀 | — or task N | 🟡 in progress / ✅ done / 🔴 blocked |
| 2 | … | … | … | task 1 | … |
| … | … | … | … | … | … |
| 20 | … | … | … | … | … |

Rules (from §2 of the SOP):

- **20 max.** If exceeded, split into batch N + 1.
- **One mission per row.** No "and then also". Split.
- **One branch per row.** Multiple commits OK; multiple branches not OK.
- **Independent rows ship in parallel.** Mark `Depends on:` only when literal dependency exists.

## Per-task audit checklist

Run this before merging any task's PR. Every box must be checked (or explicitly N/A with a reason).

### Diff scope
- [ ] Diff matches the mission scope (no surprise files).
- [ ] No backend files touched in design / docs / money modes.
- [ ] No `apps/api/backend/**` touched in design / money / pilot modes.
- [ ] No `apps/web/middleware.ts`, no Clerk config, no auth-flow code in design / docs / money modes.
- [ ] No `railway.toml`, `Dockerfile`, `.env*`, `pnpm-lock.yaml` (unless explicitly approved).
- [ ] No `prisma/schema.prisma` change.
- [ ] No new env-var or secret usage.

### Truth contract
- [ ] No bare "Verified" status label anywhere user-facing.
- [ ] No "HIPAA compliant" / "SOC2 certified" / "NCQA certified" / "Get verified".
- [ ] No "instant credentialing" / "complete credentialing" / "guaranteed verification" / "automatically verified" / "legally accepted" / "risk transferred" / "final verification without review".
- [ ] No false source promotion: NPPES `source-backed` only when the four-field gate is met; OIG / LEIE / PECOS / STATE_BOARD / FSMB / NURSYS stay `connector-not-live` until their adapters land.
- [ ] No skeleton-style loaders on terminal degraded states.

### Validation
- [ ] `pnpm install --frozen-lockfile` — lockfile unchanged.
- [ ] `pnpm turbo run build --filter <package>` — green.
- [ ] `pnpm --filter <package> exec tsc --noEmit` — clean (run after turbo populates dist if cross-package).
- [ ] `pnpm lint` — green (only pre-existing warnings allowed).
- [ ] Focused vitest run — green; any pre-existing failures explicitly classified as drift, not regression.

### Banned-copy scan
- [ ] `rg -g '*.tsx' -g '*.ts' -in "Verified|verified|cleared|approved|accepted everywhere|complete credentialing|instant credentialing|HIPAA compliant|SOC2 certified|NCQA certified|guaranteed verification|Get verified|risk transferred"` against the diff scope. Every hit is in: (a) `_archive/` (dead route — sweep later), (b) a banned-list documentation block, (c) a negative-example / "avoid" section in docs, or (d) a test assertion that the phrase is NOT present.

### Merge simulation
- [ ] `git merge --no-commit --no-ff <branch>` against `origin/main` — clean. If conflicts, return **UNSAFE** and stop.

### Deploy / runtime
- [ ] If touching API code: `delightful-essence` will auto-redeploy. Note the expected new SHA in the PR body.
- [ ] If touching web code: `vitalcv-web` redeploy expected. Note any visible-route impact.
- [ ] If neither: explicitly note "no deploy impact" in the PR body.

## Per-task verdict

Verdicts use the same five-class taxonomy as the SSE-smoke runbook:

| Verdict | Meaning | Action |
|---|---|---|
| **SAFE** | All checklist items pass; merge sim clean; no truth-contract or constraint violation. | Merge via `gh pr merge <N> --squash --delete-branch=false`. |
| **UNSAFE — TRUTH-STATE** | Banned phrase, false promotion, or contradiction surfaced. | Stop. Do not merge. Author fix on the branch. |
| **UNSAFE — SCOPE** | Diff exceeds mission scope. | Stop. Split the PR or trim the diff. |
| **UNSAFE — VALIDATION** | Build / tsc / lint / test failure caused by this PR. | Stop. Fix and re-run. |
| **UNSAFE — CONFLICT** | Merge sim has conflicts against `main`. | Stop. Rebase the branch; re-audit on rebased head. |

The agent **never** bypasses an UNSAFE verdict. The operator may override on explicit acknowledgement of risk, but the override must be recorded in `docs/ops/merge-ledger.md` with the specific risk language used.

## Per-task report shape

```
## Task <N> — <title> — <verdict>

Timestamp: <YYYY-MM-DD HH:MM PDT>
Branch: <branch>
Head SHA: <SHA>
PR: #<num>
Mode: <emoji + name>

Files inspected (<count>):
- <file>: <one-line inspection note>

Conflict result: <clean | conflicts list>
Truth-contract result: <pass | concrete failure>
Banned-copy scan: <clean | classified hits>
Tests: <X/Y pass>
Build: <Tasks: X successful, Y total>
Lint: <green | warnings list>
tsc: <clean | concrete error list>
Merge recommendation: <Merge | Stop>
```

## Batch close

At the end of a batch, append to the batch file:

```
## Batch close

Timestamp: <YYYY-MM-DD HH:MM PDT>
`main` head at batch close: <SHA>
Tasks shipped: <list of merged PRs + SHAs>
Tasks deferred: <list with reasons>
Completion-board moves: <list of (dimension, before → after, reason)>
Carry-overs to next batch: <list>

### Next Direction
A) <option A>
B) <option B>
C) <option C>
D) <option D>
E) Continue to next task / next wave batch.
```

Then update `docs/ops/wave-ledger.md` with one row per task and `docs/ops/merge-ledger.md` with one section per merged PR. Both ledgers' update conventions are documented in their own files.

## Example: minimal 3-task batch

```
Wave Batch 4 — visual-system foundation
Date: 2026-05-26 22:00 PDT
Operator: ct
Mode: 🎨 design
main head at batch start: 801100c7f

| # | Mission                                | Branch                           | Mode | Depends | Status |
|--:|---|---|---|---|---|
| 1 | TruthStateChip + Legend + tests + docs | feat/truth-state-chip            | 🎨   | —       | ✅ |
| 2 | 6 design-system docs                   | docs/design-system-foundation    | 🎨   | task 1  | ✅ |
| 3 | Tracking-ledger update                 | docs/wave-batch-tracking         | 🤖   | task 2  | ✅ |

Batch close

Timestamp: 2026-05-26 22:26 PDT
main head at batch close: 50942ad1e
Tasks shipped: #425 a368a1ffb, #426 a88e014e4, #424 50942ad1e
Tasks deferred: Wave H Passport (next batch — dedicated coding turn)
Completion-board moves:
- Frontend UX / Role Journeys: 35% / 24 → 37% / 22 (PR #425 + #426 merged/tested)
- Trust / Proof / Receipts: 32% / 27 → 33% / 26 (PR #425)
- Testing / CI / Quality Gates: 31% / 26 → 32% / 25 (19 new chip regression tests)
- Interoperability / Standards: 26% / 34 → 27% / 33 (docs implementation-ready)
- Overall: 27% / 392 → 28% / 388

Next Direction
A) Wave H — Passport calm-degradation integration (now unblocked by #425/#426).
B) Authenticated SSE smoke for NPI 1699264564 (operator-only; gates Product Truth Contract → "validated live").
C) `fix/nppes-source-health-observability` — observability moat (Wave D's task 1 + task 3 bundle).
D) Operator: configure `CRON_SECRET` repo secret to fix the failing scheduled health-probe workflows.
E) Continue to next task / next wave batch.
```
