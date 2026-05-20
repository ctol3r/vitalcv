# Worktree Governance

Operator-facing rules for the VitalCV multi-worktree development model.

## Naming

| Naming pattern | Use |
|---|---|
| `/private/tmp/<branch-suffix>/` | Claude Code wave worktrees |
| `~/.codex/worktrees/<id>/` | Codex audit worktrees |
| `~/vitalcv-omega4f-trigger/` | operator's local `main` |
| `/private/tmp/vitalcv-<feature>/` | legacy feature trees |

A branch and its worktree directory MUST share a recognisable
identifier. Wave worktrees use the same string after the `feat/` or
`fix/` prefix as the directory name suffix.

## Lifecycle

1. **Create:** `git worktree add -b <branch> /private/tmp/<suffix> <base>`
2. **Work:** stay inside the worktree; never `cd` to a sibling.
3. **Push:** `git push -u origin <branch>` BEFORE asking for Codex audit.
4. **Merge:** via `gh pr merge` only after Codex SAFE verdict.
5. **Archive:** when the PR merges, the worktree may be removed via
   `git worktree remove /private/tmp/<suffix>` — the operator chooses.
6. **Prune:** stale worktrees (branch deleted, dir missing) are
   reclaimed by `git worktree prune`.

## Branch ownership

- **`feat/*`** — feature branches; one PR per branch
- **`fix/*`** — bug/integrity fixes; one PR per branch
- **`docs/*`** — documentation-only branches
- **`chore/*`** — operator hygiene; no product-feature changes
- **`wave/*`** — legacy long-running wave branches (frozen; do not create new)

A branch is **owned** by the agent that created it until the PR is
merged or closed. Other agents do not push to that branch without an
explicit hand-off.

## Merge sequencing

Stacked PRs MUST merge in dependency order:

1. Base PR lands first.
2. Stacked PRs rebase onto main, re-run validation, then merge.

This wave's recommended merge order is documented in
`docs/ops/repository-reality-audit.md`.

## Codex audit prerequisites

A worktree is "audit-ready" only when:

- branch is pushed to `origin/<branch>`
- working tree is clean (`git status --porcelain` is empty)
- PR exists or branch is explicitly local-only
- `pnpm install --frozen-lockfile` passes
- `pnpm --filter @vitalcv/web typecheck` passes (or only the 2 pre-existing `intake-types.ts` errors)
- `pnpm --filter @vitalcv/web lint` passes
- relevant vitest suite passes
- implementation files actually exist (not just docs)

Run `pnpm verify:codex-ready` before requesting Codex audit. If the
script exits non-zero, the worktree is NOT audit-ready.

## Worktree cleanup policy

The operator runs `git worktree prune` periodically (operator
decision). This script does NOT auto-prune — it reports prunable
worktrees and lets the operator decide.

Prunable worktrees are flagged by:

```
pnpm verify:worktrees
```

A worktree counted as prunable means either:

- the branch was deleted (`git branch -d <branch>`)
- the worktree directory was removed without `git worktree remove`

Either way, the entry in `.git/worktrees/` is stale and can be safely
pruned. The script never deletes anything — it only reports.

## Anti-patterns

- **NEVER** `git checkout main && git pull origin main` from the
  operator's local `main` worktree — local `main` is held by the
  worktree at `~/vitalcv-omega4f-trigger`. Use
  `git fetch origin main && git worktree add -b <feature> /private/tmp/<suffix> origin/main`.
- **NEVER** remove a worktree directory with `rm -rf` — always use
  `git worktree remove <path>` so the bookkeeping in `.git/worktrees/`
  is updated atomically.
- **NEVER** commit `pnpm install`'s build-script approvals (`pnpm
  approve-builds`) without the operator's review.
- **NEVER** force-push a branch that another agent is auditing.
