# Reality Boundaries

Three binding rules for institutional truth. These boundaries
distill the materialization-enforcement contract into operator-
readable form. A wave that respects all three passes the verifier
on the first run.

## Rule R1 · No future-wave references before materialization

A wave MUST NOT reference another wave that has not yet
materialized. "Materialized" here means **either**:

- the other wave's branch exists on origin AND has at least one
  commit ahead of origin/main, OR
- the other wave is listed in the conceptual table of
  `docs/ops/repo-reality-state.md`

References to the canonical wave registry's `conceptual` rows are
**allowed**: the row IS the materialization. References to the
wave's branch / PR / route / file without a row are forbidden.

**Practical form**: never write "see the X wave" or "after the Y
refactor lands" without either pointing at a branch / PR / commit
that exists, or first adding a row to `repo-reality-state.md`.

## Rule R2 · No audit requests without payload

A wave MUST NOT ask Codex (or any auditor) to verify a property that
has no on-disk payload. The payload is one of:

- a code change (diff against origin/main)
- a doc change (file under `docs/`)
- a test (file under `apps/web/__tests__/` or `packages/*/test/`)
- a script (file under `scripts/`)

A PR body whose `Test plan` section names a verification that
cannot be performed against the diff is an audit request without
payload. The verifier flags these via the `detect-speculative`
sub-mode.

**Practical form**: every audit checkpoint in a PR body must point
at something the auditor can run, read, or grep.

## Rule R3 · No topology references without routes / files

A wave MUST NOT reference a route / file / module that does not
exist on its branch. Two examples:

- "/a/b/c renders the dashboard" — the auditor must be able to
  open `apps/web/app/a/b/c/page.tsx`
- "the X service handles Y" — the auditor must be able to open
  `apps/api/.../X.ts` or `packages/.../X.ts`

A reference to a route / file that does not exist is a phantom reference. The verifier flags these via the default `enforce` sub-mode.

**Practical form**: before a PR opens, the wave author MUST be able
to `cat` every file the PR body claims exists. If `cat` fails, the
PR claim is phantom.

## How the three rules combine

| Symptom | Which rule catches it |
|---|---|
| PR body says "see PR #999" but #999 does not exist | R1 |
| PR body says "the feat/x branch is implemented" but branch has 0 commits ahead | R1 |
| PR body asks Codex to verify "production behavior" without any code change | R2 |
| PR body's test plan says "test the workflow" without naming a file / script | R2 |
| PR body claims a route exists but no `app/<route>/page.tsx` is present | R3 |
| Doc references a script `scripts/verify-X.ts` that does not exist | R3 |

The verifier reports the first rule the violation hits; multiple
rules may apply, but a single fix usually resolves all of them.

## What is NOT in scope

- The boundaries do not require every wave to merge before
  referencing another wave. Stacked waves are explicitly supported.
- The boundaries do not add a CI step. The verifier is a local
  script, intended to be called manually or by a pre-commit hook.
- The boundaries do not introduce a new wave type. They constrain
  the references waves make; they do not constrain what waves do.

## Posture

These three rules combine with `materialization-enforcement-contract.md`
and `repo-reality-state.md` to make every claim verifiable on the
spot. Together they prevent the failure mode where session-level
wave generation drifts into conceptual orchestration that has no
executable form on disk.

A wave that respects R1, R2, and R3 passes
`pnpm verify:materialization-enforcement` on first run.
