# M0-4 — Worktree & Branch Inventory / Triage

**Date:** 2026-07-06
**Scope:** 79 worktrees, 823 local branches, 556 remote branches.

## ⚠️ Deletion is owner-gated

`CLAUDE.md` states the worktree fleet is **load-bearing** — the Codex verifier
fleet (`~/.codex/worktrees/*`) and dozens of feature trees are referenced by
other tooling: **"Do not remove worktrees you didn't create — they are
load-bearing."** This inventory therefore *recommends* disposition; it does not
delete. Execute prune commands manually after confirming nothing depends on a
tree.

## Worktrees by location (79 total)

| Location | Count | Nature | Recommended disposition |
|---|---|---|---|
| `~/vitalcv-*` | 35 | Feature trees | Owner review; prune ones whose branch is merged to `origin/main` |
| `/private/tmp/*` | 21 | Session / CI scratch (this + prior Claude sessions) | Safe to prune once sessions end; ephemeral by design |
| `~/vitalcv/.claude/worktrees/*` | 13 | Agent worktrees | Managed by harness; leave to harness lifecycle |
| `~/.codex/worktrees/*` | 5 | **Codex verifier fleet** | **Do not touch** — load-bearing |
| `~/vitalcv/.worktrees/*` | 4 | Agent worktrees | Managed by harness |
| `~/vitalcv` | 1 | Main checkout (this repo) | Keep |

- **3 worktrees are `prunable`** by git's own judgement (working dir gone). These
  are the only safe automatic candidates:
  ```bash
  git worktree prune -v      # removes admin entries for already-deleted dirs
  ```

## Branches

| Category | Count | Disposition |
|---|---|---|
| Local, merged into `origin/main` | 215 | Safe to delete (excludes `main` + active wave branch) |
| Local, unmerged | 608 | Keep pending per-branch review; likely mostly stale |
| Remote branches | 556 | GitHub-side cleanup; delete remote branches whose PRs are merged/closed |

### Suggested prune (merged local branches only — run manually after review)

```bash
# Preview
git branch --merged origin/main | sed 's/^[* ]*//' \
  | grep -vE '^(main|wave/career-evidence-network-alignment)$'
# Delete (215 branches) — ONLY after confirming none are checked out in a worktree
git branch --merged origin/main | sed 's/^[* ]*//' \
  | grep -vE '^(main|wave/career-evidence-network-alignment)$' \
  | xargs -r -n1 git branch -d
```
> Note: a branch checked out in a worktree cannot be `-d` deleted (git refuses),
> which is a built-in safety net against removing a load-bearing tree's branch.

## Why not automate now

Automating deletion across 823 branches / 79 trees risks removing a tree the
Codex fleet or an in-flight agent session depends on. The high-leverage,
zero-risk action (`git worktree prune`) reclaims only the 3 already-dead entries.
Bulk branch pruning is a one-command owner action documented above.
