# Repository Reality Audit

Snapshot of the VitalCV repo state at the time `fix/repository-reality-
alignment` was authored. Captures branch / worktree / lockfile state
across Claude + Codex workflows so future audits have a known baseline.

## Snapshot (2026-05-20)

### Worktree inventory

Total worktrees: **143**. Of those, **52 are flagged "prunable"** by git
(either the branch was deleted or the worktree directory is missing).

Active session-created worktrees (this Claude Code work) live under
`/private/tmp/` and follow the naming convention
`/private/tmp/<branch-suffix>/`.

### Branches created this session

| Branch | PR | Ahead of `origin/main` | Status |
|---|---|---|---|
| `fix/prisma-contract-fragmentation` | #381 | 1 | merge candidate |
| `feat/institutional-trust-primitives` | #382 | 1 | merge candidate |
| `feat/trust-integration-coherence` | #383 | 2 (stacked on #382) | merge candidate |
| `fix/well-known-dynamic-host` | #384 | 1 | merge candidate |
| `feat/matuschak-provenance-panes` | #385 | 1 | merge candidate |
| `feat/canonical-provenance-navigation` | #386 | 4 (stacked on #383 + cherry-pick) | merge candidate (review stacking) |
| `feat/pilot-deployment-kit` | #387 | 1 | merge candidate |
| `feat/doximity-hook-and-roi-math` | #388 | 1 | merge candidate |
| `feat/openevidence-risk-engine-and-matuschak-api` | #389 | 1 | merge candidate |
| `feat/antigravity-router-and-durable-chain` | #390 | 1 | merge candidate |
| `fix/truth-constrained-operationalization` | #391 | 1 | merge candidate |
| `feat/live-npi-resolver-and-openmythos-compliance` | #392 | 1 | merge candidate |
| `fix/protocol-integrity-hardening` | #393 | 2 (stacked on #392) | merge candidate |

All 13 branches pushed to `origin/`, all have valid PRs, all worktrees clean.

### Status categories

| Category | Definition |
|---|---|
| `canonical` | branch pushed, PR open, worktree clean, builds clean |
| `stale` | branch lacks recent commits AND no open PR |
| `orphaned` | worktree directory missing or branch deleted |
| `merge candidate` | canonical + Codex audit ready |
| `archive candidate` | superseded by a later PR; should be closed |

The 52 prunable worktrees are categorically **orphaned** — git
recognises them but their state cannot be trusted. Remediation:
`git worktree prune` (operator action; not auto-pruned by this script).

### Detached implementation states

None observed in the 13 session-created worktrees. All session-created
branches push cleanly, all worktrees are checked out at the branch tip.

### Untracked workspace packages

None at `origin/main`. (PRs #388, #389, #390, #392 each scaffold
`packages/core/` as a workspace package; the scaffolds are identical
across those PRs so whichever lands first absorbs the duplicates on
rebase.)

### Lockfile integrity

`pnpm-lock.yaml` is present and committed on `origin/main`. Each PR
that adds `@vitalcv/core` as an apps/web dependency regenerates the
lockfile; rebasing onto main resolves cleanly.

### Branch / main divergence

Each session-created branch is **1–4 commits ahead** of `origin/main`
and **zero commits behind** at branch-cut time.

### Duplicate implementation surfaces

`packages/core/` is scaffolded in four PRs (#388, #389, #390, #392)
with identical `package.json` / `tsconfig.json` / `vitest.config.ts`.
Each PR is rebase-clean against the others; the scaffold is idempotent.

### Missing PR mappings

None for session-created branches.

## Outstanding repo risks

1. **52 prunable worktrees** — clutter, no functional impact. Operator
   should run `git worktree prune` periodically. (Not auto-pruned by
   this wave; operator action.)
2. **Stacked PRs (#383 → #382, #386 → #383+#385, #390 → main, #393 → #392)** —
   merge order matters. Recommended merge sequence:
   #382 → #383 → #385 → #386, #381, #384, #387, #388 → #389 → #390 → #391 → #392 → #393.
3. **Duplicate `packages/core/` scaffolds** — same content; merges
   absorb cleanly on first land. Once one PR merges, subsequent PRs'
   scaffold changes become no-ops on rebase.

## Repository status: ALIGNED

All session-created worktrees + branches + PRs converge on the same
implementation reality. The 143-worktree count is the operator's
historical fleet (52 prunable, the rest active across multiple Claude
agents); this wave does not mutate any of them.
