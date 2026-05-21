# Merge-Readiness Checklist

Minimal checks before `gh pr merge --rebase <pr>`. Six items. Six.
Anything beyond this is process theater.

## The six

- [ ] **Branch materially exists.** `git rev-list --count origin/main..<branch>` ≥ 1.
- [ ] **Codex audited.** Three SAFE verdicts recorded on (a) implementation, (b) diff, (c) commit-message copy.
- [ ] **Stack dependencies satisfied.** If the branch is stacked, its declared base is already merged (or is being merged in the same session).
- [ ] **No semantic inflation.** `pnpm verify:operational-health` exits 0; no banned cross-stack claims in the PR body.
- [ ] **Repo-health passes.** Same `verify:operational-health` command surfaces lockfile + tsc + lint + uncommitted-changes state.
- [ ] **Merge ancestry coherent.** `pnpm verify:stack` shows no ancestry mismatch or empty-diff for this branch.

## Operator script

```
# 1. Pick a branch:
BRANCH=feat/institutional-trust-primitives

# 2. Verify health:
pnpm verify:operational-health

# 3. Generate Codex context:
pnpm generate:codex-context "$BRANCH" > /tmp/codex-context.md

# 4. Paste /tmp/codex-context.md into Codex + run three audits:
#     codex exec audit implementation
#     codex exec audit diff
#     codex exec audit copy

# 5. When all three SAFE → merge:
gh pr merge --rebase "$BRANCH"
```

## What is NOT on this checklist (intentionally)

- Detailed change-log entry
- Cross-functional sign-off
- "Ship-team retrospective"
- Story-pointing
- Velocity tracking
- Burn-down updates

If a PR needs more than the six checks above, the PR is too large.
Split it into smaller waves and run the six checks per wave.

## Override

If you must merge with one of the six failed, write the override in
the PR body:

```
Codex audit policy: override <clause-N>
Reason: <one sentence>
```

Codex notes the override; the merge proceeds. The override is logged
in the PR audit trail.
