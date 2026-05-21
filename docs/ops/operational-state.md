# Operational State Dashboard

Single-page status board for major branch lanes. Each lane is in
exactly one state at a time.

## State definitions

| State | Meaning |
|---|---|
| `READY` | Branch pushed, Codex SAFE recorded, no upstream dep blocking |
| `BLOCKED` | Implementation present but missing a prereq (Codex audit, upstream PR, etc.) |
| `EXPERIMENTAL` | Audit-flagged for follow-up; do not merge |
| `ARCHIVE_CANDIDATE` | Superseded by a later PR; close, do not merge |
| `CODEX_UNSAFE` | Codex audit returned non-SAFE; remediation in progress |
| `MERGE_SAFE` | All gates passed; safe to `gh pr merge` |

State transitions go: `BLOCKED` → `READY` → `MERGE_SAFE` (or fail
back to `BLOCKED`). `CODEX_UNSAFE` and `EXPERIMENTAL` are sinks
until the issue is resolved or the branch is archived.

## Session lane snapshot (2026-05-21)

| Lane | Branch | State | Notes |
|---|---|---|---|
| Schema | `fix/prisma-contract-fragmentation` (#381) | `BLOCKED` (audit) | Standalone; ready for Codex |
| Trust canon I | `feat/institutional-trust-primitives` (#382) | `BLOCKED` (audit) | Foundation; merge first in chain B |
| Trust canon II | `feat/trust-integration-coherence` (#383) | `BLOCKED` (audit + #382) | Stacked on #382 |
| Discovery v1 | `fix/well-known-dynamic-host` (#384) | `BLOCKED` (audit) | Standalone; superseded by #392's direct routes for tunnel demos |
| Panes | `feat/matuschak-provenance-panes` (#385) | `BLOCKED` (audit) | Standalone; cherry-picked into #386 |
| Provenance nav | `feat/canonical-provenance-navigation` (#386) | `BLOCKED` (audit + #383) | Stacked + cherry-pick |
| Pilot kit | `feat/pilot-deployment-kit` (#387) | `BLOCKED` (audit) | Standalone |
| Core / ROI | `feat/doximity-hook-and-roi-math` (#388) | `BLOCKED` (audit) | First @vitalcv/core scaffold |
| Risk / graph | `feat/openevidence-risk-engine-and-matuschak-api` (#389) | `BLOCKED` (audit) | Scaffold-duplicate |
| Antigravity | `feat/antigravity-router-and-durable-chain` (#390) | `BLOCKED` (audit) | Scaffold-duplicate + AuditEvent schema delta |
| Truth governance | `fix/truth-constrained-operationalization` (#391) | `BLOCKED` (audit) | Standalone |
| Live discovery | `feat/live-npi-resolver-and-openmythos-compliance` (#392) | `BLOCKED` (audit) | Scaffold-duplicate + direct .well-known + Ed25519 |
| Protocol integrity | `fix/protocol-integrity-hardening` (#393) | `BLOCKED` (audit + #392) | Stacked on #392 |
| Repo health | `fix/repository-reality-alignment` (#394) | `BLOCKED` (audit) | Standalone |
| Interop rehearsal | `feat/interoperability-rehearsal-infrastructure` (#395) | `BLOCKED` (audit + #386) | Stacked on #386 |
| Stack governance | `fix/stacked-infrastructure-governance` (#396) | `BLOCKED` (audit) | Standalone |
| Operational compression | `fix/operational-compression-and-merge-execution` (#397) | `BLOCKED` (audit) | Standalone; this PR |

**Total: 17 PRs · all currently `BLOCKED` on Codex audit.**

When each lane records Codex SAFE, state advances to `READY` (or
`STACKED_SAFE` -- see `canonical-merge-graph.md`).

## Operator workflow

```
# At the start of a merge session:
pnpm verify:operational-health

# For each branch in canonical merge order:
pnpm generate:codex-context <branch>  > /tmp/codex-context.md
# (operator pastes /tmp/codex-context.md into Codex; runs three audits)
# (operator updates the table below by hand once SAFE is recorded)

# When all required SAFE verdicts are recorded:
gh pr merge --rebase <pr>
```

## Archive candidates

None. The duplicate-scaffold relationship across
`#388/#389/#390/#392` is `absorbed on rebase`, not
`archive candidate`.

## Codex-unsafe / Experimental

None as of this snapshot. Update the table the moment Codex returns
non-SAFE on any branch.

## How to update this doc

When state changes for a lane:

1. Edit the row in the table above.
2. Move the branch into the corresponding "Codex-unsafe" or
   "Experimental" section if applicable.
3. Commit + push on the branch that recorded the state change.

This doc is a snapshot, not a live system. Treat it as the operator's
ledger; reconcile against `gh pr list` if anything looks wrong.
