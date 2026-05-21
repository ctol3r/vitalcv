# Convergence Dependency Map

Snapshot of post-wallet-sdk-repair CI state across the
session-created PR stack. Maps which PRs are unblocked vs still-
blocked vs independent failures.

## Pre-repair vs post-repair

| Validation surface | Pre-repair | Post-repair |
|---|---|---|
| `pnpm --filter @vitalcv/wallet-sdk build` | **FAIL** (orphan re-export) | **PASS** |
| `pnpm turbo run build --filter @vitalcv/trust-state` | PASS | PASS |
| `pnpm turbo build` (workspace-wide) | **FAIL** (transitive wallet-sdk) | **PASS** (recursively) |
| `pnpm --filter @vitalcv/web exec tsc --noEmit` | 2 pre-existing errors | 2 pre-existing errors |
| `pnpm --filter @vitalcv/web lint` | clean | clean |
| `pnpm verify:ci-convergence` | (not present pre-wave) | **PASS** (0 FAIL) |

## PRs restored after unlock

All 17 session-created PRs (#381 - #397) inherit the wallet-sdk
repair when rebased onto a `main` that has this PR merged. Direct
unblocks:

| Branch | Was blocked by | Now |
|---|---|---|
| All 17 session PRs | `pnpm turbo build` transitive wallet-sdk failure | restored once this PR lands on main and downstream PRs rebase |

## Still-blocked branches

**None on the wallet-sdk axis.** The session-created PR roster
remains gated only by:

1. **Codex SAFE verdicts** -- 17/17 PRs are currently `BLOCKED_AUDIT`
   per `docs/ops/operational-state.md` (PR #397).
2. **Stack-dependency merge order** -- 4 stacked PRs (#383, #386,
   #393, #395) wait for their bases to land first.

Neither is a CI-convergence failure.

## Semantic blockers

None. The wave's truth-audit (PR #391) and stack-aware truth
contract (PR #396) gate against semantic inflation; no banned claim
sits across the session PR ecosystem awaiting repair.

## Independent failures

| Surface | Status | Owner |
|---|---|---|
| `apps/web/components/clinician/intake-types.ts` (2 TS errors) | pre-existing on origin/main | feature-team follow-up |
| `apps/web` PassportEntityClient / verify/[npi] / SourceOpsPanel (33 TS errors observed in PR #390's worktree env) | pre-existing on origin/main; baseline-dependent | feature-team follow-up |
| `apps/api`, `contracts`, `credential-demo` legacy bare-main declarations | pre-existing; workspace umbrellas; no runtime impact | hygiene follow-up |
| `apps/mobile/package.json` declares `main: expo-router/entry` (bare specifier) | by design (Expo runtime) | no repair needed |

The verify-ci-convergence script classifies these correctly: hard
FAILs come from broken builds; legacy/umbrella declarations get NOTE;
pending build artifacts get WARN.

## Merge-safe chains (post-repair)

The merge graph from `docs/ops/canonical-merge-graph.md` (PR #397) is
unchanged. With wallet-sdk restored:

| Block | State |
|---|---|
| A · ISOLATED (#381, #384, #385, #387, #391, #394, #396, #397, this PR #398) | merge-safe in any order pending Codex SAFE |
| B · trust canon (#382 -> #383 -> #386 -> #395) | merge-safe in chain order pending Codex SAFE |
| C · core scaffold (#388 -> #389 -> #390 -> #392 -> #393) | merge-safe in chain order pending Codex SAFE; first-lander absorbs others' scaffold |

Convergence is now bottlenecked entirely on Codex audit throughput,
not on build-system repair.

## Recommended merge sequence (updated)

```
# Land this PR first to seed the wallet-sdk repair:
gh pr merge --rebase 398

# Then proceed with the canonical sequence from PR #397's merge graph:
#   Block A ISOLATED PRs (in any order)
#   Block B trust canon chain (in chain order)
#   Block C core scaffold chain (in chain order)
```

After #398 lands, every other PR's first action on rebase is to
absorb the wallet-sdk fix from main; the diff resolves to no-op for
those PRs.
