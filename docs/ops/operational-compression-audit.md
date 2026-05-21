# Operational Compression Audit

Identifies orchestration duplication and governance sprawl in the
session-created stack. Goal: compress without losing critical
semantics.

## Duplicated governance docs

| Capability | Authoritative source | Other places it appears |
|---|---|---|
| Truth contract (banned phrases) | `CLAUDE.md` (project-wide) | `lib/trust/institutional-language.ts` (BANNED_INSTITUTIONAL_PHRASES); `docs/ops/operational-capability-boundaries.md` §"Banned phrases"; `docs/protocol/protocol-capability-boundaries.md` §"Banned"; `docs/protocol/interoperability-rehearsal-boundaries.md` §"Banned language"; `docs/ops/stack-aware-truth-contract.md` §"Banned cross-stack claims" |
| Capability-status taxonomy (implemented / planned / unsupported) | `docs/ops/operational-capability-boundaries.md` (PR #391) | mirrored in `docs/protocol/protocol-capability-boundaries.md` (PR #393); mirrored in `docs/protocol/interoperability-rehearsal-boundaries.md` (PR #395) |
| Codex-ready checklist | `docs/ops/codex-ready-checklist.md` (PR #394) | partial overlap with `docs/ops/implementation-reality-contract.md` (PR #394); partial overlap with `docs/ops/stack-aware-truth-contract.md` §"Truth-contract escalation" (PR #396) |
| Worktree governance | `docs/ops/worktree-governance.md` (PR #394) | partial overlap with `docs/ops/repository-reality-audit.md` (PR #394) |
| Stack topology / merge order | `docs/ops/stack-topology.md` (PR #396) | duplicated in `docs/ops/repository-reality-audit.md` §"Recommended merge order" (PR #394); duplicated here in `canonical-merge-graph.md` |

### Disposition

- **Banned-phrase lists are intentional duplicates**: each surface
  audits itself with the relevant subset. Consolidation would force
  every surface to import the master list, increasing coupling.
  Keep separate; the test gates (`institutional-trust-primitives`,
  `truth-constrained-operationalization`, `interoperability-rehearsal`)
  already verify each subset independently.
- **Capability-status taxonomy**: `operational-status.ts` is the
  authoritative TypeScript type (`OperationalStatus`); the three
  boundary docs use it as a vocabulary. Keep three separate
  boundary docs (operational / protocol / interoperability) because
  the audiences differ (operator / verifier / receiving institution).
- **Stack topology / merge order**: this audit collapses the
  duplication into `canonical-merge-graph.md` (this wave). The
  `repository-reality-audit.md` recommended-order section becomes
  cross-reference only.
- **Codex-ready checklist + implementation-reality contract**:
  partial overlap kept on purpose -- the checklist is operator-
  facing (manual checks), the contract is binding (machine-checked).
  Consolidating would lose the operator-vs-machine framing.

## Duplicated verification tooling

| Capability | Authoritative source | Other commands |
|---|---|---|
| Repo-state report | `scripts/verify-repo-reality.ts` (PR #394) | wrapped by `pnpm verify:reality` / `verify:worktrees` / `verify:codex-ready` (3 modes) |
| Stack-integrity report | `scripts/verify-stack-integrity.ts` (PR #396) | wrapped by `pnpm verify:stack` / `verify:semantic-lineage` (alias) |
| Codex/Claude context generation | `scripts/generate-codex-context.ts` + `generate-claude-context.ts` (PR #396) | each wrapped by one pnpm command |

### Disposition

This wave introduces `scripts/verify-operational-health.ts` -- a thin
deterministic dispatcher that runs the three sub-reports
(repo-reality / stack-integrity / codex-ready) and emits one combined
output. The underlying scripts are unchanged; the new script is the
single entry point operators run before any merge.

`pnpm verify:operational-health` is the canonical command. The three
existing commands (`verify:reality`, `verify:stack`,
`verify:codex-ready`) remain for backwards compatibility and for
targeted debugging.

## Duplicated operational language

| Concept | Sources |
|---|---|
| "institution-owned workflow" | `lib/trust/institutional-language.ts` (PR #382); `docs/ops/operational-capability-boundaries.md` (PR #391); `docs/protocol/interoperability-rehearsal-boundaries.md` (PR #395) |
| "operator-assisted" | `lib/trust/operational-status.ts` (PR #391); `lib/trust/institutional-language.ts` — not present (use `institutionOwned`); `lib/interoperability/exchangeReadiness.ts` (PR #395) implicit |
| "source-confirmed" | `lib/trust/institutional-language.ts` (PR #382); `lib/trust/degradation.ts` (PR #382); `lib/interoperability/demoExchanges.ts` (PR #395) |
| "continuity restored" | `lib/trust/institutional-language.ts` (PR #382); `lib/interoperability/demoExchanges.ts` (PR #395) |

### Disposition

`apps/web/lib/trust/institutional-language.ts` (PR #382) is the
canonical phrase registry. Other modules import the constants directly
when possible; when they don't, the inline string MUST match the
registry verbatim. The truth-audit tests gate against drift.

## Duplicated replay semantics

| Concept | Sources |
|---|---|
| `composeLineage` six-cell reading order | `lib/trust/replay-grammar.ts` (PR #382) -- single source |
| Pane URL contract (`?panes=`) | `lib/trust/panes.ts` (PR #385) -- single source |
| Audit event chain hashing | `packages/core/src/services/ledger/HashChainService.ts` (PR #390) -- single source |

### Disposition

No duplication. Replay semantics are correctly centralized at the
library level; downstream consumers import.

## Duplicated provenance surfaces

| Surface | Sources |
|---|---|
| `LineageHeader` primitive | `apps/web/components/trust/primitives/LineageHeader.tsx` (PR #382) -- single source |
| `ProvenanceChronology` wrapping `LineageHeader` | `apps/web/components/trust/navigation/ProvenanceChronology.tsx` (PR #386) |
| Local route-level `LineageHeader` function (renamed) | `apps/web/app/verify/receipt/[receiptId]/page.tsx` (PR #383) → renamed to `ReplayInspectionHeader` |

### Disposition

Name collision was resolved in PR #383. No outstanding duplication.

## Orchestration redundancy

| Pattern | Where | Disposition |
|---|---|---|
| `pnpm verify:reality` is wrapped by `pnpm verify:codex-ready` | PR #394 | INTENTIONAL -- different audiences (full vs gate) |
| `verify:stack` and `verify:semantic-lineage` point to the same script | PR #396 | INTENTIONAL -- alias for audit-time clarity |
| `generate:codex-context` and `generate:claude-context` ship duplicate STACK declarations | PR #396 | TOLERATED -- each script remains standalone-runnable; consolidate via shared module in a future wave |
| `packages/core/` scaffold across 4 PRs | #388/#389/#390/#392 | TOLERATED -- absorbing on rebase; first land wins |

## Summary

- **Duplicate systems removed:** 0 (this is an audit; consolidation
  happens via `verify-operational-health` as a single dispatcher)
- **Commands consolidated:** 1 (`verify:operational-health` wraps
  reality + stack + codex-ready)
- **Intentional duplicates documented:** 5 (banned phrases, capability
  status taxonomies, Codex-ready vs implementation contract, repo
  audit vs merge graph, generate-codex/claude scripts)

The session stack's redundancy is largely intentional: each surface
audits itself, and the consolidating layer is the single dispatcher
script. Further compression would couple layers that should remain
independent.
