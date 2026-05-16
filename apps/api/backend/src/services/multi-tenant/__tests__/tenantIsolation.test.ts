/**
 * Multi-Tenant Governance Isolation — Chaos Tests (W2-PR36A)
 *
 * Adversarial tests that exercise every cross-tenant attack the isolation
 * primitives are meant to prevent: replay leakage, ambiguous-tenant reads,
 * recovery leak, blast-radius breach, and drift bleedover.
 *
 * Every assertion in this file is fail-closed — if a primitive ever stops
 * throwing on a hostile input, this suite breaks the build.
 */

import {
  TenantIsolationError,
  assertTenantScope,
  assertBlastRadiusContained,
  assertRecoveryScopeClean,
  assertDriftSignaturesSameTenant,
  buildTenantDriftSignature,
  computeBlastRadius,
  driftSignaturesShareTenant,
  evaluateTenantScope,
  normalizeTenantId,
  scopeRecovery,
  scopeRelatedDecisions,
  tenantBoundaryDigest,
  TENANT_SENTINELS,
} from '../tenantIsolation';

describe('tenantIsolation — replay scope validator', () => {
  it('returns OPEN when requester does not claim a tenant', () => {
    const scope = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: 'tenant-A',
      requesterTenantId: null,
    });
    expect(scope.isolationVerdict).toBe('OPEN');
    expect(scope.capsuleTenantId).toBe('tenant-A');
    expect(scope.requesterTenantId).toBeNull();
  });

  it('returns ENFORCED when requester matches capsule tenant', () => {
    const scope = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: 'tenant-A',
      requesterTenantId: 'tenant-A',
    });
    expect(scope.isolationVerdict).toBe('ENFORCED');
    expect(scope.boundaryDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws CROSS_TENANT_REPLAY when requester targets another tenant', () => {
    expect(() =>
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: 'tenant-A',
        requesterTenantId: 'tenant-B',
      }),
    ).toThrow(TenantIsolationError);

    try {
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: 'tenant-A',
        requesterTenantId: 'tenant-B',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('CROSS_TENANT_REPLAY');
      expect((e as TenantIsolationError).code).toBe('TENANT_ISOLATION_VIOLATION');
    }
  });

  it('throws AMBIGUOUS_TENANT when requester is set but capsule has no anchor', () => {
    try {
      assertTenantScope({
        capsuleId: 'cap-X',
        capsuleTenantId: null,
        requesterTenantId: 'tenant-A',
      });
      fail('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('AMBIGUOUS_TENANT');
    }
  });

  it('treats whitespace-only tenant ids as null (no silent acceptance)', () => {
    expect(normalizeTenantId('   ')).toBeNull();
    expect(normalizeTenantId('')).toBeNull();
    expect(normalizeTenantId(undefined)).toBeNull();
    expect(normalizeTenantId(42)).toBeNull();

    // Whitespace requester does not acquire a tenant boundary by accident.
    const scope = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: 'tenant-A',
      requesterTenantId: '   ',
    });
    expect(scope.isolationVerdict).toBe('OPEN');
  });

  it('boundary digest changes on any field — tamper-evident', () => {
    const a = tenantBoundaryDigest({ capsuleId: 'c1', capsuleTenantId: 'A', requesterTenantId: 'A' });
    const b = tenantBoundaryDigest({ capsuleId: 'c1', capsuleTenantId: 'A', requesterTenantId: 'B' });
    const c = tenantBoundaryDigest({ capsuleId: 'c2', capsuleTenantId: 'A', requesterTenantId: 'A' });
    const d = tenantBoundaryDigest({ capsuleId: 'c1', capsuleTenantId: null, requesterTenantId: null });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it('evaluateTenantScope returns FAILED instead of throwing', () => {
    const verdict = evaluateTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: 'tenant-A',
      requesterTenantId: 'tenant-B',
    });
    expect(verdict.isolationVerdict).toBe('FAILED');
  });
});

describe('tenantIsolation — replay lineage scoping', () => {
  it('drops cross-tenant decisions from the timeline (default fail-closed)', () => {
    const decisions = [
      { id: 'd1', verifierOrgId: 'tenant-A' },
      { id: 'd2', verifierOrgId: 'tenant-B' },
      { id: 'd3', verifierOrgId: 'tenant-A' },
      { id: 'd4', verifierOrgId: null }, // un-anchored
    ];
    const scoped = scopeRelatedDecisions(decisions, 'tenant-A');
    expect(scoped.map(d => d.id)).toEqual(['d1', 'd3']);
  });

  it('un-anchored capsule keeps only un-anchored decisions (no mixing)', () => {
    const decisions = [
      { id: 'd1', verifierOrgId: 'tenant-A' },
      { id: 'd2', verifierOrgId: null },
      { id: 'd3', verifierOrgId: '' }, // whitespace → null
    ];
    const scoped = scopeRelatedDecisions(decisions, null);
    expect(scoped.map(d => d.id).sort()).toEqual(['d2', 'd3']);
  });
});

describe('tenantIsolation — blast-radius segmentation', () => {
  it('SINGLE_DECISION when no related capsules', () => {
    const r = computeBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      affectedCapsules: [],
    });
    expect(r.tier).toBe('SINGLE_DECISION');
    expect(r.partitioned).toBe(true);
  });

  it('SINGLE_TENANT when every affected capsule shares the trigger tenant', () => {
    const r = computeBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      affectedCapsules: [
        { id: 'c2', verifierOrgId: 'tenant-A' },
        { id: 'c3', verifierOrgId: 'tenant-A' },
      ],
    });
    expect(r.tier).toBe('SINGLE_TENANT');
    expect(r.partitioned).toBe(true);
    expect(r.affectedTenantIds).toEqual(['tenant-A']);
  });

  it('CROSS_TENANT_CONTAINMENT_BREACH when capsules span tenants', () => {
    const r = computeBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      affectedCapsules: [
        { id: 'c2', verifierOrgId: 'tenant-A' },
        { id: 'c3', verifierOrgId: 'tenant-B' },
      ],
    });
    expect(r.tier).toBe('CROSS_TENANT_CONTAINMENT_BREACH');
    expect(r.partitioned).toBe(false);
    expect(r.affectedTenantIds).toEqual(['tenant-A', 'tenant-B']);
  });

  it('un-anchored capsule mixed with anchored capsule is also a breach', () => {
    const r = computeBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      affectedCapsules: [
        { id: 'c2', verifierOrgId: null },
      ],
    });
    expect(r.tier).toBe('CROSS_TENANT_CONTAINMENT_BREACH');
    expect(r.affectedTenantIds).toContain(TENANT_SENTINELS.NO_TENANT);
  });

  it('assertBlastRadiusContained throws BLAST_RADIUS_BREACH on breach', () => {
    const r = computeBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      affectedCapsules: [{ id: 'c2', verifierOrgId: 'tenant-B' }],
    });
    try {
      assertBlastRadiusContained(r);
      fail('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('BLAST_RADIUS_BREACH');
    }
  });

  it('assertBlastRadiusContained passes on partitioned radius', () => {
    const r = computeBlastRadius({
      triggerCapsuleId: 'cap-1',
      triggerTenantId: 'tenant-A',
      affectedCapsules: [{ id: 'c2', verifierOrgId: 'tenant-A' }],
    });
    expect(() => assertBlastRadiusContained(r)).not.toThrow();
  });
});

describe('tenantIsolation — scoped recovery semantics', () => {
  it('partitions candidates by tenant', () => {
    const decision = scopeRecovery({
      triggerCapsuleId: 'cap-1',
      scopeTenantId: 'tenant-A',
      candidates: [
        { id: 'c1', verifierOrgId: 'tenant-A' },
        { id: 'c2', verifierOrgId: 'tenant-B' },
        { id: 'c3', verifierOrgId: 'tenant-A' },
        { id: 'c4', verifierOrgId: null },
      ],
    });
    expect(decision.permittedCapsuleIds).toEqual(['c1', 'c3']);
    expect(decision.rejectedCapsuleIds).toEqual(['c2', 'c4']);
  });

  it('un-anchored scope only permits un-anchored candidates', () => {
    const decision = scopeRecovery({
      triggerCapsuleId: 'cap-1',
      scopeTenantId: null,
      candidates: [
        { id: 'c1', verifierOrgId: null },
        { id: 'c2', verifierOrgId: 'tenant-A' },
      ],
    });
    expect(decision.permittedCapsuleIds).toEqual(['c1']);
    expect(decision.rejectedCapsuleIds).toEqual(['c2']);
  });

  it('assertRecoveryScopeClean throws RECOVERY_LEAK when a candidate is rejected', () => {
    const decision = scopeRecovery({
      triggerCapsuleId: 'cap-1',
      scopeTenantId: 'tenant-A',
      candidates: [{ id: 'c2', verifierOrgId: 'tenant-B' }],
    });
    try {
      assertRecoveryScopeClean(decision);
      fail('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('RECOVERY_LEAK');
    }
  });

  it('assertRecoveryScopeClean passes when every candidate matches', () => {
    const decision = scopeRecovery({
      triggerCapsuleId: 'cap-1',
      scopeTenantId: 'tenant-A',
      candidates: [{ id: 'c2', verifierOrgId: 'tenant-A' }],
    });
    expect(() => assertRecoveryScopeClean(decision)).not.toThrow();
  });
});

describe('tenantIsolation — drift separation', () => {
  it('two tenants with identical drift payloads produce DIFFERENT signatures', () => {
    const sigA = buildTenantDriftSignature({
      tenantId: 'tenant-A',
      driftSeverity: 'HARD_DRIFT',
      source: 'OIG_LEIE',
      payload: { reason: 'EXCLUDED' },
    });
    const sigB = buildTenantDriftSignature({
      tenantId: 'tenant-B',
      driftSeverity: 'HARD_DRIFT',
      source: 'OIG_LEIE',
      payload: { reason: 'EXCLUDED' },
    });
    expect(sigA.signature).not.toBe(sigB.signature);
    expect(driftSignaturesShareTenant(sigA, sigB)).toBe(false);
  });

  it('same tenant + same payload reproduces the same signature (deterministic)', () => {
    const sig1 = buildTenantDriftSignature({
      tenantId: 'tenant-A',
      driftSeverity: 'HARD_DRIFT',
      source: 'OIG_LEIE',
      payload: { reason: 'EXCLUDED' },
    });
    const sig2 = buildTenantDriftSignature({
      tenantId: 'tenant-A',
      driftSeverity: 'HARD_DRIFT',
      source: 'OIG_LEIE',
      payload: { reason: 'EXCLUDED' },
    });
    expect(sig1.signature).toBe(sig2.signature);
    expect(driftSignaturesShareTenant(sig1, sig2)).toBe(true);
  });

  it('null tenant collapses to NO_TENANT sentinel — never empty string', () => {
    const sig = buildTenantDriftSignature({
      tenantId: null,
      driftSeverity: 'SOFT_DRIFT',
      source: 'NPPES',
      payload: {},
    });
    expect(sig.tenantId).toBe(TENANT_SENTINELS.NO_TENANT);
    expect(sig.signature).not.toBe('');
  });

  it('assertDriftSignaturesSameTenant throws DRIFT_BLEEDOVER on cross-tenant merge', () => {
    const sigA = buildTenantDriftSignature({
      tenantId: 'tenant-A', driftSeverity: 'HARD_DRIFT', source: 'OIG_LEIE', payload: {},
    });
    const sigB = buildTenantDriftSignature({
      tenantId: 'tenant-B', driftSeverity: 'HARD_DRIFT', source: 'OIG_LEIE', payload: {},
    });
    try {
      assertDriftSignaturesSameTenant(sigA, sigB);
      fail('expected throw');
    } catch (e) {
      expect((e as TenantIsolationError).violation).toBe('DRIFT_BLEEDOVER');
    }
  });
});

describe('tenantIsolation — chaos / contamination scenarios', () => {
  it('CHAOS: tenant B replays a billion scenarios, never sees tenant A timeline', () => {
    // Simulated cross-tenant timeline mixing
    const aDecisions = Array.from({ length: 50 }, (_, i) => ({
      id: `a-${i}`, verifierOrgId: 'tenant-A',
    }));
    const bDecisions = Array.from({ length: 50 }, (_, i) => ({
      id: `b-${i}`, verifierOrgId: 'tenant-B',
    }));
    const mixed = [...aDecisions, ...bDecisions];

    const aOnly = scopeRelatedDecisions(mixed, 'tenant-A');
    const bOnly = scopeRelatedDecisions(mixed, 'tenant-B');

    expect(aOnly).toHaveLength(50);
    expect(bOnly).toHaveLength(50);
    expect(aOnly.every(d => d.id.startsWith('a-'))).toBe(true);
    expect(bOnly.every(d => d.id.startsWith('b-'))).toBe(true);
    // Total of split halves equals total — no overlap, no loss.
    expect(aOnly.length + bOnly.length).toBe(mixed.length);
  });

  it('CHAOS: hostile requester rotates tenant id mid-flight — every mutation throws', () => {
    const hostileTenants = ['tenant-X', 'tenant-Y', 'tenant-Z', 'TENANT-a'];
    for (const t of hostileTenants) {
      expect(() =>
        assertTenantScope({
          capsuleId: 'cap-A1',
          capsuleTenantId: 'tenant-A',
          requesterTenantId: t,
        }),
      ).toThrow(TenantIsolationError);
    }
  });

  it('CHAOS: drift event from one tenant cannot be merged into another lineage', () => {
    const tenants = ['tenant-A', 'tenant-B', 'tenant-C'];
    const sigs = tenants.map(t =>
      buildTenantDriftSignature({
        tenantId: t,
        driftSeverity: 'HARD_DRIFT',
        source: 'OIG_LEIE',
        payload: { exclusionId: 'shared-id' },
      }),
    );
    // Every pair must throw
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        expect(() => assertDriftSignaturesSameTenant(sigs[i], sigs[j])).toThrow(
          TenantIsolationError,
        );
      }
    }
  });

  it('CHAOS: recovery wave with ten tenants, scope = tenant-A, only A capsules permitted', () => {
    const candidates = Array.from({ length: 100 }, (_, i) => ({
      id: `cap-${i}`,
      verifierOrgId: `tenant-${String.fromCharCode(65 + (i % 10))}`, // A..J
    }));
    const decision = scopeRecovery({
      triggerCapsuleId: 'cap-trigger',
      scopeTenantId: 'tenant-A',
      candidates,
    });
    // Every 10th capsule is tenant-A
    expect(decision.permittedCapsuleIds).toHaveLength(10);
    expect(decision.rejectedCapsuleIds).toHaveLength(90);
    expect(
      decision.permittedCapsuleIds.every(id => {
        const idx = Number(id.replace('cap-', ''));
        return idx % 10 === 0;
      }),
    ).toBe(true);
  });
});
