/**
 * Multi-Tenant Isolation — CI Gate (W2-PR36A)
 *
 * Canary suite. Every public primitive must:
 *   - throw TenantIsolationError on cross-tenant inputs (not silently allow);
 *   - export an enumerated `violation` field;
 *   - produce a deterministic, salted boundaryDigest (not collide across inputs);
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  TenantIsolationError,
  assertBlastRadiusContained,
  assertDriftSignaturesSameTenant,
  assertRecoveryScopeClean,
  assertTenantScope,
  buildTenantDriftSignature,
  computeBlastRadius,
  evaluateTenantScope,
  scopeRecovery,
  scopeRelatedDecisions,
  tenantBoundaryDigest,
  TENANT_SENTINELS,
} from '../tenantIsolation';

const KNOWN_VIOLATIONS = [
  'CROSS_TENANT_REPLAY',
  'CROSS_TENANT_BUNDLE',
  'AMBIGUOUS_TENANT',
  'DRIFT_BLEEDOVER',
  'RECOVERY_LEAK',
  'BLAST_RADIUS_BREACH',
] as const;

describe('CI gate — TenantIsolationError contract', () => {
  it('every cross-tenant primitive throws a TenantIsolationError with a known violation', () => {
    const cases: Array<{ name: string; run: () => void; expected: string }> = [
      {
        name: 'assertTenantScope cross-tenant',
        expected: 'CROSS_TENANT_REPLAY',
        run: () => assertTenantScope({
          capsuleId: 'cap-x',
          capsuleTenantId: 'A',
          requesterTenantId: 'B',
        }),
      },
      {
        name: 'assertTenantScope ambiguous',
        expected: 'AMBIGUOUS_TENANT',
        run: () => assertTenantScope({
          capsuleId: 'cap-x',
          capsuleTenantId: null,
          requesterTenantId: 'A',
        }),
      },
      {
        name: 'assertBlastRadiusContained breach',
        expected: 'BLAST_RADIUS_BREACH',
        run: () => assertBlastRadiusContained(
          computeBlastRadius({
            triggerCapsuleId: 'cap-x',
            triggerTenantId: 'A',
            affectedCapsules: [{ id: 'c2', verifierOrgId: 'B' }],
          }),
        ),
      },
      {
        name: 'assertRecoveryScopeClean leak',
        expected: 'RECOVERY_LEAK',
        run: () => assertRecoveryScopeClean(
          scopeRecovery({
            triggerCapsuleId: 'cap-x',
            scopeTenantId: 'A',
            candidates: [{ id: 'c2', verifierOrgId: 'B' }],
          }),
        ),
      },
      {
        name: 'assertDriftSignaturesSameTenant bleedover',
        expected: 'DRIFT_BLEEDOVER',
        run: () => assertDriftSignaturesSameTenant(
          buildTenantDriftSignature({
            tenantId: 'A', driftSeverity: 'HARD_DRIFT', source: 'OIG', payload: {},
          }),
          buildTenantDriftSignature({
            tenantId: 'B', driftSeverity: 'HARD_DRIFT', source: 'OIG', payload: {},
          }),
        ),
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try { c.run(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(TenantIsolationError);
      const err = caught as TenantIsolationError;
      expect(err.code).toBe('TENANT_ISOLATION_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });

  it('boundaryDigest is deterministic and unique per (capsuleId, capsuleTenantId, requesterTenantId)', () => {
    const inputs = [
      { capsuleId: 'cap-1', capsuleTenantId: 'A',  requesterTenantId: 'A' },
      { capsuleId: 'cap-1', capsuleTenantId: 'A',  requesterTenantId: 'B' },
      { capsuleId: 'cap-1', capsuleTenantId: 'B',  requesterTenantId: 'A' },
      { capsuleId: 'cap-2', capsuleTenantId: 'A',  requesterTenantId: 'A' },
      { capsuleId: 'cap-1', capsuleTenantId: null, requesterTenantId: null },
    ];
    const digests = inputs.map(tenantBoundaryDigest);
    expect(new Set(digests).size).toBe(inputs.length);

    // Reproducibility — same input twice yields same digest.
    expect(tenantBoundaryDigest(inputs[0])).toBe(digests[0]);
  });

  it('OPEN verdict carries no requester id (no implicit elevation)', () => {
    const v = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: 'A',
      requesterTenantId: null,
    });
    expect(v.isolationVerdict).toBe('OPEN');
    expect(v.requesterTenantId).toBeNull();
  });

  it('FAILED verdict from evaluateTenantScope never throws', () => {
    expect(() =>
      evaluateTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: 'A',
        requesterTenantId: 'B',
      }),
    ).not.toThrow();
  });

  it('scopeRelatedDecisions is total — input.length === permitted + dropped', () => {
    const decisions = [
      { id: 'd1', verifierOrgId: 'A' },
      { id: 'd2', verifierOrgId: 'B' },
      { id: 'd3', verifierOrgId: null },
    ];
    const a = scopeRelatedDecisions(decisions, 'A');
    const b = scopeRelatedDecisions(decisions, 'B');
    const none = scopeRelatedDecisions(decisions, null);
    expect(a.length + b.length + none.length).toBe(decisions.length);
  });

  it('NO_TENANT sentinel is the canonical placeholder — never empty string', () => {
    expect(TENANT_SENTINELS.NO_TENANT).not.toBe('');
    const sig = buildTenantDriftSignature({
      tenantId: '',
      driftSeverity: 'SOFT_DRIFT',
      source: 'NPPES',
      payload: {},
    });
    expect(sig.tenantId).toBe(TENANT_SENTINELS.NO_TENANT);
  });
});
