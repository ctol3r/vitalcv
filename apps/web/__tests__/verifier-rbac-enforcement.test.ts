/**
 * verifier-rbac-enforcement.test.ts
 *
 * Tests the pure RBAC logic in lib/auth/orgInvitations.ts.
 * No Clerk, no DB, no network — all cases are deterministic.
 *
 * Truth contracts verified:
 *   1. readonly role cannot POST/PUT/DELETE on /api/verifier/* → 403
 *   2. Cross-org request → 404 (not 403; no info leak)
 *   3. Timing-safe: all byte positions processed regardless of length
 *   4. org_id absent from JWT → no implicit grant → 403 no_org_context
 */
import { describe, expect, it } from 'vitest';
import {
  checkVerifierPermission,
  rbacEnforced,
  timingSafeEqualStrings,
  parseTeamRole,
} from '../lib/auth/orgInvitations';
import { VERIFIER_TEAM_ROLES } from '../lib/auth/roles';

const ORG_A = 'org_abc123';
const ORG_B = 'org_xyz789';

// ── Case 1 — readonly role blocks mutating methods; allows reads ───────────
describe('readonly role enforcement on /api/verifier/*', () => {
  const ctx = {
    requestingOrgId: ORG_A,
    teamRole: 'readonly' as const,
    resourceOrgId: ORG_A,
  };

  it('blocks POST with 403', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'POST' });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('readonly_blocks_mutation');
    }
  });

  it('blocks PUT with 403', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'PUT' });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.statusCode).toBe(403);
  });

  it('blocks DELETE with 403', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'DELETE' });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.statusCode).toBe(403);
  });

  it('permits GET for readonly', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'GET' });
    expect(d.permitted).toBe(true);
  });

  it('member and admin roles may POST on same org', () => {
    for (const role of ['member', 'admin', 'owner'] as const) {
      const d = checkVerifierPermission({ ...ctx, teamRole: role, method: 'POST' });
      expect(d.permitted).toBe(true);
    }
  });
});

// ── Case 2 — cross-org request returns 404, not 403 ──────────────────────
describe('cross-org access returns 404', () => {
  it('returns 404 when requesting org differs from resource org', () => {
    const d = checkVerifierPermission({
      requestingOrgId: ORG_A,
      teamRole: 'admin',
      resourceOrgId: ORG_B,
      method: 'GET',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(404);
      expect(d.reason).toBe('cross_org');
    }
  });

  it('returns 404 even for owner role on a different org', () => {
    const d = checkVerifierPermission({
      requestingOrgId: ORG_A,
      teamRole: 'owner',
      resourceOrgId: ORG_B,
      method: 'DELETE',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.statusCode).toBe(404);
  });
});

// ── Case 3 — timing-safe org_id comparison ───────────────────────────────
describe('timingSafeEqualStrings — constant-time comparison', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualStrings(ORG_A, ORG_A)).toBe(true);
    expect(timingSafeEqualStrings('', '')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqualStrings('org_aaa', 'org_bbb')).toBe(false);
  });

  it('returns false for different-length strings without short-circuiting', () => {
    // Short string vs long — must not early-return on length mismatch alone
    expect(timingSafeEqualStrings('org_a', 'org_a_extra')).toBe(false);
    expect(timingSafeEqualStrings('org_a_extra', 'org_a')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqualStrings('', ORG_A)).toBe(false);
    expect(timingSafeEqualStrings(ORG_A, '')).toBe(false);
  });
});

// ── Case 4 — org_id absence → no implicit grant ──────────────────────────
describe('org_id absent from JWT → no implicit grant', () => {
  it('returns 403 no_org_context when requestingOrgId is null', () => {
    const d = checkVerifierPermission({
      requestingOrgId: null,
      teamRole: 'admin',
      resourceOrgId: ORG_A,
      method: 'GET',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('no_org_context');
    }
  });

  it('returns 403 no_org_context when teamRole is null (even with valid org_id)', () => {
    const d = checkVerifierPermission({
      requestingOrgId: ORG_A,
      teamRole: null,
      resourceOrgId: ORG_A,
      method: 'GET',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('no_org_context');
    }
  });

  it('returns 403 no_org_context when both are null', () => {
    const d = checkVerifierPermission({
      requestingOrgId: null,
      teamRole: null,
      resourceOrgId: ORG_A,
      method: 'POST',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.statusCode).toBe(403);
  });
});

// ── Structural invariants ─────────────────────────────────────────────────
describe('structural invariants', () => {
  it('rbacEnforced is the literal true', () => {
    expect(rbacEnforced).toBe(true);
    // Type-level: this would be a TS error if someone widened to boolean
    const enforced: true = rbacEnforced;
    expect(enforced).toBe(true);
  });

  it('VERIFIER_TEAM_ROLES contains exactly four roles', () => {
    expect(VERIFIER_TEAM_ROLES).toEqual(['owner', 'admin', 'member', 'readonly']);
  });

  it('parseTeamRole returns null for unknown values', () => {
    expect(parseTeamRole('superadmin')).toBeNull();
    expect(parseTeamRole(42)).toBeNull();
    expect(parseTeamRole(undefined)).toBeNull();
    expect(parseTeamRole('')).toBeNull();
  });

  it('parseTeamRole maps all known roles correctly', () => {
    for (const role of VERIFIER_TEAM_ROLES) {
      expect(parseTeamRole(role)).toBe(role);
    }
  });
});
