/**
 * Federated Governance Coordination — Chaos Tests (W2-PR54A)
 *
 * Adversarial tests for every cross-federation attack the governance
 * primitives are meant to prevent: undeclared federation, cross-federation
 * bleed, ambiguous membership, drift, replay leak, sync divergence,
 * recovery breach, blast-radius breach, ambiguity propagation leak.
 *
 * Every assertion in this file is fail-closed — if a primitive ever stops
 * throwing on a hostile input, this suite breaks the build.
 */

import {
  FEDERATION_SENTINELS,
  FEDERATION_VIOLATIONS,
  FederationGovernanceError,
  ambiguitySignaturesShareScope,
  assertFederationBlastRadiusContained,
  assertFederationRecoveryClean,
  assertFederationScope,
  assertLineageMembersBound,
  assertNoFederationDrift,
  assertTrustSyncConverged,
  buildAmbiguitySignature,
  computeFederationBlastRadius,
  declareMembership,
  detectFederationDrift,
  evaluateFederationScope,
  federationBoundaryDigest,
  normalizeFederationId,
  propagateFederatedAmbiguity,
  resolveFederatedReplayLineage,
  scopeFederationRecovery,
  synchronizeTrustState,
  type FederationMembership,
} from '../federationGovernance';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMembership(
  federationId: string,
  tenantId: string,
  role: 'member' | 'observer' | 'arbiter' = 'member',
): FederationMembership {
  return declareMembership({
    federationId,
    tenantId,
    role,
    joinedAt: '2026-01-01T00:00:00Z',
  });
}

const MEMBERS_OF_F1 = ['tenant-A', 'tenant-B', 'tenant-C'].map(t => makeMembership('fed-1', t));
const MEMBERS_OF_F2 = ['tenant-X', 'tenant-Y'].map(t => makeMembership('fed-2', t));

// ── Membership declaration ────────────────────────────────────────────────────

describe('federationGovernance — membership declaration', () => {
  it('declares a tamper-evident attestation digest', () => {
    const m = declareMembership({
      federationId: 'fed-1',
      tenantId: 'tenant-A',
      role: 'member',
      joinedAt: '2026-01-01T00:00:00Z',
    });
    expect(m.attestationDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('two memberships with different roles produce different digests', () => {
    const a = makeMembership('fed-1', 'tenant-A', 'member');
    const b = makeMembership('fed-1', 'tenant-A', 'arbiter');
    expect(a.attestationDigest).not.toBe(b.attestationDigest);
  });

  it('two memberships with different federations but same tenant produce different digests', () => {
    const a = makeMembership('fed-1', 'tenant-A');
    const b = makeMembership('fed-2', 'tenant-A');
    expect(a.attestationDigest).not.toBe(b.attestationDigest);
  });

  it('rejects empty federationId or tenantId', () => {
    expect(() =>
      declareMembership({ federationId: '', tenantId: 'tenant-A', role: 'member', joinedAt: 'now' }),
    ).toThrow(FederationGovernanceError);
    expect(() =>
      declareMembership({ federationId: 'fed-1', tenantId: '   ', role: 'member', joinedAt: 'now' }),
    ).toThrow(FederationGovernanceError);
  });

  it('normalizeFederationId trims and rejects whitespace-only', () => {
    expect(normalizeFederationId(' fed-1 ')).toBe('fed-1');
    expect(normalizeFederationId('   ')).toBeNull();
    expect(normalizeFederationId('')).toBeNull();
    expect(normalizeFederationId(undefined)).toBeNull();
    expect(normalizeFederationId(42)).toBeNull();
  });
});

// ── Federation scope validator ────────────────────────────────────────────────

describe('federationGovernance — assertFederationScope', () => {
  it('BOUNDED returns BOUNDED verdict for single tenant, no federationId', () => {
    const scope = assertFederationScope({
      federationId: null,
      primaryTenantId: 'tenant-A',
      participantTenantIds: [],
      memberships: [],
      mode: 'BOUNDED',
    });
    expect(scope.verdict).toBe('BOUNDED');
    expect(scope.federationId).toBeNull();
    expect(scope.participantTenantIds).toEqual([]);
  });

  it('BOUNDED returns BOUNDED verdict for declared single member', () => {
    const scope = assertFederationScope({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      participantTenantIds: [],
      memberships: MEMBERS_OF_F1,
      mode: 'BOUNDED',
    });
    expect(scope.verdict).toBe('BOUNDED');
    expect(scope.federationId).toBe('fed-1');
  });

  it('BOUNDED throws CROSS_FEDERATION_BLEED if participants are present', () => {
    expect(() =>
      assertFederationScope({
        federationId: 'fed-1',
        primaryTenantId: 'tenant-A',
        participantTenantIds: ['tenant-B'],
        memberships: MEMBERS_OF_F1,
        mode: 'BOUNDED',
      }),
    ).toThrow(FederationGovernanceError);
  });

  it('COORDINATED returns COORDINATED verdict for declared members', () => {
    const scope = assertFederationScope({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      participantTenantIds: ['tenant-B', 'tenant-C'],
      memberships: MEMBERS_OF_F1,
      mode: 'COORDINATED',
    });
    expect(scope.verdict).toBe('COORDINATED');
    expect(scope.participantTenantIds).toEqual(['tenant-B', 'tenant-C']);
    expect(scope.boundaryDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('COORDINATED throws UNDECLARED_FEDERATION when federationId is null', () => {
    try {
      assertFederationScope({
        federationId: null,
        primaryTenantId: 'tenant-A',
        participantTenantIds: ['tenant-B'],
        memberships: MEMBERS_OF_F1,
        mode: 'COORDINATED',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('UNDECLARED_FEDERATION');
    }
  });

  it('COORDINATED throws UNDECLARED_FEDERATION for participant lacking membership', () => {
    try {
      assertFederationScope({
        federationId: 'fed-1',
        primaryTenantId: 'tenant-A',
        participantTenantIds: ['tenant-D'], // not declared in fed-1
        memberships: MEMBERS_OF_F1,
        mode: 'COORDINATED',
      });
      fail('expected throw');
    } catch (e) {
      const err = e as FederationGovernanceError;
      expect(err.violation).toBe('UNDECLARED_FEDERATION');
      expect(err.tenantIds).toContain('tenant-D');
    }
  });

  it('COORDINATED throws UNDECLARED_FEDERATION when primary lacks membership', () => {
    try {
      assertFederationScope({
        federationId: 'fed-1',
        primaryTenantId: 'tenant-X', // declared only in fed-2
        participantTenantIds: ['tenant-A'],
        memberships: [...MEMBERS_OF_F1, ...MEMBERS_OF_F2],
        mode: 'COORDINATED',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('UNDECLARED_FEDERATION');
    }
  });

  it('COORDINATED throws FEDERATION_MEMBERSHIP_AMBIGUOUS when a tenant has memberships in two federations', () => {
    const ambiguous: FederationMembership[] = [
      ...MEMBERS_OF_F1,
      makeMembership('fed-2', 'tenant-A'), // same tenant in second federation
    ];
    try {
      assertFederationScope({
        federationId: 'fed-1',
        primaryTenantId: 'tenant-A',
        participantTenantIds: ['tenant-B'],
        memberships: ambiguous,
        mode: 'COORDINATED',
      });
      fail('expected throw');
    } catch (e) {
      const err = e as FederationGovernanceError;
      expect(err.violation).toBe('FEDERATION_MEMBERSHIP_AMBIGUOUS');
      expect(err.tenantIds).toContain('tenant-A');
    }
  });

  it('boundaryDigest is unique per (federationId, primary, participants, mode)', () => {
    const a = federationBoundaryDigest({
      federationId: 'fed-1', primaryTenantId: 'A', participantTenantIds: ['B'], mode: 'COORDINATED',
    });
    const b = federationBoundaryDigest({
      federationId: 'fed-1', primaryTenantId: 'A', participantTenantIds: ['B'], mode: 'BOUNDED',
    });
    const c = federationBoundaryDigest({
      federationId: 'fed-2', primaryTenantId: 'A', participantTenantIds: ['B'], mode: 'COORDINATED',
    });
    const d = federationBoundaryDigest({
      federationId: 'fed-1', primaryTenantId: 'B', participantTenantIds: ['A'], mode: 'COORDINATED',
    });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it('participants are sorted, deduplicated, and exclude primary', () => {
    const scope = assertFederationScope({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      participantTenantIds: ['tenant-C', 'tenant-B', 'tenant-A', 'tenant-B'],
      memberships: MEMBERS_OF_F1,
      mode: 'COORDINATED',
    });
    expect(scope.participantTenantIds).toEqual(['tenant-B', 'tenant-C']);
  });

  it('evaluateFederationScope returns FAILED instead of throwing', () => {
    const scope = evaluateFederationScope({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      participantTenantIds: ['tenant-D'], // not in fed-1
      memberships: MEMBERS_OF_F1,
      mode: 'COORDINATED',
    });
    expect(scope.verdict).toBe('FAILED');
  });
});

// ── Cross-org lineage ─────────────────────────────────────────────────────────

describe('federationGovernance — resolveFederatedReplayLineage', () => {
  it('keeps capsules of federation members, drops outsiders with reasons', () => {
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [
        { id: 'cap-A1', verifierOrgId: 'tenant-A' },
        { id: 'cap-B1', verifierOrgId: 'tenant-B' },
        { id: 'cap-X1', verifierOrgId: 'tenant-X' }, // outsider
        { id: 'cap-NULL', verifierOrgId: null },     // ambiguous
      ],
      memberships: MEMBERS_OF_F1,
    });
    expect(lineage.capsuleIds).toEqual(['cap-A1', 'cap-B1']);
    expect(lineage.rejectedCapsuleIds.sort()).toEqual(['cap-NULL', 'cap-X1']);
    expect(lineage.rejectedReasons['cap-X1']).toContain('NOT_IN_FEDERATION');
    expect(lineage.rejectedReasons['cap-NULL']).toBe('AMBIGUOUS_TENANT');
  });

  it('participant list reflects ALL declared members minus primary', () => {
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-A1', verifierOrgId: 'tenant-A' }], // only one capsule
      memberships: MEMBERS_OF_F1,
    });
    expect(lineage.participantTenantIds).toEqual(['tenant-B', 'tenant-C']);
  });

  it('lineageDigest binds federationId — two federations on same capsule order produce different digests', () => {
    const lineageA = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-1', verifierOrgId: 'tenant-A' }],
      memberships: MEMBERS_OF_F1,
    });
    // Construct a fed-2 with tenant-A also as member
    const fed2WithA = [...MEMBERS_OF_F2, makeMembership('fed-2', 'tenant-A')];
    const lineageB = resolveFederatedReplayLineage({
      federationId: 'fed-2',
      primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-1', verifierOrgId: 'tenant-A' }],
      memberships: fed2WithA,
    });
    expect(lineageA.lineageDigest).not.toBe(lineageB.lineageDigest);
  });

  it('deduplicates capsule ids (keeps first occurrence)', () => {
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [
        { id: 'cap-1', verifierOrgId: 'tenant-A' },
        { id: 'cap-1', verifierOrgId: 'tenant-A' },
      ],
      memberships: MEMBERS_OF_F1,
    });
    expect(lineage.capsuleIds).toEqual(['cap-1']);
  });

  it('filters ambiguity to this federation only', () => {
    const ambiguity = [
      buildAmbiguitySignature({ federationId: 'fed-1', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: {} }),
      buildAmbiguitySignature({ federationId: 'fed-2', tenantId: 'tenant-X', reason: 'UNRESOLVED_TRUST', payload: {} }),
    ];
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [],
      memberships: MEMBERS_OF_F1,
      ambiguity,
    });
    expect(lineage.ambiguity).toHaveLength(1);
    expect(lineage.ambiguity[0].federationId).toBe('fed-1');
  });

  it('assertLineageMembersBound throws FEDERATION_REPLAY_LEAK when capsules were rejected', () => {
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-X1', verifierOrgId: 'tenant-X' }],
      memberships: MEMBERS_OF_F1,
    });
    try {
      assertLineageMembersBound(lineage);
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('FEDERATION_REPLAY_LEAK');
    }
  });

  it('assertLineageMembersBound passes on clean lineage', () => {
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-A1', verifierOrgId: 'tenant-A' }],
      memberships: MEMBERS_OF_F1,
    });
    expect(() => assertLineageMembersBound(lineage)).not.toThrow();
  });
});

// ── Trust synchronization ─────────────────────────────────────────────────────

describe('federationGovernance — synchronizeTrustState', () => {
  it('reaches consensus when every member is present and within tolerance', () => {
    const state = synchronizeTrustState({
      federationId: 'fed-1',
      expectedMembers: ['tenant-A', 'tenant-B', 'tenant-C'],
      memberViews: [
        { tenantId: 'tenant-A', trustScore: 0.91, trustBand: 'HIGH', capturedAt: 'now' },
        { tenantId: 'tenant-B', trustScore: 0.92, trustBand: 'HIGH', capturedAt: 'now' },
        { tenantId: 'tenant-C', trustScore: 0.91, trustBand: 'HIGH', capturedAt: 'now' },
      ],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(state.consensusReached).toBe(true);
    expect(state.divergentMembers).toEqual([]);
    expect(state.missingMembers).toEqual([]);
  });

  it('marks missing members when a view is absent', () => {
    const state = synchronizeTrustState({
      federationId: 'fed-1',
      expectedMembers: ['tenant-A', 'tenant-B', 'tenant-C'],
      memberViews: [
        { tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' },
      ],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(state.consensusReached).toBe(false);
    expect(state.missingMembers).toEqual(['tenant-B', 'tenant-C']);
  });

  it('marks divergent members when scores exceed tolerance', () => {
    const state = synchronizeTrustState({
      federationId: 'fed-1',
      expectedMembers: ['tenant-A', 'tenant-B'],
      memberViews: [
        { tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' },
        { tenantId: 'tenant-B', trustScore: 0.4, trustBand: 'HIGH', capturedAt: 'now' },
      ],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(state.consensusReached).toBe(false);
    expect(state.divergentMembers.sort()).toEqual(['tenant-A', 'tenant-B']);
  });

  it('marks divergent members when trustBand disagrees, even if scores match', () => {
    const state = synchronizeTrustState({
      federationId: 'fed-1',
      expectedMembers: ['tenant-A', 'tenant-B'],
      memberViews: [
        { tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' },
        { tenantId: 'tenant-B', trustScore: 0.9, trustBand: 'MEDIUM', capturedAt: 'now' },
      ],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(state.consensusReached).toBe(false);
    expect(state.divergentMembers.sort()).toEqual(['tenant-A', 'tenant-B']);
  });

  it('assertTrustSyncConverged throws TRUST_SYNC_DIVERGENCE on partial consensus', () => {
    const state = synchronizeTrustState({
      federationId: 'fed-1',
      expectedMembers: ['tenant-A', 'tenant-B'],
      memberViews: [{ tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' }],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    try {
      assertTrustSyncConverged(state);
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('TRUST_SYNC_DIVERGENCE');
    }
  });

  it('syncDigest binds federationId — two federations with same views produce different digests', () => {
    const view = { tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' };
    const a = synchronizeTrustState({
      federationId: 'fed-1', expectedMembers: ['tenant-A'], memberViews: [view],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    const b = synchronizeTrustState({
      federationId: 'fed-2', expectedMembers: ['tenant-A'], memberViews: [view],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(a.syncDigest).not.toBe(b.syncDigest);
  });
});

// ── Federation drift ──────────────────────────────────────────────────────────

describe('federationGovernance — detectFederationDrift', () => {
  it('returns null when every member agrees on membership and view', () => {
    const drift = detectFederationDrift({
      federationId: 'fed-1',
      memberViews: [
        { tenantId: 'tenant-A', observedMembers: ['tenant-A', 'tenant-B', 'tenant-C'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'tenant-B', observedMembers: ['tenant-A', 'tenant-B', 'tenant-C'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'tenant-C', observedMembers: ['tenant-A', 'tenant-B', 'tenant-C'], viewDigest: 'd1', emittedAt: 'now' },
      ],
    });
    expect(drift).toBeNull();
  });

  it('detects MEMBERSHIP drift when one member sees a different roster', () => {
    const drift = detectFederationDrift({
      federationId: 'fed-1',
      memberViews: [
        { tenantId: 'tenant-A', observedMembers: ['tenant-A', 'tenant-B', 'tenant-C'], emittedAt: 'now' },
        { tenantId: 'tenant-B', observedMembers: ['tenant-A', 'tenant-B', 'tenant-C'], emittedAt: 'now' },
        { tenantId: 'tenant-C', observedMembers: ['tenant-A', 'tenant-B'], emittedAt: 'now' }, // missing self? still divergent
      ],
    });
    expect(drift).not.toBeNull();
    expect(drift!.divergence).toBe('MEMBERSHIP');
    expect(drift!.divergentMembers).toContain('tenant-C');
  });

  it('detects POLICY drift when viewDigests differ but membership agrees', () => {
    const drift = detectFederationDrift({
      federationId: 'fed-1',
      memberViews: [
        { tenantId: 'tenant-A', observedMembers: ['tenant-A', 'tenant-B'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'tenant-B', observedMembers: ['tenant-A', 'tenant-B'], viewDigest: 'd2', emittedAt: 'now' },
      ],
    });
    expect(drift).not.toBeNull();
    expect(drift!.divergence).toBe('POLICY');
  });

  it('driftDigest binds federationId — two federations with same drift pattern produce different digests', () => {
    const f1 = detectFederationDrift({
      federationId: 'fed-1',
      memberViews: [
        { tenantId: 'A', observedMembers: ['A', 'B'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'B', observedMembers: ['A'], viewDigest: 'd1', emittedAt: 'now' },
      ],
    });
    const f2 = detectFederationDrift({
      federationId: 'fed-2',
      memberViews: [
        { tenantId: 'A', observedMembers: ['A', 'B'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'B', observedMembers: ['A'], viewDigest: 'd1', emittedAt: 'now' },
      ],
    });
    expect(f1).not.toBeNull();
    expect(f2).not.toBeNull();
    expect(f1!.driftDigest).not.toBe(f2!.driftDigest);
  });

  it('assertNoFederationDrift throws FEDERATION_DRIFT on present drift', () => {
    const drift = detectFederationDrift({
      federationId: 'fed-1',
      memberViews: [
        { tenantId: 'A', observedMembers: ['A', 'B'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'B', observedMembers: ['A', 'B', 'C'], viewDigest: 'd1', emittedAt: 'now' },
      ],
    });
    try {
      assertNoFederationDrift(drift);
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('FEDERATION_DRIFT');
    }
  });
});

// ── Ambiguity propagation ─────────────────────────────────────────────────────

describe('federationGovernance — propagateFederatedAmbiguity', () => {
  it('produces one signature per declared member of the federation', () => {
    const source = buildAmbiguitySignature({
      federationId: 'fed-1', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: { ev: 1 },
    });
    const propagated = propagateFederatedAmbiguity({
      federationId: 'fed-1',
      source,
      memberships: MEMBERS_OF_F1,
    });
    expect(propagated).toHaveLength(3);
    expect(propagated.map(p => p.tenantId).sort()).toEqual(['tenant-A', 'tenant-B', 'tenant-C']);
    expect(propagated.every(p => p.federationId === 'fed-1')).toBe(true);
  });

  it('per-tenant digests are distinct', () => {
    const source = buildAmbiguitySignature({
      federationId: 'fed-1', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: {},
    });
    const propagated = propagateFederatedAmbiguity({
      federationId: 'fed-1', source, memberships: MEMBERS_OF_F1,
    });
    const digests = new Set(propagated.map(p => p.digest));
    expect(digests.size).toBe(propagated.length);
  });

  it('throws AMBIGUITY_PROPAGATION_LEAK when propagating across federations', () => {
    const source = buildAmbiguitySignature({
      federationId: 'fed-1', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: {},
    });
    try {
      propagateFederatedAmbiguity({
        federationId: 'fed-2', // different federation
        source,
        memberships: [...MEMBERS_OF_F1, ...MEMBERS_OF_F2],
      });
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('AMBIGUITY_PROPAGATION_LEAK');
    }
  });

  it('throws AMBIGUITY_PROPAGATION_LEAK when source tenant is not a federation member', () => {
    const source = buildAmbiguitySignature({
      federationId: 'fed-1', tenantId: 'tenant-X', reason: 'UNRESOLVED_TRUST', payload: {},
    });
    try {
      propagateFederatedAmbiguity({
        federationId: 'fed-1', source, memberships: MEMBERS_OF_F1, // tenant-X not in fed-1
      });
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('AMBIGUITY_PROPAGATION_LEAK');
    }
  });

  it('ambiguitySignaturesShareScope is true only when federation AND tenant match', () => {
    const a = buildAmbiguitySignature({ federationId: 'fed-1', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: {} });
    const b = buildAmbiguitySignature({ federationId: 'fed-1', tenantId: 'tenant-A', reason: 'POLICY_DISAGREEMENT', payload: {} });
    const c = buildAmbiguitySignature({ federationId: 'fed-1', tenantId: 'tenant-B', reason: 'UNRESOLVED_TRUST', payload: {} });
    const d = buildAmbiguitySignature({ federationId: 'fed-2', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: {} });
    expect(ambiguitySignaturesShareScope(a, b)).toBe(true);
    expect(ambiguitySignaturesShareScope(a, c)).toBe(false);
    expect(ambiguitySignaturesShareScope(a, d)).toBe(false);
  });
});

// ── Blast radius (federation-aware) ───────────────────────────────────────────

describe('federationGovernance — computeFederationBlastRadius', () => {
  it('SINGLE_TENANT when every capsule shares trigger tenant and federation', () => {
    const r = computeFederationBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      triggerFederationId: 'fed-1',
      affectedCapsules: [{ id: 'cap-2', verifierOrgId: 'tenant-A', federationId: 'fed-1' }],
    });
    expect(r.tier).toBe('SINGLE_TENANT');
    expect(r.partitioned).toBe(true);
  });

  it('FEDERATION_BOUNDED when capsules span tenants but share federation', () => {
    const r = computeFederationBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      triggerFederationId: 'fed-1',
      affectedCapsules: [
        { id: 'cap-2', verifierOrgId: 'tenant-B', federationId: 'fed-1' },
        { id: 'cap-3', verifierOrgId: 'tenant-C', federationId: 'fed-1' },
      ],
    });
    expect(r.tier).toBe('FEDERATION_BOUNDED');
    expect(r.partitioned).toBe(true);
    expect(r.affectedFederations).toEqual(['fed-1']);
    expect(r.affectedTenantIds).toEqual(['tenant-A', 'tenant-B', 'tenant-C']);
  });

  it('CROSS_FEDERATION_BREACH when capsules span federations', () => {
    const r = computeFederationBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      triggerFederationId: 'fed-1',
      affectedCapsules: [{ id: 'cap-X', verifierOrgId: 'tenant-X', federationId: 'fed-2' }],
    });
    expect(r.tier).toBe('CROSS_FEDERATION_BREACH');
    expect(r.partitioned).toBe(false);
  });

  it('mixing un-anchored federation with anchored is a breach', () => {
    const r = computeFederationBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      triggerFederationId: 'fed-1',
      affectedCapsules: [{ id: 'cap-loose', verifierOrgId: 'tenant-Z', federationId: null }],
    });
    expect(r.tier).toBe('CROSS_FEDERATION_BREACH');
    expect(r.affectedFederations).toContain(FEDERATION_SENTINELS.NO_FEDERATION);
  });

  it('assertFederationBlastRadiusContained throws on breach', () => {
    const r = computeFederationBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      triggerFederationId: 'fed-1',
      affectedCapsules: [{ id: 'cap-X', verifierOrgId: 'tenant-X', federationId: 'fed-2' }],
    });
    try {
      assertFederationBlastRadiusContained(r);
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('FEDERATION_BLAST_RADIUS_BREACH');
    }
  });
});

// ── Federation recovery scoping ───────────────────────────────────────────────

describe('federationGovernance — scopeFederationRecovery', () => {
  it('partitions candidates by federation membership', () => {
    const decision = scopeFederationRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeFederationId: 'fed-1',
      scopeTenantId: 'tenant-A',
      candidates: [
        { id: 'cap-1', verifierOrgId: 'tenant-A', federationId: 'fed-1' },
        { id: 'cap-2', verifierOrgId: 'tenant-B', federationId: 'fed-1' },
        { id: 'cap-X', verifierOrgId: 'tenant-X', federationId: 'fed-2' },
        { id: 'cap-loose', verifierOrgId: 'tenant-A', federationId: null },
      ],
      memberships: MEMBERS_OF_F1,
    });
    expect(decision.permittedCapsuleIds.sort()).toEqual(['cap-1', 'cap-2']);
    expect(decision.rejectedCapsuleIds.sort()).toEqual(['cap-X', 'cap-loose']);
  });

  it('null federation scope only permits same-tenant candidates', () => {
    const decision = scopeFederationRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeFederationId: null,
      scopeTenantId: 'tenant-A',
      candidates: [
        { id: 'cap-1', verifierOrgId: 'tenant-A', federationId: null },
        { id: 'cap-2', verifierOrgId: 'tenant-B', federationId: null },
      ],
      memberships: [],
    });
    expect(decision.permittedCapsuleIds).toEqual(['cap-1']);
    expect(decision.rejectedCapsuleIds).toEqual(['cap-2']);
  });

  it('rejects candidate whose tenant is not declared in this federation', () => {
    const decision = scopeFederationRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeFederationId: 'fed-1',
      scopeTenantId: 'tenant-A',
      candidates: [{ id: 'cap-D', verifierOrgId: 'tenant-D', federationId: 'fed-1' }],
      memberships: MEMBERS_OF_F1, // tenant-D not declared
    });
    expect(decision.rejectedCapsuleIds).toEqual(['cap-D']);
    expect(decision.rejectedReasons['cap-D']).toContain('NOT_IN_fed-1');
  });

  it('assertFederationRecoveryClean throws on rejected candidate', () => {
    const decision = scopeFederationRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeFederationId: 'fed-1',
      scopeTenantId: 'tenant-A',
      candidates: [{ id: 'cap-X', verifierOrgId: 'tenant-X', federationId: 'fed-2' }],
      memberships: MEMBERS_OF_F1,
    });
    try {
      assertFederationRecoveryClean(decision);
      fail('expected throw');
    } catch (e) {
      expect((e as FederationGovernanceError).violation).toBe('FEDERATION_RECOVERY_BREACH');
    }
  });
});

// ── Chaos / contamination scenarios ───────────────────────────────────────────

describe('federationGovernance — chaos / contamination scenarios', () => {
  it('CHAOS: 50 capsules from fed-2 cannot leak into fed-1 lineage', () => {
    const fed1Capsules = Array.from({ length: 50 }, (_, i) => ({
      id: `cap-1-${i}`, verifierOrgId: 'tenant-A',
    }));
    const fed2Capsules = Array.from({ length: 50 }, (_, i) => ({
      id: `cap-2-${i}`, verifierOrgId: 'tenant-X',
    }));
    const lineage = resolveFederatedReplayLineage({
      federationId: 'fed-1',
      primaryTenantId: 'tenant-A',
      capsules: [...fed1Capsules, ...fed2Capsules],
      memberships: MEMBERS_OF_F1,
    });
    expect(lineage.capsuleIds).toHaveLength(50);
    expect(lineage.rejectedCapsuleIds).toHaveLength(50);
    expect(lineage.capsuleIds.every(id => id.startsWith('cap-1-'))).toBe(true);
  });

  it('CHAOS: hostile federation rotation — every undeclared federationId throws', () => {
    const hostileFederations = ['fed-X', 'fed-Y', 'FED-1', '  fed-1  ' /* trimmed equals fed-1, allowed */];
    for (const fid of hostileFederations) {
      const normalized = normalizeFederationId(fid);
      const isLegit = normalized === 'fed-1';
      try {
        const scope = assertFederationScope({
          federationId: fid,
          primaryTenantId: 'tenant-A',
          participantTenantIds: ['tenant-B'],
          memberships: MEMBERS_OF_F1,
          mode: 'COORDINATED',
        });
        // Whitespace-trimmed 'fed-1' should succeed; everything else should have thrown.
        expect(isLegit).toBe(true);
        expect(scope.federationId).toBe('fed-1');
      } catch (e) {
        expect(isLegit).toBe(false);
        expect(e).toBeInstanceOf(FederationGovernanceError);
      }
    }
  });

  it('CHAOS: ambiguity propagation across 3 federations never crosses boundaries', () => {
    const fedA = ['t-A1', 't-A2'].map(t => makeMembership('fA', t));
    const fedB = ['t-B1', 't-B2'].map(t => makeMembership('fB', t));
    const fedC = ['t-C1', 't-C2'].map(t => makeMembership('fC', t));
    const all = [...fedA, ...fedB, ...fedC];

    const sourceA = buildAmbiguitySignature({ federationId: 'fA', tenantId: 't-A1', reason: 'UNRESOLVED_TRUST', payload: {} });
    const propagated = propagateFederatedAmbiguity({ federationId: 'fA', source: sourceA, memberships: all });

    // Every propagated signature should be in fA, never fB or fC.
    expect(propagated.every(p => p.federationId === 'fA')).toBe(true);
    expect(propagated.map(p => p.tenantId).sort()).toEqual(['t-A1', 't-A2']);
  });

  it('CHAOS: trust sync with 10 members where 1 is wildly divergent — never reaches consensus', () => {
    const expected = Array.from({ length: 10 }, (_, i) => `t-${i}`);
    const memberViews = expected.map((t, i) => ({
      tenantId: t,
      trustScore: i === 7 ? 0.05 : 0.9, // tenant t-7 is divergent
      trustBand: 'HIGH',
      capturedAt: 'now',
    }));
    const state = synchronizeTrustState({
      federationId: 'fed-1',
      expectedMembers: expected,
      memberViews,
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(state.consensusReached).toBe(false);
    expect(state.divergentMembers).toContain('t-7');
  });

  it('CHAOS: 100 candidates split across 5 federations, scope = fed-1, only fed-1 members permitted', () => {
    const memberships: FederationMembership[] = [];
    for (let f = 0; f < 5; f++) {
      memberships.push(makeMembership(`fed-${f}`, `tenant-${f}`));
    }
    const candidates = Array.from({ length: 100 }, (_, i) => {
      const f = i % 5;
      return {
        id: `cap-${i}`,
        verifierOrgId: `tenant-${f}`,
        federationId: `fed-${f}`,
      };
    });
    const decision = scopeFederationRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeFederationId: 'fed-1',
      scopeTenantId: 'tenant-1',
      candidates,
      memberships,
    });
    // Every 5th candidate (i % 5 === 1) is in fed-1.
    expect(decision.permittedCapsuleIds).toHaveLength(20);
    expect(decision.rejectedCapsuleIds).toHaveLength(80);
  });

  it('CHAOS: drift signatures from 5 federations all carry distinct digests', () => {
    const drifts = Array.from({ length: 5 }, (_, f) => detectFederationDrift({
      federationId: `fed-${f}`,
      memberViews: [
        { tenantId: 'A', observedMembers: ['A', 'B'], viewDigest: 'd1', emittedAt: 'now' },
        { tenantId: 'B', observedMembers: ['A'], viewDigest: 'd1', emittedAt: 'now' },
      ],
    }));
    const digests = new Set(drifts.map(d => d?.driftDigest));
    expect(digests.size).toBe(drifts.length);
  });

  it('CHAOS: violations enum is closed — every error sets a known violation', () => {
    const probes: Array<() => void> = [
      () => assertFederationScope({
        federationId: 'fed-1', primaryTenantId: 'tenant-Z', participantTenantIds: [],
        memberships: MEMBERS_OF_F1, mode: 'COORDINATED',
      }),
      () => assertFederationScope({
        federationId: 'fed-1', primaryTenantId: 'tenant-A', participantTenantIds: ['tenant-B'],
        memberships: MEMBERS_OF_F1, mode: 'BOUNDED',
      }),
      () => assertLineageMembersBound(resolveFederatedReplayLineage({
        federationId: 'fed-1', primaryTenantId: 'tenant-A',
        capsules: [{ id: 'leak', verifierOrgId: 'tenant-X' }],
        memberships: MEMBERS_OF_F1,
      })),
      () => assertTrustSyncConverged(synchronizeTrustState({
        federationId: 'fed-1', expectedMembers: ['tenant-A', 'tenant-B'],
        memberViews: [{ tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' }],
        tolerance: { trustScoreEpsilon: 0.05 },
      })),
    ];
    for (const probe of probes) {
      let caught: unknown = null;
      try { probe(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(FederationGovernanceError);
      expect(FEDERATION_VIOLATIONS).toContain((caught as FederationGovernanceError).violation);
    }
  });
});
