# Agent-fleet coordination — 2026-08-02

Owner: platform ops · Snapshot taken against `origin/main` at `ed1f523b1`

Two agent fleets build this repository concurrently. This document records what
that costs today, what was contradictory in the governance files, and the rule
now written into [`AGENTS.md`](../../AGENTS.md) to stop the waste.

## Measured state

| Signal | Count |
|---|---|
| Open PRs | 243 |
| Git worktrees on this machine | 83 |
| `codex/*` branches on `origin` | 67 |
| Codex worktrees (`~/.codex/worktrees/*`) | 31 |
| Codex-authored PRs open and conflicted since 2026-07-29 | 3 (#968, #970, #971) |

## Finding 1 — the same directive gets built twice

The two lanes cannot see each other's work-in-progress, because a pushed branch
is invisible to the other lane's `gh pr list`. Three confirmed collisions:

| Intent | Claude lane | Codex lane | Outcome |
|---|---|---|---|
| Four P0 truth-containment fixes (directory, providers, passport identity, public `no-store`) | `fix/p0-*` → #989, #990, #991, #993 — all merged | `codex/p0-*` — four branches pushed 2026-07-29, **no PR ever opened** | Four builds wasted entirely |
| Public opportunities board | `wave/explore-board` → #999, merged | `codex/public-opportunity-board-r1` → #970, open and `DIRTY` | Two independent implementations of one board |
| Home hero eyebrow (glass chrome) | `fix/palantir-transparent-eyebrow` → #985, open, `DIRTY`, `check-design-lint` failing | `codex/home-expandable-eyebrow` → #1039, merged | Same surface from both lanes; #985 now conflicts with the merged result |

The P0 case is the clearest: `~/.codex/worktrees/codex-p0-*` were created
2026-07-29 05:54 and the equivalent Claude-lane branches merged as #989–#993.
The Codex work was complete enough to push and was then abandoned, unseen.

## Finding 2 — the governance files disagreed about Codex

Three checked-in files stated Codex's role three different ways:

| File | What it said | Status |
|---|---|---|
| `CLAUDE.md` (on `main`) | Optional surgical verifier, **not** a merge gate | Correct — settled 2026-07-25, #1000 |
| `.claude/skills/vitalcv-wave-execution/SKILL.md` (on `main`) | Optional verifier; "there is no merge-protection hook" | Correct |
| `docs/ops/agent-operating-sop.md` (on `main`) | Codex "**currently disabled** per operator instruction (account quota / cost)"; a "merge-protection hook expects a real audit verdict" | **Both claims false** — corrected in this change |

Codex is demonstrably active: 67 branches on `origin`, 31 local worktrees, three
open PRs, and a merged PR (#1039) from today. And no merge-protection hook
exists: there is no `.claude/settings.json` and no `.claude/hooks/` directory,
and the tracked `.claude/settings.local.json` defines no hooks. An instruction
that assumes a hook will catch a skipped gate is worse than no instruction,
because skipping is silent.

A fourth, non-`main` copy compounds this: the branch
`wave/career-evidence-network-alignment` still carries the pre-#1000 `SKILL.md`
that mandates a three-pass Codex audit "before any merge" and warns that
"subagent stand-ins do NOT satisfy the merge hook". A session started on that
branch loads retired doctrine as if current. **Governance files must be read
from `origin/main`, not from the checked-out branch.**

## The rule

Written into [`AGENTS.md`](../../AGENTS.md) and pointed to from the SOP:

1. **Claim-check the intent before building** — search open *and merged* PRs plus
   `git ls-remote origin` for the intent, not the branch name. A merged PR with
   your intent means stop.
2. **Diff the intent against `main` before opening a PR.** If `main` already has
   the behavior, the work is a no-op: abort and report rather than open a
   duplicate.
3. **A branch is not a claim until it is a PR.** Open a draft PR as soon as the
   work is real, so the other lane can see it.
4. **Re-triage stale PRs; never blind-rebase.** A PR that went `DIRTY` while
   `main` absorbed other merges may be superseded rather than merely conflicted.
   Classify every file LANDED / UNIQUE / CONFLICTED-STALE against current `main`.

## Why `AGENTS.md` did not exist before

Codex reads `AGENTS.md` from the repository root; Claude Code reads `CLAUDE.md`.
This repository had `CLAUDE.md` and no `AGENTS.md`, so the Codex lane ran on the
operator's global `~/.codex/AGENTS.md` — a 1,558-line product-doctrine file
dated 2026-07-16. It carries no build commands, no worktree caveat, no
knowledge of the merge gate settled on 2026-07-25, and no way to know what the
other lane has already shipped. The new root `AGENTS.md` states the same
operating rules as `CLAUDE.md` and adds the lane protocol above; the global file
remains the source for product doctrine.
