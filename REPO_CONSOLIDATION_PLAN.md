# REPO CONSOLIDATION + HARDENING PLAN

This is the P0 Stabilization wave. The goal is to collapse all the fragmented, parallel worktrees into a single, compiling `main-stable` branch. We will execute this strictly, prioritizing build integrity over feature retention.

## PART 1: INVENTORY & TRIAGE
Currently Active Worktrees:
- `vitalcv-system-1` (Contains System 1-6 loops & Interaction Layer Adaptation)
- `vitalcv-decision-engine` (Deterministic TrustGraph Core)
- `vitalcv-continuous-verification` (Background Jobs & Delta Engine)
- `vitalcv-trustgraph-explorer` (UI Inspection Layer)
- `vitalcv-autonomous-execution` (SystemEvents & Action Queues)
- `vitalcv-control-plane` (Ops Dashboard & Intelligence)
- `vitalcv-market-domination` (GTM & Growth Hooks)
- `vitalcv-revenue-conversion` (Pricing & Access Control)
- `vitalcv-distribution-integration` (Embed Widget & Webhooks)
- `vitalcv-usage-activation` (Pilot User Telemetry)

## PART 2: THE "main-stable" BASELINE
1. We will branch `main-stable` from the last known pristine commit on `main` (the `fix/wedge-truth-continuity` commit `0eec323e`).
2. We will sequentially merge the isolated worktree branches into `main-stable`. 
3. **CRITICAL GATE:** Every merge must pass `pnpm --filter @vitalcv/api build` and `pnpm --filter web build`. If a branch breaks the build due to cascading schema mismatches (e.g., `AdvisoryOutcomeEventWhereInput` type errors), we will fix the TypeScript errors *before* merging the next branch.

## PART 3: SEQUENTIAL MERGE ORDER
1. **Security & Auth:** Merge `fix/security-hardening` (Lock down readiness endpoints, fix wallet exploit).
2. **Core Wedge & Decision Engine:** Merge `feat/decision-engine-trustgraph` and `feature/system1-core-wedge`.
3. **Passport & Clinician Loops:** Merge `feature/system2-clinician-loop` and `feature/system6-snapshot-reuse`.
4. **Employer Review:** Merge `feature/system3-employer-loop`.
5. **Trust Graph & Explainability:** Merge `feature/wave14-graph-substrate`, `feature/wave15-explainability`, and `feature/wave16-claim-evidence-explorer`.
6. **Telemetry & Pilot Systems:** Merge `feat/real-usage-activation`.

*Any branch that introduces non-resolvable structural breaks (or is purely experimental UI) will be DISCARDED.*

## PART 4: DEAD CODE PURGE & DATABASE INTEGRITY
1. Run a sweeping `tsc` check. Delete any abandoned routes, duplicate systems, or placeholder UI components.
2. Synchronize `schema.prisma`. Ensure `npx prisma generate` creates a unified client without orphan relations.
3. Clean the `pnpm-lock.yaml` and deduplicate configurations.

## PART 5: FINAL VERIFICATION & DEPLOYMENT
1. Test the core NPI → Passport → Review loop.
2. Tag `v1.0-pilot-ready`.
3. Force-replace `main` with `main-stable`.
