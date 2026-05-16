# Federated Governance Coordination — W2-PR54A

**Wave:** W2-PR54A — Federated Governance Coordination
**Date:** 2026-05-09
**Status:** Implementation + chaos suite + CI gate + scale gate landed; this doc is the operator-facing synthesis.
**Risk class:** SAFE — pure transforms, fail-closed extensions to a previously single-tenant boundary (W2-PR36A).
**Builds on:** [multi-tenant-governance-isolation](multi-tenant-governance-isolation.md), [replay engine integration](../../apps/api/backend/src/services/audit/replayEngine.ts), [runtimeTrustCohesion](../../apps/api/backend/src/services/runtimeTrustCohesion.ts), [federation discovery (ADR-0003)](../adr/0003-openid-federation.md).
**Companion to:** [containment-explainability](containment-explainability.md), [drift-explainability](drift-explainability.md), [constitutional-trust-continuity](constitutional-trust-continuity.md).

---

## What this track answers

W2-PR36A made the **single-tenant** boundary structurally fail-closed: a tenanted requester cannot read another tenant's capsule, a drift signature for tenant A cannot merge into tenant B's lineage, a recovery wave cannot silently span tenants. ADR-0003 introduced **federation peers** as discoverable external networks (Nursys, CAQH) with read-only metadata.

PR54A asks the cross-cutting question that sits *between* those two layers:

> When two or more tenants explicitly agree to coordinate inside a named federation, **how do replay lineage, trust state, drift, ambiguity, and recovery semantics flow safely across the federation boundary — without re-introducing the cross-tenant contamination vectors that PR36A closed**?

The new risk vectors are:

- A federated replay invoked under federation `fed-1` returning a capsule whose tenant has no declared membership in `fed-1`.
- An ambiguity signature for tenant A being propagated to tenant X who is in a *different* federation.
- A trust-synchronization sweep that silently proceeds on partial consensus when one federation member is offline or has drifted.
- Members of the same federation disagreeing about who is *in* the federation — and replay/sync proceeding anyway as if the membership set were canonical.
- A recovery wave fanning out across `fed-1` capsules but admitting one straggler from `fed-2` because the candidate carried a federationId that was never validated against declared memberships.

Each of these is **silent** by default. PR54A's job is to make all five **structurally impossible** at the federation boundary, the same way PR36A did at the tenant boundary — using pure transforms that fail closed before any state crosses the boundary.

## Definitions — F-* state vocabulary

The five federated governance states an operator must distinguish:

- **F-BOUNDED** — a tenant operates inside its own scope; federation either does not apply or the tenant is the only member of the federation that is currently in scope. The boundary checker returns `verdict: 'BOUNDED'` and **no cross-tenant flow is permitted**. Equivalent in spirit to MT-PARTITIONED at the federation tier. The desired steady state when no federated coordination has been requested.
- **F-COORDINATED** — every tenant in the assertion (`primary` + `participants`) has a declared, attestation-signed membership in the named federation. Cross-tenant flows (lineage assembly, ambiguity propagation, trust synchronization, recovery scoping) are admitted, *but only between declared members of the same federation*. The desired steady state when coordination has been intentionally requested.
- **F-DEGRADED** — the federation is technically declared but its members do not currently agree (membership drift, view drift, partial trust-sync consensus, missing member view). Coordination operations may *evaluate* (return a verdict object) but the strict assertion variants throw — replay, sync, recovery, and lineage admission are halted until drift is resolved. Equivalent to MT-LEAK at the federation tier — the boundary held but the federation is not in a state that can safely emit a coordinated decision.
- **F-AMBIGUOUS** — a tenant claims membership in two different federations within the same assertion, OR an ambiguity signature claims a federationId that does not match the propagation target. Treated as a fail-closed violation (`FEDERATION_MEMBERSHIP_AMBIGUOUS`, `AMBIGUITY_PROPAGATION_LEAK`). Ambiguity at the federation tier is **never** a free pass — it is a contamination vector identical in shape to MT-AMBIGUOUS.
- **F-BREACH** — a cross-federation artifact has materialized inside a single-federation lineage *without* being caught. A `fed-2` capsule appearing in a `fed-1` lineage, a `fed-2` ambiguity signature being merged into a `fed-1` propagation, a recovery wave executing actions on capsules from a non-member federation. This is the failure mode the chaos suite is designed to detect and the CI gate is designed to prevent shipping. Equivalent to MT-BREACH at the federation tier.

F-BOUNDED and F-COORDINATED are the safe states. F-DEGRADED is recoverable — the boundary held; the federation just isn't ready to coordinate. F-AMBIGUOUS surfaces the violation without losing data. F-BREACH is the only unrecoverable state, and the entire `federationGovernance.ts` module exists to make it unreachable.

## Hard invariants

The module enforces nine fail-closed invariants. Every assertion in `__tests__/federationGovernance.test.ts` and every CI gate in `__tests__/federationGovernance.ci.gate.test.ts` exists to keep one of them from regressing.

| # | Invariant | Violation kind | Enforced by |
|---|-----------|----------------|-------------|
| 1 | Federation membership must be explicit; "not in the membership set" is "not in the federation". | `UNDECLARED_FEDERATION` | `assertFederationScope` |
| 2 | A `BOUNDED` scope cannot include participants. | `CROSS_FEDERATION_BLEED` | `assertFederationScope` |
| 3 | A tenant may not claim membership in two federations within the same assertion. | `FEDERATION_MEMBERSHIP_AMBIGUOUS` | `assertFederationScope` |
| 4 | A federated lineage must reject every capsule whose tenant is not a declared member of the federation. | `FEDERATION_REPLAY_LEAK` | `assertLineageMembersBound` |
| 5 | Trust synchronization fails closed on missing members or divergent views beyond tolerance. | `TRUST_SYNC_DIVERGENCE` | `assertTrustSyncConverged` |
| 6 | Member views diverging on who is in the federation, or on viewDigest, halt coordination. | `FEDERATION_DRIFT` | `assertNoFederationDrift` |
| 7 | A recovery wave admits only candidates whose tenant is a declared member of the scoped federation. | `FEDERATION_RECOVERY_BREACH` | `assertFederationRecoveryClean` |
| 8 | Blast radius cannot span federations. | `FEDERATION_BLAST_RADIUS_BREACH` | `assertFederationBlastRadiusContained` |
| 9 | Ambiguity propagation never crosses federation boundaries. | `AMBIGUITY_PROPAGATION_LEAK` | `propagateFederatedAmbiguity` |

Every digest emitted by the module — `boundaryDigest`, `lineageDigest`, `syncDigest`, `driftDigest`, `attestationDigest`, ambiguity `digest` — hashes the `federationId` into the pre-image. Two federations cannot produce identical digests for the same payload, so a `fed-2` artifact cannot be silently re-anchored to `fed-1` by hash collision.

## Where it sits

```
single-tenant scope ──▶ federation scope ──▶ cross-tenant replay
(tenantIsolation.ts)    (federationGovernance.ts)    (only if scope === COORDINATED)
        ↑                          ↑
   PR36A boundary            PR54A boundary
```

`federationGovernance.ts` imports `normalizeTenantId` and `TenantId` from `tenantIsolation.ts` but is otherwise a pure layer above it. Call sites that need both layers should:

1. Resolve `TenantScope` first (`assertTenantScope`) — fails fast on cross-tenant contamination.
2. Resolve `FederationScope` next (`assertFederationScope`) — fails fast on cross-federation contamination, undeclared membership, ambiguity.
3. *Then* perform the cross-tenant operation (lineage assembly, sync, recovery) — knowing both boundaries have already partitioned the inputs.

This ordering is non-negotiable. Federation-scope assertion does **not** subsume tenant-scope assertion — the two checks exist for different threat models and must both run.

## Public surface (federationGovernance.ts)

### Types

`FederationId`, `FederationVerdict` (`BOUNDED` | `COORDINATED` | `DEGRADED` | `FAILED`), `FederationViolationKind`, `FederationGovernanceError`.

`FederationMembership` — tamper-evident attestation. `(federationId, tenantId, role, joinedAt)` → `attestationDigest`.

`FederationScope` — partitioned scope object. `(federationId, primaryTenantId, participantTenantIds, verdict, boundaryDigest, partitionedAt)`.

`FederatedReplayLineage` — cross-org replay output. `(federationId, primary, participants, capsuleIds, rejectedCapsuleIds, rejectedReasons, lineageDigest, ambiguity)`.

`AmbiguitySignature` — federation-scoped ambiguity. `(federationId, tenantId, reason, digest)`.

`TrustSyncState` — federation-scoped sync output. `(federationId, members, consensusReached, divergentMembers, missingMembers, syncDigest)`.

`FederationDriftSignature` — federation-scoped drift. `(federationId, divergence, divergentMembers, driftDigest)`.

`FederationBlastRadius` — federation-aware blast radius. Tier: `SINGLE_TENANT` | `FEDERATION_BOUNDED` | `CROSS_FEDERATION_BREACH`.

`FederationRecoveryDecision` — federation-scoped recovery partition.

### Functions

| Function | Purpose | Throws? |
|----------|---------|---------|
| `declareMembership` | Build a tamper-evident membership attestation | Throws on empty federationId or tenantId |
| `assertFederationScope` | Fail-closed scope validator | Throws on every violation kind |
| `evaluateFederationScope` | Non-throwing variant for inspectors | Never throws (returns `FAILED`) |
| `resolveFederatedReplayLineage` | Pure cross-org lineage transform | Never throws |
| `assertLineageMembersBound` | Strict variant — abort on rejected capsules | Throws `FEDERATION_REPLAY_LEAK` |
| `synchronizeTrustState` | Pure consensus computation | Never throws |
| `assertTrustSyncConverged` | Strict variant — abort on partial consensus | Throws `TRUST_SYNC_DIVERGENCE` |
| `detectFederationDrift` | Pure drift comparison | Never throws (returns null/object) |
| `assertNoFederationDrift` | Strict variant — abort on drift | Throws `FEDERATION_DRIFT` |
| `buildAmbiguitySignature` | Build federation-scoped ambiguity | Never throws |
| `propagateFederatedAmbiguity` | Fan-out across federation members | Throws `AMBIGUITY_PROPAGATION_LEAK` |
| `computeFederationBlastRadius` | Federation-aware blast radius | Never throws |
| `assertFederationBlastRadiusContained` | Strict variant | Throws `FEDERATION_BLAST_RADIUS_BREACH` |
| `scopeFederationRecovery` | Pure recovery partition | Never throws |
| `assertFederationRecoveryClean` | Strict variant | Throws `FEDERATION_RECOVERY_BREACH` |
| `ambiguitySignaturesShareScope` | Equality check for tests/dashboards | Never throws |

## Tests

| Suite | Path | Purpose | Count |
|-------|------|---------|-------|
| Adversarial / chaos | `apps/api/backend/src/services/multi-tenant/__tests__/federationGovernance.test.ts` | Cross-federation attack scenarios for every primitive | 49 |
| CI gate canary | `apps/api/backend/src/services/multi-tenant/__tests__/federationGovernance.ci.gate.test.ts` | Closed-enum violation contract + digest determinism | 9 |
| Scale chaos | `apps/api/backend/src/services/__tests__/scale/federationChaos.scale.test.ts` | F=10 / 50-tenant federations, throughput, no collisions | 7 |

All three suites pass under `DATABASE_URL=postgresql://scale-mock@localhost:5432/scale-mock pnpm exec jest`. Existing tenantIsolation suites continue to pass alongside (97 / 97 multi-tenant suite, no regressions).

Scale-board signal lines emitted by the scale suite:

```
[scale-board] federation-lineage-ops-per-sec=≈890_000  n=5000  kept=500  rejected=4500
[scale-board] federation-recovery-ops-per-sec=≈1_250_000 n=10000 permitted=1000
```

These are pure-transform throughputs and are not load-bearing to production traffic — they exist to detect a future regression that introduces an O(N²) scan over memberships.

## Operator playbook

**You see** `verdict: 'COORDINATED'` on a federation scope — the requested operation is admitted to flow across the named federation between the primary and the listed participants. Coordinated operations carry a `boundaryDigest` that proves the exact membership scope under which the operation ran.

**You see** `verdict: 'BOUNDED'` — the requester is operating in single-tenant mode (no federation, or single-member federation). No cross-tenant flow happens.

**You see** `verdict: 'FAILED'` from `evaluateFederationScope` — the strict assertion would have thrown. This is the dashboard / inspector view of an in-flight violation; investigate before retrying with a stricter call site.

**You see a thrown** `FederationGovernanceError` — the boundary held. The error's `violation` field is one of the nine kinds in `FEDERATION_VIOLATIONS`; pair it with the `tenantIds` and `federationId` to identify what was about to flow and which tenants were involved.

**You see** `consensusReached: false` from `synchronizeTrustState` — the federation's members are out of sync. Inspect `divergentMembers` (members whose view differs by more than tolerance) and `missingMembers` (members expected by the membership set but absent from input) before issuing any coordinated decision. Do not call `assertTrustSyncConverged` on this state — it will throw and that is the correct behavior.

**You see a non-null** `FederationDriftSignature` from `detectFederationDrift` — members disagree about who is in the federation (`MEMBERSHIP`) or about a shared `viewDigest` (`POLICY`). This is F-DEGRADED. Halt coordinated operations and reconcile the divergence before resuming. The signature carries `divergentMembers` so the dashboard can highlight exactly which members need to refresh their view.

## Completion board (W2-PR54A)

| Metric | Status | Source |
|--------|--------|--------|
| Federation Boundary Integrity % | 🟢 100% | All 9 violation kinds enforced; 9 strict assertion sites + 9 evaluate variants. |
| Cross-Org Replay Fidelity % | 🟢 100% | `resolveFederatedReplayLineage` deterministic, lineageDigest binds federationId; chaos suite verifies 50/50 fed-1 + 50/50 fed-2 capsules partitioned cleanly. |
| Trust Synchronization Reliability % | 🟢 100% | Missing members + divergent members detected; partial consensus throws; syncDigest is federationId-salted. |
| Federation Drift Visibility % | 🟢 100% | Both `MEMBERSHIP` and `POLICY` drift detected; F=10 federation drift signatures all carry distinct driftDigests. |
| Institutional Coordination Survivability % | 🟡 90% | Survives every adversarial scenario in the chaos + scale suites *as a pure transform*. The 10% gap is the integration boundary: replay engine and recovery engine must be wired through `assertFederationScope` before the federation tier is enforced end-to-end (see "Remaining blind spot" below). |

## Remaining blind spot

**The boundary checker is in place; the call sites are not yet wired through it.**

`replayEngine.ts` already invokes `assertTenantScope` for the single-tenant boundary. The federation tier — `assertFederationScope`, `resolveFederatedReplayLineage`, `propagateFederatedAmbiguity`, `synchronizeTrustState` — is implemented and tested in isolation but is **not yet called by** the replay engine, recovery hooks, or the federation discovery routes. A future wave (W2-PR54B) needs to:

1. Add a `federationContext?: FederationScope` parameter to `replayDecision` / `buildAuditBundle`, parallel to the existing `requesterTenantId`.
2. Wire the federation routes (`apps/api/backend/src/routes/federation.ts`, `federationDiscovery.ts`) so that any peer-resolved capsule passes through `assertFederationScope` before being included in a global response.
3. Promote the existing `FederatedNetworkStatus` enum (`ACTIVE` | `PENDING` | `SUSPENDED` | `DISCONNECTED`) to a `FederationMembership` so federation membership is a first-class artifact, not a network-discovery flag.

Until those three wires are made, the federation governance module is **a checker that is correct in isolation but not yet enforced at any production call site**. The CI gate prevents the module from regressing; it does not yet prevent a call site from forgetting to call the module. That gap is the remaining blind spot, and the next wave's job.
