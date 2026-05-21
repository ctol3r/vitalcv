# Materialization Boundaries

Binding rule for what a future wave is allowed to reference. The rule
exists because session-level wave generation tends to drift into
conceptual references that have no executable form on disk; the
verifier in `scripts/verify-wave-materialization.ts` cannot detect
truth where there is nothing to check.

## The rule

A future wave -- including any new PR body, audit note, session
brief, or doc on `origin/main` -- MAY ONLY reference:

| Allowed reference state | Meaning |
|---|---|
| `materialized` | The named entity (branch, PR, route, file) exists in the repo today |
| `auditable` | The named entity has a verification path: a script, a test, a doc row in `canonical-wave-registry.md`, or a `gh pr view N` lookup that resolves |
| `topology-real` | The named entity is a real git ref (branch / tag / commit SHA) -- not a placeholder name |

A reference that does not satisfy at least one of the three is
**conceptual-only** and MUST NOT appear on `origin/main`. The
verifier reports such references as drift; the wave that introduced
them is rejected at Codex audit.

## What this rule explicitly forbids

- "future PR #999" references when no PR #999 exists
- "the X wave landed" claims when no branch / PR exists
- "after the Y refactor we will..." claims when Y is not in the
  canonical wave registry
- "see the Z verifier" references when no `scripts/verify-Z.ts`
  exists
- "the route /a/b/c surfaces this" claims when no `apps/web/app/a/b/c`
  path exists
- audit-target references to docs that have not been written

## What this rule explicitly allows

- references to merged PRs by number (`gh pr view` resolves)
- references to open PRs by number that appear in the canonical
  registry
- references to branches that `git ls-remote origin` resolves
- references to routes whose path resolves under `apps/web/app/`
- references to scripts whose path resolves under `scripts/`
- references to docs whose path resolves under `docs/`
- references to a wave that exists as a row in
  `docs/ops/canonical-wave-registry.md` even if its lifecycle is
  `conceptualized` -- because the registry row is itself a
  materialized reference

## How a wave passes the rule

A wave that wants to reference a not-yet-merged entity has two
options:

**Option 1** -- the entity is in flight (branch + PR exist).
Reference it by branch name + PR number. The verifier resolves it.

**Option 2** -- the entity is not yet in flight. Add a row to
`docs/ops/canonical-wave-registry.md` with lifecycle
`conceptualized`. The wave then references the entity via the
registry row, not directly.

A wave that does neither and ships a conceptual reference is a
regression. The verifier in
`scripts/verify-wave-materialization.ts` fails the build for that
state, and the truth-audit test in
`apps/web/__tests__/reality-synchronization.test.ts` blocks it from
shipping.

## Doctrine boundary

This doctrine governs **references**, not implementation. It does
not require every wave to merge before being referenced. It only
requires that every reference point at something that exists today:
a branch, a PR, a file, or a registry row. The shape of the entity
may still be in flight; the reference itself must be real.

The doctrine is intentionally narrow. It does NOT:

- limit the size of waves
- require any particular branching topology
- mandate a CI gate (the verifier is a local script, not a CI step)
- introduce a new approval flow
- expand the protocol or governance surface

It exists for one purpose: make sure that what a wave claims exists
actually does exist when a future operator or Codex audit goes to
verify it.
