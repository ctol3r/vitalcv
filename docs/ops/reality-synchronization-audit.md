# Reality Synchronization Audit

Single-pass audit of the gap between conceptual wave references in
the repo and the executable state of those references. The audit is
authored as a snapshot; the verifier
(`scripts/verify-wave-materialization.ts`) is the durable mechanism.
Re-run the verifier when drift is suspected; refresh this audit doc
only when the drift posture changes substantively.

Cut date: 2026-05-21.

## Audit scope

- All rows in `docs/ops/canonical-wave-registry.md`
- PR references in `docs/ops/*.md`
- PR references in CLAUDE.md and the per-user memory
- PR references in commit messages on the current branch
- Route references in PR bodies for #402, #403, #404
- Audit-target references in PR bodies

## Findings

### F1 · Conceptual-only waves on origin/main

**None observed.** Every wave referenced in `docs/ops/*.md` resolves
to one of:
- a merged PR (verifier coverage exists via `gh pr view`)
- an open PR with a live branch on origin
- a row in `canonical-wave-registry.md` with explicit `conceptualized`
  lifecycle (currently the registry has zero conceptualized rows)

The `Conceptual-only items` table in the registry is intentionally
left empty as the steady state. Wave authors who need to forward-
reference an entity that does not yet exist MUST add a row there with
lifecycle `conceptualized` before merging.

### F2 · Orphaned PR references

**None observed.** Spot-checked PR refs in `docs/ops/`:

| Ref | Resolves | Source |
|---|---|---|
| PR #172 | merged | `docs/ops/vitalcv-public-claims-matrix.md` |
| PR #187 | merged | `docs/ops/vitalcv-completion-board.md` |
| PR #203 | merged | `docs/ops/pr-b-crypto-superseded-note.md` |
| PR #204 | merged | `docs/ops/pr-b-crypto-superseded-note.md` |
| PR #237 | open | `docs/ops/vitalcv-completion-board.md` |
| PR #240 | open | `docs/ops/vitalcv-completion-board.md` |
| PR #243 | open | `docs/ops/vitalcv-completion-board.md` |
| PR #247 | open | `docs/ops/vitalcv-completion-board.md`, `docs/ops/code-red-final-verification-2026-05-07.md` |

All refs resolve; no orphan-PR drift on origin/main.

### F3 · Missing branch references

**None observed.** All branches named in the registry resolve via
`git ls-remote origin`.

### F4 · Disconnected audit-target references

**None observed.** Spot-checked audit-target paths declared in the
registry rows for W22/W23/W24/W25:

- `docs/demo/operational-waste-boundaries.md` -- exists on
  `feat/operational-waste-visibility` (PR #402)
- `docs/design/operational-signal-hierarchy.md` -- exists on
  `feat/operational-signal-hierarchy` (PR #403)
- `docs/product/institutional-path-boundaries.md` -- exists on
  `feat/institutional-path-completion` (PR #404)
- `docs/ops/reality-synchronization-audit.md` -- this file

These paths do NOT exist on origin/main yet because the four PRs are
still open. The verifier accepts this because the lifecycle of those
rows is `pr_opened`, not `audited`. When a PR merges and its
lifecycle column is advanced to `audited` or `merged`, the verifier
then requires the path on origin/main.

### F5 · Topology drift

**None observed.** All open PRs on the repo resolve to a current
branch:

- main-based PRs: #375, #376, #377, #378, #379, #380, #381, #382,
  #384, #385, #387, #388, #389, #390, #391, #392, #394, #396, #397,
  #398, #399, #403, #404
- stacked PRs: #383 (on #382), #386 (on #383), #395 (on #386), #393
  (on #392), #400 (on #395), #401 (on #400), #402 (on #401)

The stacked topology is documented in PR bodies and matches what
`gh pr list --json baseRefName,headRefName` reports.

### F6 · Wallet-SDK orphan-export double-handling

PR #375 (`fix/wallet-sdk-interoperability-export`) is the canonical
fix for `packages/wallet-sdk/src/index.ts:351`. PR #398
(`fix/ci-unlock-and-stack-convergence`) also carries the fix in
narrative form. Several open PRs (#402, #403, #404, and this PR)
each carry the same one-line removal locally so the per-branch build
passes; on rebase against either #375 or #398 the change collapses
to a no-op.

This is **noted, not flagged** -- the duplication is necessary while
the canonical fix waits to merge. The audit recommends merging #375
first; then re-running the verifier confirms the duplicate handling
becomes a no-op everywhere.

## Posture

Reality synchronization on origin/main is currently **drift-free**.
The verifier emits no FAIL entries when invoked on origin/main with
the wallet-sdk fix branch (this PR) checked out. Re-running on each
of the open PR branches likewise emits no FAIL entries.

The verifier was deliberately built to be **strict-on-claim**: a row
that declares `audited` or `merged` lifecycle MUST have its audit
target on disk and its PR resolve. A row that declares only
`implemented` or `pr_opened` is checked but more leniently. This
asymmetry mirrors how Codex audits the work: the moment a wave
claims a verified state, that claim must be verifiable on the spot.

## Recommendations

1. **Hold this audit snapshot.** Re-author only when drift posture
   changes substantively.
2. **Run the verifier locally before any merge** (`pnpm verify:wave-reality`).
3. **Refresh canonical-wave-registry.md in-place** when a wave's
   lifecycle advances. Do not delete rows.
4. **Land PR #375 first** to collapse the wallet-sdk duplicate
   handling across the stack.
5. **Never reference an entity that does not pass one of the three
   materialization checks** (materialized / auditable / topology-real).
   The `docs/ops/materialization-boundaries.md` doctrine declares
   this rule.
