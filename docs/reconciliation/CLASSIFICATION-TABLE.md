# External Directory Classification Table
**Audit Date:** 2026-04-22
**Based on:** git worktree list, prior audit 2026-04-20, Cowork recon 2026-04-22

---

## Classification Key

| Code | Meaning | Action |
|---|---|---|
| `GIT_WORKTREE` | Registered git worktree of canonical repo | `git worktree remove <path>` — NOT mv/rm |
| `INDEPENDENT_REPO` | Separate git repo with different remote | Leave in place |
| `LEGACY_DUMP` | Pre-monorepo files, no git, likely superseded | Review → archive |
| `PYTHON_ENV` | Python virtualenv | Never move; delete if unused |
| `UNKNOWN` | Needs human review before action |

---

## Named Worktrees (35 directories in ~/christoler/)

All 35 are registered worktrees of `~/christoler/vitalcv`. All marked `prunable` by git.

| Directory | Branch | Commit | Classification | Action |
|---|---|---|---|---|
| `vitalcv-autonomous-execution` | `feat/autonomous-execution-engine` | `0eec323e` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-ci-lane-stability` | `chore/ci-lane-stability` | `d97180aa` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-consolidation-2` | `main-stable` | `d1c68dec` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-continuous-verification` | `feature/continuous-verification` | `a33c25d1` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-control-plane` | `feat/control-plane-intelligence` | `2bed9a01` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-conversion-distribution` | `feat/conversion-distribution` | `920ae1a2` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-decision-engine` | `feat/decision-engine-trustgraph` | `40fbbd39` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-defensibility-moat` | `feat/defensibility-moat-engine` | `ea6f137b` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-distribution-integration` | `feat/distribution-integration` | `c79b3394` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-engineering-discipline` | `feat/engineering-discipline` | `0eec323e` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-engineering-discipline-2` | `feat/engineering-discipline-v2` | `2f735861` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-gtm-revenue` | `feat/gtm-revenue-machine` | `5409b1ea` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-hybrid-loader` | `feat/hybrid-loader` | `bfaf0c4c` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-market-domination` | `feat/market-domination-loop` | `e67f2364` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-marketplace` | `feat/wave-marketplace` | `148ee3ff` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-network-effect` | `feat/network-effect-engine` | `9e75cfea` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-omega4f-trigger` | `main` | `f063804d` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-passport` | `feat/wave-passport` | `bf1a6a29` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-pilot-intake-clean` | `feature/pilot-intake-clean` | `848a6b4c` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-pilot-launch-workspace` | `(detached HEAD)` | `cebe08bb` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-pr85-verify` | `feat/employer-context-share-hardening` | `0ae2ef5e` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-pr87-verify` | `pr-87-verify` | `0c468c1b` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-revenue-conversion` | `feature/source-spine-decision-grade-main` | `50df3690` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-runtime-stability` | `fix/runtime-stability` | `0eec323e` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-security-hardening` | `fix/deploy-build-pass` | `53e070d6` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-system-1` | `feature/wave-interaction-layer-adaptation` | `388f9ff4` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-system-closure` | `feat/system-closure-pilot` | `0eec323e` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-time-to-start-engine` | `feat/time-to-start-engine` | `a5004d05` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-trustgraph-explorer` | `feat/trustgraph-explorer` | `e51c9204` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-usage-activation` | `feat/real-usage-activation` | `532c4719` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-wallet` | `feat/wave-wallet` | `4fd06617` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-wave13` | `fix/conversion-unblock` | `f5af9623` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-wave14` | `feature/wave16-claim-evidence-explorer` | `1bedd7c1` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-wedge-truth` | `fix/wedge-truth-continuity` | `0eec323e` | `GIT_WORKTREE` | `git worktree remove` |
| `vitalcv-widget` | `feat/wave-widget` | `1fd0a24b` | `GIT_WORKTREE` | `git worktree remove` |

---

## Codex Agent Worktrees (36 in ~/.codex/worktrees/)

All 36 are detached HEAD worktrees created by Codex agent runs. All prunable.

| Pattern | Count | Classification | Action |
|---|---|---|---|
| `~/.codex/worktrees/*/vitalcv` | 36 | `GIT_WORKTREE` (Codex-generated) | `git worktree prune` removes stale ones; `git worktree remove` for active |

**Note:** These accumulate automatically on each Codex task. Safe to prune once tasks are confirmed merged.

---

## /tmp Worktrees (3)

| Directory | Branch | Classification | Action |
|---|---|---|---|
| `/private/tmp/vitalcv-pr157` | `feat/acceptance-graph-learning-clean` | `GIT_WORKTREE` | `git worktree remove` |
| `/private/tmp/vitalcv-wave0-foundation` | `feature/manifest-wave4-marketplace` | `GIT_WORKTREE` | `git worktree remove` |
| `/private/tmp/wcp-qa` | `warranty-clean-pr` | `GIT_WORKTREE` | `git worktree remove` |

---

## Hidden Internal Worktrees (4 in .worktrees/ and .claude/worktrees/)

| Path | Branch | Classification | Action |
|---|---|---|---|
| `.claude/worktrees/dreamy-goodall-30de59` | `claude/dreamy-goodall-30de59` | `GIT_WORKTREE` (Claude-generated) | `git worktree remove` |
| `.worktrees/pilot-kpi-proof-pack` | `feature/pilot-kpi-proof-pack` | `GIT_WORKTREE` | `git worktree remove` |
| `.worktrees/pilot-launch-workspace` | `feature/pilot-launch-workspace` | `GIT_WORKTREE` | `git worktree remove` |
| `.worktrees/source-spine-decision-grade` | `feature/source-spine-decision-grade` | `GIT_WORKTREE` | `git worktree remove` |
| `.worktrees/wave1-truth-engine` | `feat/wave1-truth-engine` | `GIT_WORKTREE` | `git worktree remove` |

---

## Non-Worktree External Items

| Directory/File | Classification | Reason | Action |
|---|---|---|---|
| `vitalcv-backend/` | `LEGACY_DUMP` | No git; BATCH_xxx implementation docs. Pre-monorepo backend dump. | Review → archive to `_archive/` |
| `vitalcv-venv/` | `PYTHON_ENV` | Python virtualenv (`pyvenv.cfg` present) | Never move; delete if unused |
| `vitalcv-ai-sandbox/` | `INDEPENDENT_REPO` | Has independent `.git`, remote unknown | Leave in place |
| `backend/` (1.1 GB) | `LEGACY_DUMP` | Massive pre-monorepo backend dump with BATCH_200+ series docs and node_modules | Review → archive to `_archive/pre-monorepo/` |
| `substrate/` | `LEGACY_DUMP` | Substrate scaffolding (`node-example/`, `pallets/`, `runtime-example/`) — possible version of `blockchain/substrate/` | Diff vs canonical; then archive |
| `claw-code/` | `INDEPENDENT_REPO` | Rust-based CLAW agent (own CLAW.md, rust/, src/) — separate project | Leave in place |
| `chai-vc-platform/` | `INDEPENDENT_REPO` | GitHub remote: `ctol3r/chai-vc-platform` — separate repo | Leave in place |
| `v0-vital-cv-frontend-mvp/` | `INDEPENDENT_REPO` | GitHub remote: `ctol3r/v0-vital-cv-frontend-mvp` — separate repo | Leave in place |
| `VITALCV-CONSOLIDATION-AUDIT-2026-04-20.md` | `LEGACY_DUMP` (loose file) | Prior audit — should be in `vitalcv/docs/reconciliation/` | Copy into repo → original can be left |
| `_trash-2026-04-20/` | `LEGACY_DUMP` | Files moved during prior consolidation | Confirm contents, then safe to delete with user approval |
