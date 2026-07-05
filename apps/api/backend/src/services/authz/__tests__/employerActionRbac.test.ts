/**
 * Pure decision-matrix tests for employer-review mutation RBAC.
 * No DB, no network — the module is a pure transform.
 */
import {
  decideEmployerActionRbac,
  EMPLOYER_MUTATION_ALLOWED_ROLES,
} from '../employerActionRbac';

describe('decideEmployerActionRbac', () => {
  it('denies when no User row exists (header alone is not an identity)', () => {
    const decision = decideEmployerActionRbac(null);
    expect(decision.allowed).toBe(false);
    expect(decision.denialReason).toBe('rbac_unknown_user');
    expect(decision.resolvedRole).toBeNull();
  });

  it('denies CLINICIAN — a clinician must never self-accept as an employer', () => {
    const decision = decideEmployerActionRbac({ role: 'CLINICIAN', status: 'ACTIVE' });
    expect(decision.allowed).toBe(false);
    expect(decision.denialReason).toBe('rbac_role_not_permitted');
    expect(decision.resolvedRole).toBe('CLINICIAN');
  });

  it('denies ISSUER', () => {
    const decision = decideEmployerActionRbac({ role: 'ISSUER', status: 'ACTIVE' });
    expect(decision.allowed).toBe(false);
    expect(decision.denialReason).toBe('rbac_role_not_permitted');
  });

  it('allows ACTIVE VERIFIER', () => {
    const decision = decideEmployerActionRbac({ role: 'VERIFIER', status: 'ACTIVE' });
    expect(decision).toEqual({
      allowed: true,
      denialReason: null,
      resolvedRole: 'VERIFIER',
    });
  });

  it('allows ADMIN, including while still INVITED (schema default, lazy activation)', () => {
    expect(decideEmployerActionRbac({ role: 'ADMIN', status: 'ACTIVE' }).allowed).toBe(true);
    expect(decideEmployerActionRbac({ role: 'ADMIN', status: 'INVITED' }).allowed).toBe(true);
    expect(decideEmployerActionRbac({ role: 'VERIFIER', status: 'INVITED' }).allowed).toBe(true);
  });

  it('denies SUSPENDED and DEACTIVATED regardless of role', () => {
    for (const status of ['SUSPENDED', 'DEACTIVATED'] as const) {
      const decision = decideEmployerActionRbac({ role: 'ADMIN', status });
      expect(decision.allowed).toBe(false);
      expect(decision.denialReason).toBe('rbac_user_inactive');
      expect(decision.resolvedRole).toBe('ADMIN');
    }
  });

  it('pins the allowed-role set to VERIFIER + ADMIN only', () => {
    expect([...EMPLOYER_MUTATION_ALLOWED_ROLES].sort()).toEqual(['ADMIN', 'VERIFIER']);
  });
});
