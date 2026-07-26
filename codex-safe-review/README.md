# Codex SAFE Review — Career Evidence Stack

**Wave:** 228 (System Consolidation & SAFE Review) · **Branch:** `wave/career-evidence-network-alignment`
**Date:** 2026-06-21 · **Prepared by:** Claude Code (builder)

This package prepares the Career Evidence stack for independent verification by Codex. **No feature work was done in W228** — this is hardening + honest review only.

## Scope of the stack under review

One new workspace package + one web adapter + four read-only API routes + one dev tool, built across Waves 220–225:

| Layer | Location |
|---|---|
| `@vitalcv/domain-evidence` package | `packages/domain-evidence/` |
| Passport→Evidence adapter | `apps/web/lib/evidence/passport-to-evidence.ts` |
| Evidence API | `apps/web/app/api/evidence/[entityId]/route.ts` |
| Graph API | `apps/web/app/api/graph/[entityId]/route.ts` |
| Trust API | `apps/web/app/api/graph/[entityId]/trust/route.ts` |
| Timeline API | `apps/web/app/api/timeline/[entityId]/route.ts` |
| Dev graph/trust explorer | `apps/web/app/dev/graph/[entityId]/` |

## Documents

| # | Doc | Answers |
|---|---|---|
| 01 | [Stack Inventory + Dependency Map](./01-stack-inventory.md) | C1 — what's here, how it depends |
| 02 | [Architecture Review](./02-architecture-review.md) | C2 — duplication / coupling / cycles / bottlenecks |
| 03 | [Test Coverage Review](./03-test-coverage-review.md) | C3 — missing / weak / critical-path coverage |
| 04 | [Domain Model Map](./04-domain-model-map.md) | C4 — the types |
| 05 | [API Map](./05-api-map.md) | C4 — the routes |
| 06 | [Risk Assessment + Migration Risks](./06-risk-assessment.md) | C4/C5 — risks now + for Wallet/Mobility/Network/Matching/Recognition |
| 07 | [Merge Readiness Report](./07-merge-readiness.md) | C6 — can it merge, and under what conditions |

## Headline verdict (full detail in 07)

- **Coherent:** yes — linear dependency DAG, no cycles, single external dep.
- **Safe:** yes — every doctrine invariant is test-enforced; pure transforms; no new persistence; no PHI; honest gating.
- **Mergeable:** yes, **conditionally** — see 07 §Conditions. Two real pre-merge items: (1) the API route handlers have no direct tests, (2) the branch carries unrelated pre-existing WIP that should be separated from this stack before merge.
- **Extensible:** yes — additive facade; Mobility (W230) and Memory deepening build on it without modification.

## How to verify (suggested Codex pass)

1. `pnpm --filter @vitalcv/domain-evidence build && pnpm --filter @vitalcv/domain-evidence test`
2. `pnpm --filter @vitalcv/web exec vitest run __tests__/evidence-*.test.ts __tests__/career-packet-*.test.ts __tests__/employer-proof-packet.test.ts __tests__/export-packet-route.test.ts __tests__/banned-verified-label.test.ts`
3. `pnpm --filter @vitalcv/domain-evidence typecheck && pnpm --filter @vitalcv/web exec tsc --noEmit`
4. `pnpm check:claims`
5. Audit the invariants in 06 against the code.
