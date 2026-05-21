# Stack Operational Governance

Consolidated reference covering stack topology, semantic inheritance,
implementation reality, and Codex-ready semantics. Cross-references
the source-of-truth docs without duplicating their content.

## Source-of-truth docs

| Concern | Source | Purpose |
|---|---|---|
| Branch ancestry + merge order | `docs/ops/stack-topology.md` (PR #396) | Authoritative ancestry map |
| Inheritance rules | `docs/ops/semantic-inheritance-boundaries.md` (PR #396) | What may / must-not be inherited |
| Cross-stack truth bans | `docs/ops/stack-aware-truth-contract.md` (PR #396) | Phrases barred without ancestor PR |
| Implementation reality | `docs/ops/implementation-reality-contract.md` (PR #394) | 8 binding clauses a wave must satisfy |
| Codex pre-merge checklist | `docs/ops/codex-ready-checklist.md` (PR #394) | Manual checklist + override protocol |
| Repository state audit | `docs/ops/repository-reality-audit.md` (PR #394) | Worktree + branch snapshot |
| Worktree governance | `docs/ops/worktree-governance.md` (PR #394) | Naming + lifecycle + anti-patterns |
| Operational capabilities | `docs/ops/operational-capability-boundaries.md` (PR #391) | Implemented / planned / unsupported taxonomy |
| Merge graph (this wave) | `docs/ops/canonical-merge-graph.md` | Deterministic merge sequence |
| Operational state board | `docs/ops/operational-state.md` | Per-lane state snapshot |
| Compression audit | `docs/ops/operational-compression-audit.md` | Duplicate-systems inventory |
| Founder execution flows | `docs/ops/founder-execution-lane.md` | Paste-and-run operator commands |

## Consolidated rule (binding)

A PR is `READY` when:

1. Implementation reality contract: 8 clauses pass (PR #394)
2. Codex-ready checklist: manual gate signed off (PR #394)
3. Stack-aware truth contract: no banned cross-stack claims (PR #396)
4. Operational state: lane shows `READY` or `STACKED_SAFE`
5. Operational health: `pnpm verify:operational-health` exits 0

Codex SAFE verdicts on (a) implementation, (b) diff, (c) commit-
message copy are the final gate after the five above.

## Operator command surface (consolidated)

| Command | Purpose | Sub-checks |
|---|---|---|
| `pnpm verify:operational-health` | **Canonical pre-merge gate** | reality + stack + codex-ready |
| `pnpm verify:reality` | Worktree + branch + lockfile health | repo only |
| `pnpm verify:worktrees` | Worktree subset | worktree only |
| `pnpm verify:codex-ready` | Branch + remote + lockfile + uncommitted | codex-ready only |
| `pnpm verify:stack` | Stack ancestry + cherry-pick | stack only |
| `pnpm verify:semantic-lineage` | alias of verify:stack (audit-time clarity) | stack only |
| `pnpm generate:codex-context <branch>` | Codex audit packet | n/a |
| `pnpm generate:claude-context <branch>` | Claude anti-hallucination packet | n/a |

Operators running a fresh session use `verify:operational-health`.
The targeted commands exist for debugging when the dispatcher reports
a sub-check failure.

## Why this doc exists

PRs #391, #394, and #396 each ship governance vocabulary. The
overlap is intentional but the reader needs a single map. This doc
is that map. It does NOT duplicate the rules — it indexes them.

## Maintenance

When a new governance doc is added in a future wave:

1. Add a row to the "Source-of-truth docs" table above with the
   doc's PR number.
2. If the doc introduces a new operator command, add a row to the
   "Operator command surface" table.
3. If the doc introduces a new pre-merge clause, extend the
   "Consolidated rule" list.

If a future wave consolidates the source-of-truth docs themselves,
delete the rows here that no longer point at distinct files.
