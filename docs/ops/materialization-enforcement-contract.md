# Materialization Enforcement Contract

Binding contract for what a wave is allowed to reference. Stricter
sibling of `docs/ops/materialization-boundaries.md` (when merged):
where that doctrine governs intent, this contract governs
enforcement. The verifier
`scripts/verify-materialization-enforcement.ts` is the mechanism;
this document is the rule.

## The contract

A wave's text, code, commit messages, and PR body MAY ONLY reference:

| State | Definition | Verifier check |
|---|---|---|
| `committed` | A real commit on a real branch | `git rev-list --count origin/main..origin/<branch>` >= 1 |
| `materialized` | A real file on disk in this checkout | `existsSync(path)` |
| `topology-real` | A real git ref (branch / tag / commit SHA) | `git rev-parse --verify <ref>` succeeds |
| `auditable` | A real PR with a state lookup, OR a row in `docs/ops/repo-reality-state.md` | `gh pr view <N>` succeeds OR row resolves |

A reference that satisfies NONE of the four is **speculative** and
MUST be removed from the wave before merge. The verifier reports
speculative references as `FAIL` entries; the wave that introduced
them is rejected at Codex audit.

## What this rule explicitly forbids

The verifier scans the repo (default scope: `docs/**`, `scripts/**`,
PR body of the current branch's head PR) for:

1. **Future PR references**. A claim like "see PR #999" where
   `gh pr view 999` does not resolve is rejected.
2. **Future branch references**. A claim like
   "the `feat/x` branch ships ..." where `feat/x` does not exist on
   origin is rejected.
3. **Empty-diff branches**. A claim like "wave X is implemented"
   where `git rev-list --count origin/main..origin/<branch>` returns
   0 is rejected.
4. **Orphaned audit targets**. A claim like
   "audit target: `docs/ops/X.md`" where the file does not exist on
   the wave's branch is rejected.
5. **Phantom routes**. A claim like
   "/a/b/c renders ..." where `apps/web/app/a/b/c/page.tsx` does not
   exist is rejected.

## What this rule explicitly allows

- references to merged PRs by number (`gh pr view` resolves)
- references to open PRs by number that resolve via `gh pr view`
- references to branches that `git ls-remote origin` resolves AND
  have at least one commit ahead of origin/main
- references to files whose path resolves under the repo root
- references to a row in `docs/ops/repo-reality-state.md` (the row
  itself is the materialized reference; if the row has lifecycle
  `conceptual`, the reference is allowed but flagged NOTE in the
  verifier output)

## How to satisfy the contract

A wave that needs to forward-reference something has three options:

**Option 1** — the entity is in flight. The branch exists on origin,
the PR is open, the audit target file is on disk. The verifier
resolves it.

**Option 2** — the entity is not yet in flight. Add a row to the
**Conceptual table** in `docs/ops/repo-reality-state.md`. The wave
then references the entity via the row, not directly.

**Option 3** — the entity is merged. The merged PR resolves via
`gh pr view`; no additional state is required.

A wave that does NONE of these and ships a forward reference is a
regression. The verifier blocks it.

## Boundary: enforcement vs governance

This contract enforces **references**, not implementation. It does
not require any wave to merge before being referenced; it requires
that every reference point at something that exists today.

The contract intentionally does NOT:

- limit the size of waves
- mandate a CI step (the verifier is a local script)
- require any new approval flow
- expand the protocol or governance surface
- introduce new wave types or lifecycle states beyond the seven in
  `docs/ops/repo-reality-state.md`

It exists for one purpose: make every reference verifiable on the
spot.

## Compliance check sequence

The verifier runs in three sub-modes:

| Sub-mode | What it does |
|---|---|
| `enforce` | Default. Checks every row in `repo-reality-state.md` against branch existence, non-empty diff, and PR resolution. Exits non-zero on any FAIL. |
| `detect-speculative` | Scans `docs/**` (excluding `repo-reality-state.md` itself) for PR/branch references and verifies each. |
| `status` | Read-only summary: parsed row count, per-state counts, no exit-code escalation. |

Wave authors run `pnpm verify:materialization-enforcement` before
committing; CI / release operators run `pnpm verify:repo-reality`
before a merge sequence.

## Truth-contract integration

The truth-audit test in
`apps/web/__tests__/materialization-enforcement.test.ts` rejects any
of the following on touched files:

- `speculative pr`
- `imaginary branch`
- `fake materialization`
- `phantom route`
- `orphaned audit target` (as a positive claim)
- `we will ship` / `coming soon` / `roadmap pr`
- `guaranteed materialization`
- `pretend the branch exists`

These phrases are red flags for forward-leaning copy that does not
trace to a verifiable entity.
