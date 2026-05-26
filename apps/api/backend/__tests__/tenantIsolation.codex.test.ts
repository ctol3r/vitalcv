/**
 * tenantIsolation.codex.test.ts — Codex remediation regression tests
 *
 * Covers PR #421 P1 finding: the prior `assertTenantScope` returned
 * `OPEN` for a tenant-owned capsule when `requesterTenantId` was null,
 * which let any caller read another tenant's data. The fix added an
 * explicit `requesterAuthority` axis so that, by default, a tenant-owned
 * capsule cannot be read without a matching tenant id.
 */

import {
  assertTenantScope,
  evaluateTenantScope,
  TenantIsolationError,
  type RequesterAuthority,
} from '../src/services/multi-tenant/tenantIsolation';

const TENANT_A = 'org_tenant_a';
const TENANT_B = 'org_tenant_b';

describe('assertTenantScope — Codex P1 fail-closed default', () => {
  it('throws MISSING_REQUESTER_FOR_TENANT_OWNED when capsule is tenant-owned and requester + authority are unknown', () => {
    expect(() =>
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: TENANT_A,
        requesterTenantId: null,
      }),
    ).toThrow(TenantIsolationError);

    try {
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: TENANT_A,
        requesterTenantId: null,
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TenantIsolationError);
      const tie = err as TenantIsolationError;
      expect(tie.violation).toBe('MISSING_REQUESTER_FOR_TENANT_OWNED');
      expect(tie.capsuleTenantId).toBe(TENANT_A);
      expect(tie.requesterTenantId).toBeNull();
    }
  });

  it('throws MISSING_REQUESTER_FOR_TENANT_OWNED when requester is null and authority is explicitly tenant', () => {
    expect(() =>
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: TENANT_A,
        requesterTenantId: null,
        requesterAuthority: 'tenant',
      }),
    ).toThrow(TenantIsolationError);
  });

  it('returns OPEN when requester is null and authority is explicitly system (internal/admin caller)', () => {
    const scope = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: TENANT_A,
      requesterTenantId: null,
      requesterAuthority: 'system',
    });
    expect(scope.isolationVerdict).toBe('OPEN');
    expect(scope.capsuleTenantId).toBe(TENANT_A);
    expect(scope.requesterTenantId).toBeNull();
  });

  it('returns OPEN when both capsule and requester are null (no tenanted data)', () => {
    const scope = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: null,
      requesterTenantId: null,
    });
    expect(scope.isolationVerdict).toBe('OPEN');
  });

  it('returns ENFORCED when requester matches capsule', () => {
    const scope = assertTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: TENANT_A,
      requesterTenantId: TENANT_A,
      requesterAuthority: 'tenant',
    });
    expect(scope.isolationVerdict).toBe('ENFORCED');
  });

  it('throws CROSS_TENANT_REPLAY when requester does not match capsule (cannot be bypassed by authority)', () => {
    expect(() =>
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: TENANT_A,
        requesterTenantId: TENANT_B,
        requesterAuthority: 'system',
      }),
    ).toThrow(TenantIsolationError);
  });

  it('throws AMBIGUOUS_TENANT when requester is set but capsule has no owner', () => {
    expect(() =>
      assertTenantScope({
        capsuleId: 'cap-1',
        capsuleTenantId: null,
        requesterTenantId: TENANT_A,
      }),
    ).toThrow(TenantIsolationError);
  });
});

describe('evaluateTenantScope — non-throwing mirror', () => {
  it('returns FAILED verdict instead of throwing on missing requester for tenant-owned capsule', () => {
    const scope = evaluateTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: TENANT_A,
      requesterTenantId: null,
    });
    expect(scope.isolationVerdict).toBe('FAILED');
  });

  it('propagates requesterAuthority into the assert path (system still wins)', () => {
    const scope = evaluateTenantScope({
      capsuleId: 'cap-1',
      capsuleTenantId: TENANT_A,
      requesterTenantId: null,
      requesterAuthority: 'system',
    });
    expect(scope.isolationVerdict).toBe('OPEN');
  });
});

describe('requesterAuthority type surface', () => {
  it('accepts only the three documented values', () => {
    const accepted: RequesterAuthority[] = ['tenant', 'system', 'unknown'];
    expect(accepted).toHaveLength(3);
  });
});
