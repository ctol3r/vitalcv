# Branch cleanup manifest — 2026-08-02

Generated for PR B (B3). **Nothing is deleted by this document.** An UNKNOWN
branch is never a delete candidate — the directive is explicit, and the
worktree fleet means a branch with no PR may still be checked out and
load-bearing somewhere.

Total remote branches: 881

| Branch | Program area | Merged into main | Open PR | Classification |
| --- | --- | --- | --- | --- |
| `chore/home-evidence-v2-convergence` | home-evidence | no | yes | OPEN PR |
| `chore/home-evidence-v2-evidence-matrices` | home-evidence | no | no | UNKNOWN |
| `chore/home-evidence-v2-release` | home-evidence | no | no | UNKNOWN |
| `docs/home-evidence-v2-reference-analysis` | home-evidence | no | no | UNKNOWN |
| `feat/home-evidence-v2-foundation` | home-evidence | no | no | UNKNOWN |
| `feat/home-evidence-v2-input` | home-evidence | no | no | UNKNOWN |
| `feat/home-evidence-v2-journey` | home-evidence | no | no | UNKNOWN |
| `feat/home-evidence-v2-journey-d2` | home-evidence | no | no | UNKNOWN |
| `feat/e0-source-runtime-truth` | source-runtime | no | no | UNKNOWN |
| `fix/e0-source-runtime-public` | source-runtime | no | no | UNKNOWN |
| `feat/crs-licensure-cap` | licensure | no | yes | OPEN PR |
| `feat/crs-licensure-cap-rim` | licensure | no | yes | OPEN PR |
| `feat/profile-state-licensure` | licensure | no | no | UNKNOWN |
| `fix/matcha-licensure-claims` | licensure | no | no | UNKNOWN |
| `fix/matcha-remote-licensure` | licensure | no | no | UNKNOWN |
| `codex/add-apply-to-job-backend-route` | apply | no | no | UNKNOWN |
| `feat/apply-intent-phase2` | apply | no | yes | OPEN PR |
| `feat/apply-with-vcv` | apply | yes | no | MERGED |
| `feature/apply-widget-sdk` | apply | no | no | UNKNOWN |
| `feature/apply-with-vcv-core-loop` | apply | no | no | UNKNOWN |
| `wave-b-apply-widget` | apply | no | no | UNKNOWN |
| `wave-w2/pr46a-apply-with-vcv` | apply | no | yes | OPEN PR |
| `wave0-cache-canonicality` | wave0 | no | no | UNKNOWN |
| `wave0/auth-build-env` | wave0 | no | no | UNKNOWN |
| `wave0/railway-canonical` | wave0 | no | no | UNKNOWN |
| `wave0/session-cache` | wave0 | no | no | UNKNOWN |
| `wave0/static-marketing-restore` | wave0 | no | no | UNKNOWN |
| `wave0/w02-lane-truth-single-source` | wave0 | no | no | UNKNOWN |
| `wave0/w03-kill-fabricated-employer-data` | wave0 | no | no | UNKNOWN |
| `wave0/w04-robots-shadow` | wave0 | no | no | UNKNOWN |
| `codex/add-matcha-ui-integration-to-dashboard` | matcha | no | no | UNKNOWN |
| `codex/implement-matcha-api-logic` | matcha | no | no | UNKNOWN |
| `design/matcha-prefs` | matcha | no | no | UNKNOWN |
| `feat/matcha-deck-j1` | matcha | no | no | UNKNOWN |
| `feat/matcha-deck-j2` | matcha | no | no | UNKNOWN |
| `feat/matcha-deck-j3` | matcha | no | no | UNKNOWN |
| `feat/matcha-deck-j4` | matcha | no | no | UNKNOWN |
| `feat/matcha-deck-j5b` | matcha | no | no | UNKNOWN |
| `feat/career-evidence-graph` | career-evidence | no | no | UNKNOWN |
| `feat/career-evidence-stack` | career-evidence | no | no | UNKNOWN |
| `wave/career-evidence-network-alignment` | career-evidence | no | no | UNKNOWN |
| `chore/wave-skill-design-removal` | design | no | no | UNKNOWN |
| `chore/wave-skill-remove-claude-design` | design | no | no | UNKNOWN |
| `ci/design-lint-required` | design | no | no | UNKNOWN |
| `design-system/v2-foundation` | design | yes | no | MERGED |
| `design/cd-w1-lock-and-visible` | design | no | no | UNKNOWN |
| `design/cd-w1-typography` | design | no | no | UNKNOWN |
| `design/cd-w2-paper-ink-accent` | design | no | no | UNKNOWN |
| `design/claude-handoff-ingestion` | design | no | no | UNKNOWN |

## Summary

| Classification | Count (sampled) |
| --- | --- |
| MERGED | 2 |
| OPEN PR | 5 |
| UNKNOWN | 43 |

Sampled at 8 branches per program area, out of 881 remote branches total.

## Why nothing is proposed for deletion

**UNKNOWN is not a synonym for stale.** A branch is UNKNOWN here when it is
neither an ancestor of `main` nor attached to an open PR. That is exactly the
state of a branch whose work was squash-merged — the original SHA stops being an
ancestor, so squash-merged branches classify as UNKNOWN alongside genuinely
abandoned ones. This manifest cannot tell them apart, and guessing would delete
real work.

Both PR #998 and #1002 are in this category right now: merged into `main` by
squash, with their branch tips no longer ancestors of it.

A safe-delete decision needs, per branch: a clean worktree, a named branch, and
confirmation the work landed under a different SHA. That is a per-branch review,
not a pattern sweep, and it is not attempted here.

## Recorded for the convergence wave

`docs/audits/VITALCV_CURRENT_STATE_2026-08-02.md` §8 lists the six unreachable
scroll-owner components living in retired `film` / `rail` / `w1501` trees. Those
are dead *code* inside `main`, which is a different and more tractable problem
than dead *branches*.
