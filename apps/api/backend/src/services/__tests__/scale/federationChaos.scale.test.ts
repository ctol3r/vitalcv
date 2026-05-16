/**
 * W2-PR54A — Federated Governance Coordination (scale gate)
 *
 * Drives the federation governance primitives across high-volume
 * cross-org workloads to surface throughput collapses, digest collisions,
 * and silent boundary leaks at scale.
 *
 * Invariants the gate exists to protect:
 *
 *   1. lineage throughput — resolveFederatedReplayLineage stays linear in
 *      the input size at N≈5000 capsules across F=10 federations, with no
 *      digest collisions across federations.
 *   2. boundary integrity at scale — across F=10 federations × T=10 tenants
 *      each, every cross-federation capsule is rejected from the lineage,
 *      and no rejection leaks into a sibling federation's permitted set.
 *   3. ambiguity propagation containment — propagating an ambiguity across
 *      a 50-tenant federation never produces a signature carrying a foreign
 *      federationId, even when foreign memberships are mixed into the input.
 *   4. drift detection at scale — for F=10 federations each running a
 *      MEMBERSHIP-disagreement scenario, each drift signature carries a
 *      distinct driftDigest and divergent-member set.
 *   5. recovery scoping at scale — a 10 000-candidate recovery wave with
 *      candidates randomly assigned to F=10 federations admits exactly the
 *      candidates of the scoped federation and no others.
 *
 * Stays within the `__tests__/scale/` budget — the suite is run by
 * `pnpm --filter @vitalcv/api-backend test:scale` against the scale-mock
 * database; the federation governance primitives are pure transforms so
 * the database is unused but the harness conventions still apply.
 */

import {
  declareMembership,
  detectFederationDrift,
  buildAmbiguitySignature,
  propagateFederatedAmbiguity,
  resolveFederatedReplayLineage,
  scopeFederationRecovery,
  synchronizeTrustState,
  type FederationMembership,
} from '../../multi-tenant/federationGovernance';

const FEDERATION_COUNT = 10;
const TENANTS_PER_FEDERATION = 10;

function buildMemberships(): FederationMembership[] {
  const memberships: FederationMembership[] = [];
  for (let f = 0; f < FEDERATION_COUNT; f++) {
    for (let t = 0; t < TENANTS_PER_FEDERATION; t++) {
      memberships.push(
        declareMembership({
          federationId: `fed-${f}`,
          tenantId: `fed-${f}-tenant-${t}`,
          role: 'member',
          joinedAt: '2026-01-01T00:00:00Z',
        }),
      );
    }
  }
  return memberships;
}

describe('federationGovernance scale (W2-PR54A scale gate)', () => {
  const memberships = buildMemberships();

  it('resolves a 5000-capsule lineage with zero cross-federation leakage', () => {
    const N = 5000;
    const capsules = Array.from({ length: N }, (_, i) => {
      const f = i % FEDERATION_COUNT;
      const t = i % TENANTS_PER_FEDERATION;
      return {
        id: `cap-${i}`,
        verifierOrgId: `fed-${f}-tenant-${t}`,
      };
    });

    const start = process.hrtime.bigint();
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-3',
      primaryTenantId: 'fed-3-tenant-0',
      capsules,
      memberships,
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const opsPerSec = (N / elapsedMs) * 1000;

    // Capsules with f === 3 (i % 10 === 3) belong to fed-3.
    const expectedFed3 = capsules.filter(c => c.verifierOrgId.startsWith('fed-3-')).length;
    expect(lineage.capsuleIds).toHaveLength(expectedFed3);
    expect(lineage.rejectedCapsuleIds).toHaveLength(N - expectedFed3);
    expect(lineage.capsuleIds.every(id => {
      const i = Number(id.replace('cap-', ''));
      return i % FEDERATION_COUNT === 3;
    })).toBe(true);
    expect(elapsedMs).toBeLessThan(5_000);

    // eslint-disable-next-line no-console
    console.log(`[scale-board] federation-lineage-ops-per-sec=${opsPerSec.toFixed(0)} n=${N} kept=${lineage.capsuleIds.length} rejected=${lineage.rejectedCapsuleIds.length}`);
  });

  it('lineageDigests across F=10 federations are all distinct (no collisions)', () => {
    const digests = new Set<string>();
    for (let f = 0; f < FEDERATION_COUNT; f++) {
      const lineage = resolveFederatedReplayLineage({
        federationId: `fed-${f}`,
        primaryTenantId: `fed-${f}-tenant-0`,
        capsules: [{ id: 'shared-capsule-id', verifierOrgId: `fed-${f}-tenant-0` }],
        memberships,
      });
      digests.add(lineage.lineageDigest);
    }
    expect(digests.size).toBe(FEDERATION_COUNT);
  });

  it('propagates ambiguity across a 50-tenant federation with zero foreign-federation leak', () => {
    const bigFederationId = 'fed-big';
    const bigMembers: FederationMembership[] = Array.from({ length: 50 }, (_, i) =>
      declareMembership({
        federationId: bigFederationId,
        tenantId: `big-tenant-${i}`,
        role: 'member',
        joinedAt: '2026-01-01T00:00:00Z',
      }),
    );
    const allMemberships = [...memberships, ...bigMembers];
    const source = buildAmbiguitySignature({
      federationId: bigFederationId,
      tenantId: 'big-tenant-0',
      reason: 'UNRESOLVED_TRUST',
      payload: { evidence: 'multi-tenant ambiguity probe' },
    });
    const propagated = propagateFederatedAmbiguity({
      federationId: bigFederationId,
      source,
      memberships: allMemberships,
    });
    expect(propagated).toHaveLength(50);
    expect(propagated.every(p => p.federationId === bigFederationId)).toBe(true);
    // Per-tenant digests are all distinct.
    expect(new Set(propagated.map(p => p.digest)).size).toBe(propagated.length);
  });

  it('detects MEMBERSHIP drift across F=10 federations with all-distinct driftDigests', () => {
    const driftDigests = new Set<string>();
    for (let f = 0; f < FEDERATION_COUNT; f++) {
      const drift = detectFederationDrift({
        federationId: `fed-${f}`,
        memberViews: [
          { tenantId: 'A', observedMembers: ['A', 'B', 'C'], viewDigest: 'd1', emittedAt: 'now' },
          { tenantId: 'B', observedMembers: ['A', 'B'],      viewDigest: 'd1', emittedAt: 'now' },
        ],
      });
      expect(drift).not.toBeNull();
      driftDigests.add(drift!.driftDigest);
    }
    expect(driftDigests.size).toBe(FEDERATION_COUNT);
  });

  it('scopes a 10 000-candidate recovery wave admitting only the scoped federation', () => {
    const N = 10_000;
    const candidates = Array.from({ length: N }, (_, i) => {
      const f = i % FEDERATION_COUNT;
      const t = i % TENANTS_PER_FEDERATION;
      return {
        id: `cap-${i}`,
        verifierOrgId: `fed-${f}-tenant-${t}`,
        federationId: `fed-${f}`,
      };
    });

    const start = process.hrtime.bigint();
    const decision = scopeFederationRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeFederationId: 'fed-7',
      scopeTenantId: 'fed-7-tenant-0',
      candidates,
      memberships,
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    const expectedKept = candidates.filter(c => c.federationId === 'fed-7').length;
    expect(decision.permittedCapsuleIds).toHaveLength(expectedKept);
    expect(decision.rejectedCapsuleIds).toHaveLength(N - expectedKept);
    expect(decision.permittedCapsuleIds.every(id => {
      const i = Number(id.replace('cap-', ''));
      return i % FEDERATION_COUNT === 7;
    })).toBe(true);
    expect(elapsedMs).toBeLessThan(5_000);

    // eslint-disable-next-line no-console
    console.log(`[scale-board] federation-recovery-ops-per-sec=${((N / elapsedMs) * 1000).toFixed(0)} n=${N} permitted=${decision.permittedCapsuleIds.length}`);
  });

  it('synchronizes trust state across F=10 federations with consensus per federation', () => {
    for (let f = 0; f < FEDERATION_COUNT; f++) {
      const expectedMembers = Array.from({ length: TENANTS_PER_FEDERATION }, (_, t) => `fed-${f}-tenant-${t}`);
      const memberViews = expectedMembers.map(t => ({
        tenantId: t,
        trustScore: 0.9,
        trustBand: 'HIGH',
        capturedAt: 'now',
      }));
      const state = synchronizeTrustState({
        federationId: `fed-${f}`,
        expectedMembers,
        memberViews,
        tolerance: { trustScoreEpsilon: 0.05 },
      });
      expect(state.consensusReached).toBe(true);
      expect(state.divergentMembers).toHaveLength(0);
      expect(state.missingMembers).toHaveLength(0);
    }
  });

  it('CHAOS: sync state with 1 divergent member per federation never reaches consensus', () => {
    let totalDivergent = 0;
    for (let f = 0; f < FEDERATION_COUNT; f++) {
      const expectedMembers = Array.from({ length: TENANTS_PER_FEDERATION }, (_, t) => `fed-${f}-tenant-${t}`);
      const memberViews = expectedMembers.map((t, i) => ({
        tenantId: t,
        trustScore: i === 0 ? 0.1 : 0.9, // tenant-0 diverges
        trustBand: 'HIGH',
        capturedAt: 'now',
      }));
      const state = synchronizeTrustState({
        federationId: `fed-${f}`,
        expectedMembers,
        memberViews,
        tolerance: { trustScoreEpsilon: 0.05 },
      });
      expect(state.consensusReached).toBe(false);
      totalDivergent += state.divergentMembers.length;
    }
    // Each federation reports >= 2 divergent members (the divergent one + at least one of its peers).
    expect(totalDivergent).toBeGreaterThanOrEqual(FEDERATION_COUNT * 2);
  });
});
