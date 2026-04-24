# Prior Audit Summary
**Source:** `/Users/christoler/VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md`
**Audit Date:** 2026-04-20
**This Summary Written:** 2026-04-22

---

## What Was Audited

The prior audit performed a full scan of `~/christoler/` and identified all VitalCV-related
directories, loose files, and repositories. It produced a classification table and a
4-phase safe consolidation plan.

## Key Findings (2026-04-20)

### Critical Discovery: Worktrees, Not Clones
The most important finding was that all 35 `vitalcv-*` directories at `~/christoler/`
are **registered git worktrees** of the canonical repo — not independent clones.
Moving them with `mv` or `rm -rf` would corrupt `.git/worktrees/` metadata.
Correct removal: `git worktree remove <path>` or `git worktree prune`.

### Canonical Repo Confirmed
`~/christoler/vitalcv/` is definitively the canonical repo root. All key markers
were present: `pnpm-workspace.yaml`, `turbo.json`, primary `.git` directory.
Branch at time of audit: `feat/acceptance-graph-learning-clean`.

### Categories Identified

| Category | Items | Action |
|---|---|---|
| Git worktrees (35 dirs) | All `vitalcv-*` in `~/christoler/` | `git worktree prune` — NOT mv |
| Independent repos | `vitalcv-ai-sandbox/`, `v0-vital-cv-frontend-mvp/`, `chai-vc-platform/`, `claw-code/` | Leave in place |
| Legacy dumps (no git) | `backend/` (1.1 GB), `vitalcv-backend/`, `frontend/`, `substrate/`, `compliance/`, `__tests__/`, `scripts/`, `infra/trustgraph/`, `tasks/` | Review → archive |
| Python virtualenv | `vitalcv-venv/` | Do not move — delete locally if unused |
| Loose .md files (root) | 9 ROUND_*.md, BATCH_54, PILOT_P0 docs, etc. | Copy to `vitalcv/docs/archive/` |
| Ambiguous | `dev/`, `projects/` | Review — contain backups |

## What Actions Were Recommended

### Phase 1 — Safe archive (low risk)
Copy loose VitalCV status docs from `~/christoler/` root into `~/vitalcv/docs/archive/`.
Items: ROUND_*.md (9 files), BATCH_54_MANIFEST.md, PILOT_P0_*.md, cursor agent docs, psv_log.json.

### Phase 2 — Legacy folder archive (HIGH RISK — user decision needed)
Archive `backend/` (1.1 GB), `frontend/`, `substrate/`, `compliance/`, `__tests__/`,
`scripts/`, `infra/trustgraph/`, `tasks/`, `vitalcv-backend/`, `vitalcv-scripts/`
to `~/christoler/_archive/pre-monorepo/`.

### Phase 3 — Worktree cleanup
Run `git worktree prune` from `~/vitalcv/` to remove stale worktree references.
Manually `git worktree remove` for active-but-unused named worktrees.

### Phase 4 — Verify remaining items
Handle `projects/chai-vc-platform`, `projects/v0-vital-cv-frontend-mvp`, `dev/*.bak.*`.

## What Was Left Unresolved

- **No actual moves were executed.** The audit was classified as "NEEDS REVIEW — do not execute moves without sign-off."
- `backend/` (1.1 GB) — the largest risk item — was flagged for review but not touched.
- `substrate/` — not confirmed as identical to `vitalcv/blockchain/substrate/`.
- Loose root files — were identified but not copied into the repo.
- Worktrees — identified but not pruned.

## Open Risks (from prior audit)

1. `backend/` may contain BATCH-era implementation decisions not captured in the monorepo.
2. `substrate/` version drift vs `vitalcv/blockchain/substrate/` is unknown.
3. 35 worktrees are accumulating disk space and git metadata bloat.
4. Loose root-level `.md` files may be lost if `~/christoler/` is ever cleaned without this audit in hand.

## Changes Since 2026-04-20 (New Findings as of 2026-04-22)

- Main repo is now on branch `feature/apply-with-vcv-core-loop` (was `feat/acceptance-graph-learning-clean`)
- The root of `~/christoler/` now has ONLY ONE loose .md file: `VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md` itself — suggesting someone (or an agent) cleaned up the loose files already, or they were moved to `_trash-2026-04-20/`
- **38 Codex worktrees** discovered in `~/.codex/worktrees/` — all detached HEAD, all prunable — not present in prior audit (new accumulation from Codex agent runs)
- `apps/mobile/` is NOT empty (has files) — contradicts MASTER_PROMPT claim that it's empty
- `apps/router/` is missing `package.json` — minor gap
