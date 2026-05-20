# Implementation Reality Contract

A wave is **not considered real** unless every clause below is true.

Codex audits MUST verify this contract before issuing a SAFE verdict.

## Mandatory clauses

| Clause | How to verify |
|---|---|
| **1. Branch exists** | `git rev-parse --verify <branch>` exits 0 |
| **2. Tracked diff exists** | `git diff --stat origin/main..<branch>` is non-empty |
| **3. PR exists or branch explicitly local-only** | `gh pr view <branch>` returns a PR URL, OR the PR description / commit message explicitly states "LOCAL-ONLY" |
| **4. Lockfile integrity** | `pnpm-lock.yaml` is committed; `git status --porcelain pnpm-lock.yaml` is empty after `pnpm install --frozen-lockfile` |
| **5. tsc executable exists** | Either `<repo>/node_modules/.bin/tsc` or `apps/web/node_modules/.bin/tsc` exists. Use `pnpm --filter @vitalcv/web typecheck` to invoke. |
| **6. Codex can audit actual implementation** | New code files referenced in the commit message + PR body exist at the paths claimed |
| **7. Worktree clean** | `git status --porcelain` is empty |
| **8. Implementation materially present** | At least one non-doc file changed in `apps/` or `packages/`, OR the PR is explicitly tagged `docs-only` |

## Sub-clauses

### Tracked diff exists (clause 2)

An "empty-diff" branch is one with zero commits ahead of `origin/main`.
The `verify:reality` script flags these as `WARN`. A wave PR
MUST have at least one commit.

### Implementation materially present (clause 8)

The wave's implementation must materialize as new or modified code
files. Docs-only changes are valid only if the PR title starts with
`docs:` or `fix(docs):`. Otherwise a non-doc file change is required.

The single exception: governance / docs-only waves that produce
verification tooling (this wave, for instance) count as material when
they add `scripts/` or `*.ts` runnable artefacts.

## Audit protocol

Before requesting Codex SAFE verdict:

```
pnpm verify:codex-ready
```

Exits 0 when all clauses pass. Exits non-zero with a human-readable
list of failures otherwise.

## Anti-patterns

- A PR description that claims "implemented X" when X is only a
  docstring or markdown reference.
- A PR that references an evidence path that does not exist in the
  diff.
- A worktree that is "ready" because the operator typed `npm test`
  in a shell — without re-running the same commands inside the
  worktree.

Codex MUST run the listed verification commands inside the worktree
itself before issuing SAFE. The operator's prior local run is
suggestive, not authoritative.
