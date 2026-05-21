# Repo Reality State

Per-wave lifecycle table tracking the seven materialization states.
Distinct from `canonical-wave-registry.md` (when merged) — the
registry is a catalog; this file is the enforceable state ledger
that `scripts/verify-materialization-enforcement.ts` reads on every
invocation.

The seven states are ordered. A wave MAY only advance forward (with
the exception of `archived`, which any other state may transition
to). The verifier rejects backward transitions when invoked with
`--check-lifecycle`.

## States

| State | Meaning | Enforcement check |
|---|---|---|
| `conceptual` | Wave is named but no branch, no commit, no PR | Tolerated; only allowed when listed in the conceptual table below |
| `local-only` | Branch exists locally but is NOT pushed to origin | Tolerated; row must include a local-only declaration |
| `committed` | Branch exists on origin with at least one commit ahead of origin/main | `git rev-list --count origin/main..origin/<branch>` >= 1 |
| `PR-open` | A pull request exists for the branch | `gh pr view <N>` succeeds |
| `audited` | A Codex audit verdict has been recorded against the PR (annotated in this file's `audit_evidence` column) | `audit_evidence` resolves to a file/URL on this repo |
| `merged` | PR is merged to main | `gh pr view <N>` reports state=MERGED |
| `archived` | PR closed without merge, or superseded by a later wave | `gh pr view <N>` reports state=CLOSED OR row carries `supersededBy` reference |

## Session-scope rows

| # | Wave | Branch | State | PR | Audit evidence | Notes |
|---|---|---|---|---|---|---|
| W22 | Operational Waste Visibility | `feat/operational-waste-visibility` | `PR-open` | 402 | `docs/demo/operational-waste-boundaries.md` | Stacked on `feat/institutional-intake-momentum` |
| W23 | Operational Signal Hierarchy | `feat/operational-signal-hierarchy` | `PR-open` | 403 | `docs/design/operational-signal-hierarchy.md` | -- |
| W24 | Institutional Path Completion | `feat/institutional-path-completion` | `PR-open` | 404 | `docs/product/institutional-path-boundaries.md` | -- |
| W25 | Reality Synchronization | `fix/reality-synchronization` | `PR-open` | 405 | `docs/ops/reality-synchronization-audit.md` | Sibling to this wave; defines the canonical wave registry |
| W26 | Materialization Enforcement | `fix/materialization-enforcement` | `local-only` | _this PR_ | `docs/ops/materialization-enforcement-contract.md` | This file |

The W26 row updates to `PR-open` once the PR opens. Until then,
`local-only` is the truthful state: the branch exists in this
worktree but is not yet on origin. The verifier tolerates
`local-only` as a NOTE; a row sitting in `local-only` on origin/main
would be flagged on the next run.

## Open PRs on the repo (verifier coverage)

These rows exist so the enforcement verifier covers every currently
open PR. The verifier checks each row's branch + PR; this prevents
new docs from referencing a PR that was closed or branch that was
deleted.

| PR | Branch | State |
|---|---|---|
| 375 | `fix/wallet-sdk-interoperability-export` | `PR-open` |
| 376 | `ops/vercel-exit-emergency` | `PR-open` |
| 377 | `ops/local-demo-operator` | `PR-open` |
| 378 | `feat/design-trust-surfaces-canon-v1` | `PR-open` |
| 379 | `docs/codebase-map-2026-05-18` | `PR-open` |
| 380 | `fix/replay-engine-ci-regression` | `PR-open` |
| 381 | `fix/prisma-contract-fragmentation` | `PR-open` |
| 382 | `feat/institutional-trust-primitives` | `PR-open` |
| 383 | `feat/trust-integration-coherence` | `PR-open` |
| 384 | `fix/well-known-dynamic-host` | `PR-open` |
| 385 | `feat/matuschak-provenance-panes` | `PR-open` |
| 386 | `feat/canonical-provenance-navigation` | `PR-open` |
| 387 | `feat/pilot-deployment-kit` | `PR-open` |
| 388 | `feat/doximity-hook-and-roi-math` | `PR-open` |
| 389 | `feat/openevidence-risk-engine-and-matuschak-api` | `PR-open` |
| 390 | `feat/antigravity-router-and-durable-chain` | `PR-open` |
| 391 | `fix/truth-constrained-operationalization` | `PR-open` |
| 392 | `feat/live-npi-resolver-and-openmythos-compliance` | `PR-open` |
| 393 | `fix/protocol-integrity-hardening` | `PR-open` |
| 394 | `fix/repository-reality-alignment` | `PR-open` |
| 395 | `feat/interoperability-rehearsal-infrastructure` | `PR-open` |
| 396 | `fix/stacked-infrastructure-governance` | `PR-open` |
| 397 | `fix/operational-compression-and-merge-execution` | `PR-open` |
| 398 | `fix/ci-unlock-and-stack-convergence` | `PR-open` |
| 399 | `fix/merge-orchestration-and-release-discipline` | `PR-open` |
| 400 | `feat/pilot-demonstration-compression` | `PR-open` |
| 401 | `feat/institutional-intake-momentum` | `PR-open` |

## Conceptual table (NO branch, NO PR, NO commit)

These rows exist so a wave author can declare a forward-looking
reference WITHOUT producing topology drift. A conceptual reference
that does NOT appear here is rejected by the verifier as
speculative.

| Reference | Source | Estimated lifecycle target |
|---|---|---|
| (none currently) | -- | -- |

When a wave needs to forward-reference an entity that does not exist
yet, add a row above first. The verifier treats conceptual rows as
NOTE entries, never as FAIL.

## Operator rules

1. **Advance in place.** Update the State column when lifecycle
   advances. Do not delete rows.
2. **Conceptual references** that do not appear in the conceptual
   table are speculative and forbidden on origin/main.
3. **Every PR reference elsewhere in the repo** MUST resolve to a
   row here OR to a merged PR. Closed-without-merge PRs are only
   acceptable when explicitly annotated (see
   `docs/ops/pr-b-crypto-superseded-note.md` for the pattern).
4. **Audit evidence** is required for any row in state `audited` or
   beyond.
