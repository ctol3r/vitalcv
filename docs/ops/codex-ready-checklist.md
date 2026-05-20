# Codex-Ready Checklist

Run this checklist BEFORE requesting Codex audit on any wave PR.
If any item is `[ ]`, the PR is NOT ready.

## Quick gate

```
pnpm verify:codex-ready
```

This script combines clauses 1, 2, 4, 5, 7 of the implementation-
reality contract into a single deterministic check. Exits 0 on green;
exits non-zero with a human-readable list otherwise.

## Manual checklist

### Branch state

- [ ] Branch pushed to `origin/<branch>` (or branch explicitly local-only and PR description says so)
- [ ] PR exists at `https://github.com/ctol3r/vitalcv/pull/<num>` with title, body, and test plan
- [ ] No uncommitted changes (`git status --porcelain` empty)
- [ ] Branch is N commits ahead of `origin/main` with N ≥ 1

### Install + lockfile

- [ ] `pnpm install --frozen-lockfile` completes without errors
- [ ] `pnpm-lock.yaml` is committed (no `M pnpm-lock.yaml` in `git status`)
- [ ] No new workspace packages are untracked under `packages/`

### Build + type check

- [ ] `pnpm turbo run build --filter @vitalcv/trust-state` succeeds (workspace prebuild)
- [ ] `pnpm --filter @vitalcv/web typecheck` runs; only pre-existing errors remain
- [ ] `pnpm --filter @vitalcv/web lint` is clean
- [ ] Wave-specific vitest suite passes

### Files exist

- [ ] Every file path mentioned in the commit message exists in the diff
- [ ] Every "evidence reference" in the PR body resolves to a tracked file
- [ ] No `package.json` change without a corresponding `pnpm-lock.yaml` update

### Truth contract

- [ ] No banned-by-CLAUDE.md phrases introduced in touched files (rendered audit gate from PR #391 still passes)
- [ ] No `Verified` bare label introduced in any rendered surface
- [ ] No `fully verified`, `cryptographically guaranteed`, `instant verification`, etc.
- [ ] PR description does not claim "implemented X" when X is only documented

### Stacked PR hygiene (if applicable)

- [ ] Stacking note in PR body names the base branch + the PRs it depends on
- [ ] Recommended merge order updated in `docs/ops/repository-reality-audit.md` (or referenced)

### Operator handoff

- [ ] Final-report block at the end of the wave message states branch + SHA + PR URL
- [ ] Final-report ends with `READY FOR CODEX AUDIT` (not `NOT READY`)

## When this checklist is BLOCKED

If any item above is `[ ]`, do NOT request Codex audit. Either:

1. Resolve the blocker on the same branch (preferred), OR
2. Mark the PR as draft and document the blocker in the PR body, OR
3. Close the PR and open a follow-up wave to resolve the prerequisite

Do not request a SAFE verdict on a non-ready PR. The audit is a
gate, not a discussion.

## Override

A single override is permitted: the operator may state, in writing, in
the PR body, `Codex audit policy: override <clause-N>` with a reason.
This signals to Codex that the operator has reviewed and accepted the
exception. The override applies to that PR only and is logged in the
PR audit trail.
