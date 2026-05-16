/**
 * Federated Governance Coordination — CI Gate (W2-PR54A)
 *
 * Canary suite. Every public primitive must:
 *   - throw FederationGovernanceError on cross-federation / undeclared inputs
 *     (not silently allow);
 *   - export an enumerated `violation` field drawn from FEDERATION_VIOLATIONS;
 *   - produce a deterministic, federation-salted boundaryDigest /
 *     lineageDigest / syncDigest / driftDigest that does not collide across
 *     different (federationId, payload) pairs.
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  FEDERATION_SENTINELS,
  FEDERATION_VIOLATIONS,
  FederationGovernanceError,
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
  propagateFederatedAmbiguity,
  resolveFederatedReplayLineage,
  scopeFederationRecovery,
  synchronizeTrustState,
  type FederationMembership,
} from '../federationGovernance';

const KNOWN_VIOLATIONS = [
  'UNDECLARED_FEDERATION',
  'CROSS_FEDERATION_BLEED',
  'FEDERATION_MEMBERSHIP_AMBIGUOUS',
  'FEDERATION_DRIFT',
  'FEDERATION_REPLAY_LEAK',
  'TRUST_SYNC_DIVERGENCE',
  'FEDERATION_RECOVERY_BREACH',
  'FEDERATION_BLAST_RADIUS_BREACH',
  'AMBIGUITY_PROPAGATION_LEAK',
] as const;

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

const FED_1 = ['tenant-A', 'tenant-B'].map(t => makeMembership('fed-1', t));
const FED_2 = ['tenant-X', 'tenant-Y'].map(t => makeMembership('fed-2', t));

describe('CI gate — FederationGovernanceError contract', () => {
  it('every cross-federation primitive throws a FederationGovernanceError with a known violation', () => {
    const cases: Array<{ name: string; expected: string; run: () => void }> = [
      {
        name: 'assertFederationScope BOUNDED with participants',
        expected: 'CROSS_FEDERATION_BLEED',
        run: () => assertFederationScope({
          federationId: 'fed-1', primaryTenantId: 'tenant-A', participantTenantIds: ['tenant-B'],
          memberships: FED_1, mode: 'BOUNDED',
        }),
      },
      {
        name: 'assertFederationScope COORDINATED null federationId',
        expected: 'UNDECLARED_FEDERATION',
        run: () => assertFederationScope({
          federationId: null, primaryTenantId: 'tenant-A', participantTenantIds: ['tenant-B'],
          memberships: FED_1, mode: 'COORDINATED',
        }),
      },
      {
        name: 'assertFederationScope undeclared participant',
        expected: 'UNDECLARED_FEDERATION',
        run: () => assertFederationScope({
          federationId: 'fed-1', primaryTenantId: 'tenant-A', participantTenantIds: ['tenant-Z'],
          memberships: FED_1, mode: 'COORDINATED',
        }),
      },
      {
        name: 'assertFederationScope cross-federation tenant',
        expected: 'FEDERATION_MEMBERSHIP_AMBIGUOUS',
        run: () => assertFederationScope({
          federationId: 'fed-1', primaryTenantId: 'tenant-A', participantTenantIds: ['tenant-B'],
          memberships: [...FED_1, makeMembership('fed-2', 'tenant-A')],
          mode: 'COORDINATED',
        }),
      },
      {
        name: 'assertLineageMembersBound replay leak',
        expected: 'FEDERATION_REPLAY_LEAK',
        run: () => assertLineageMembersBound(resolveFederatedReplayLineage({
          federationId: 'fed-1', primaryTenantId: 'tenant-A',
          capsules: [{ id: 'cap-X', verifierOrgId: 'tenant-X' }],
          memberships: FED_1,
        })),
      },
      {
        name: 'assertTrustSyncConverged divergence',
        expected: 'TRUST_SYNC_DIVERGENCE',
        run: () => assertTrustSyncConverged(synchronizeTrustState({
          federationId: 'fed-1', expectedMembers: ['tenant-A', 'tenant-B'],
          memberViews: [{ tenantId: 'tenant-A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' }],
          tolerance: { trustScoreEpsilon: 0.05 },
        })),
      },
      {
        name: 'assertNoFederationDrift drift',
        expected: 'FEDERATION_DRIFT',
        run: () => assertNoFederationDrift(detectFederationDrift({
          federationId: 'fed-1',
          memberViews: [
            { tenantId: 'A', observedMembers: ['A', 'B'], viewDigest: 'd1', emittedAt: 'now' },
            { tenantId: 'B', observedMembers: ['A'], viewDigest: 'd1', emittedAt: 'now' },
          ],
        })),
      },
      {
        name: 'assertFederationRecoveryClean breach',
        expected: 'FEDERATION_RECOVERY_BREACH',
        run: () => assertFederationRecoveryClean(scopeFederationRecovery({
          triggerCapsuleId: 'cap-trigger', scopeFederationId: 'fed-1', scopeTenantId: 'tenant-A',
          candidates: [{ id: 'cap-X', verifierOrgId: 'tenant-X', federationId: 'fed-2' }],
          memberships: FED_1,
        })),
      },
      {
        name: 'assertFederationBlastRadiusContained breach',
        expected: 'FEDERATION_BLAST_RADIUS_BREACH',
        run: () => assertFederationBlastRadiusContained(computeFederationBlastRadius({
          triggerCapsuleId: 'cap-1', triggerTenantId: 'tenant-A', triggerFederationId: 'fed-1',
          affectedCapsules: [{ id: 'cap-X', verifierOrgId: 'tenant-X', federationId: 'fed-2' }],
        })),
      },
      {
        name: 'propagateFederatedAmbiguity cross-federation source',
        expected: 'AMBIGUITY_PROPAGATION_LEAK',
        run: () => propagateFederatedAmbiguity({
          federationId: 'fed-2',
          source: buildAmbiguitySignature({
            federationId: 'fed-1', tenantId: 'tenant-A', reason: 'UNRESOLVED_TRUST', payload: {},
          }),
          memberships: [...FED_1, ...FED_2],
        }),
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try { c.run(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(FederationGovernanceError);
      const err = caught as FederationGovernanceError;
      expect(err.code).toBe('FEDERATION_GOVERNANCE_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });

  it('FEDERATION_VIOLATIONS export matches the canonical list — closed enum', () => {
    expect([...FEDERATION_VIOLATIONS].sort()).toEqual([...KNOWN_VIOLATIONS].sort());
  });

  it('boundaryDigest is deterministic and unique per (federationId, primary, participants, mode)', () => {
    const inputs = [
      { federationId: 'fed-1', primaryTenantId: 'A', participantTenantIds: ['B'], mode: 'COORDINATED' as const },
      { federationId: 'fed-2', primaryTenantId: 'A', participantTenantIds: ['B'], mode: 'COORDINATED' as const },
      { federationId: 'fed-1', primaryTenantId: 'B', participantTenantIds: ['A'], mode: 'COORDINATED' as const },
      { federationId: 'fed-1', primaryTenantId: 'A', participantTenantIds: ['B'], mode: 'BOUNDED' as const },
      { federationId: null,    primaryTenantId: 'A', participantTenantIds: [],    mode: 'BOUNDED' as const },
    ];
    const digests = inputs.map(federationBoundaryDigest);
    expect(new Set(digests).size).toBe(inputs.length);
    // Reproducibility — same input twice yields same digest.
    expect(federationBoundaryDigest(inputs[0])).toBe(digests[0]);
  });

  it('lineageDigest is salted by federationId — same capsules across federations are not collidable', () => {
    const memberships1 = [makeMembership('fed-1', 'tenant-A')];
    const memberships2 = [makeMembership('fed-2', 'tenant-A')];
    const a = resolveFederatedReplayLineage({
      federationId: 'fed-1', primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-1', verifierOrgId: 'tenant-A' }],
      memberships: memberships1,
    });
    const b = resolveFederatedReplayLineage({
      federationId: 'fed-2', primaryTenantId: 'tenant-A',
      capsules: [{ id: 'cap-1', verifierOrgId: 'tenant-A' }],
      memberships: memberships2,
    });
    expect(a.lineageDigest).not.toBe(b.lineageDigest);
  });

  it('syncDigest is salted by federationId', () => {
    const view = { tenantId: 'A', trustScore: 0.9, trustBand: 'HIGH', capturedAt: 'now' };
    const a = synchronizeTrustState({
      federationId: 'fed-1', expectedMembers: ['A'], memberViews: [view],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    const b = synchronizeTrustState({
      federationId: 'fed-2', expectedMembers: ['A'], memberViews: [view],
      tolerance: { trustScoreEpsilon: 0.05 },
    });
    expect(a.syncDigest).not.toBe(b.syncDigest);
  });

  it('driftDigest is salted by federationId', () => {
    const memberViews = [
      { tenantId: 'A', observedMembers: ['A', 'B'], viewDigest: 'd1', emittedAt: 'now' },
      { tenantId: 'B', observedMembers: ['A'], viewDigest: 'd1', emittedAt: 'now' },
    ];
    const f1 = detectFederationDrift({ federationId: 'fed-1', memberViews });
    const f2 = detectFederationDrift({ federationId: 'fed-2', memberViews });
    expect(f1?.driftDigest).not.toBe(f2?.driftDigest);
  });

  it('FAILED verdict from evaluateFederationScope never throws', () => {
    expect(() =>
      evaluateFederationScope({
        federationId: 'fed-1', primaryTenantId: 'tenant-A', participantTenantIds: ['tenant-Z'],
        memberships: FED_1, mode: 'COORDINATED',
      }),
    ).not.toThrow();
  });

  it('NO_FEDERATION sentinel is the canonical placeholder — never empty string', () => {
    expect(FEDERATION_SENTINELS.NO_FEDERATION).not.toBe('');
    const r = computeFederationBlastRadius({
      triggerCapsuleId: 'c', triggerTenantId: 'tenant-A', triggerFederationId: null,
      affectedCapsules: [],
    });
    expect(r.affectedFederations).toContain(FEDERATION_SENTINELS.NO_FEDERATION);
  });

  it('attestation digest is included on every declared membership and tamper-proof', () => {
    const m = makeMembership('fed-1', 'tenant-A');
    expect(m.attestationDigest).toMatch(/^[a-f0-9]{64}$/);
    // Same input twice: same digest.
    const m2 = makeMembership('fed-1', 'tenant-A');
    expect(m2.attestationDigest).toBe(m.attestationDigest);
    // Different role: different digest.
    const m3 = makeMembership('fed-1', 'tenant-A', 'arbiter');
    expect(m3.attestationDigest).not.toBe(m.attestationDigest);
  });
});
