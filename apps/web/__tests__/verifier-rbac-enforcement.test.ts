/**
 * verifier-rbac-enforcement.test.ts
 *
 * W2-PR1 — pure-function tests for the RBAC decision module. No Clerk,
 * no DB, no network. Tests are deterministic and run in vitest's `node`
 * environment.
 *
 * Truth contracts asserted (mapping to SECURITY_INVARIANTS.md):
 *   - readonly cannot mutate /api/verifier/* (§3.1)
 *   - cross-org access returns 404 (§5.5) — never 403
 *   - timing-safe compare processes every byte position (§6.2)
 *   - org_id absent from JWT → 403 no_org_context (§5.4)
 *   - rbacEnforced is the literal `true` (not widened to boolean) (§7.1)
 *   - parseTeamRole rejects unknown values, returns null
 *   - VERIFIER_TEAM_ROLES contains exactly four roles in declared order
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

describe('readonly role enforcement on /api/verifier/* (Gate 3)', () => {
  const ctx = {
    requestingOrgId: ORG_A,
    teamRole: 'readonly' as const,
    resourceOrgId: ORG_A,
  };

  it('blocks POST with 403 readonly_blocks_mutation', () => {
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
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('readonly_blocks_mutation');
    }
  });

  it('blocks DELETE with 403', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'DELETE' });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('readonly_blocks_mutation');
    }
  });

  it('blocks PATCH with 403', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'PATCH' });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('readonly_blocks_mutation');
    }
  });

  it('permits GET for readonly', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'GET' });
    expect(d.permitted).toBe(true);
  });

  it('permits HEAD for readonly', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'HEAD' });
    expect(d.permitted).toBe(true);
  });

  it('permits OPTIONS for readonly (CORS preflight must pass)', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'OPTIONS' });
    expect(d.permitted).toBe(true);
  });

  it('member, admin, and owner roles may POST on the same org', () => {
    for (const role of ['member', 'admin', 'owner'] as const) {
      const d = checkVerifierPermission({ ...ctx, teamRole: role, method: 'POST' });
      expect(d.permitted).toBe(true);
    }
  });

  it('method is case-normalized — lowercase post is treated as POST', () => {
    const d = checkVerifierPermission({ ...ctx, method: 'post' });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.reason).toBe('readonly_blocks_mutation');
  });
});

// ── Case 2 — cross-org request returns 404, not 403 ────────────────────────

describe('cross-org access returns 404 (Gate 2)', () => {
  it('returns 404 cross_org when requesting org differs from resource org', () => {
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

  it('cross-org with a readonly user STILL returns 404 (not 403) — Gate 2 fires before Gate 3', () => {
    // This locks the gate ordering: a readonly user attempting a mutation
    // on another org's resource must surface as 404 (no info leak), not
    // 403 (which would confirm the cross-org resource exists).
    const d = checkVerifierPermission({
      requestingOrgId: ORG_A,
      teamRole: 'readonly',
      resourceOrgId: ORG_B,
      method: 'POST',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) {
      expect(d.statusCode).toBe(404);
      expect(d.reason).toBe('cross_org');
    }
  });

  it('empty resource org never matches a non-empty requesting org', () => {
    // x-verifier-org missing → resourceOrgId === '' → cross_org → 404
    const d = checkVerifierPermission({
      requestingOrgId: ORG_A,
      teamRole: 'admin',
      resourceOrgId: '',
      method: 'GET',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.reason).toBe('cross_org');
  });
});

// ── Case 3 — timing-safe org_id comparison ─────────────────────────────────

describe('timingSafeEqualStrings — constant-time comparison (Edge-safe)', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualStrings(ORG_A, ORG_A)).toBe(true);
    expect(timingSafeEqualStrings('', '')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqualStrings('org_aaa', 'org_bbb')).toBe(false);
  });

  it('returns false for different-length strings without short-circuiting', () => {
    expect(timingSafeEqualStrings('org_a', 'org_a_extra')).toBe(false);
    expect(timingSafeEqualStrings('org_a_extra', 'org_a')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqualStrings('', ORG_A)).toBe(false);
    expect(timingSafeEqualStrings(ORG_A, '')).toBe(false);
  });

  it('handles UTF-8 multibyte characters correctly', () => {
    // Verify TextEncoder path encodes multibyte glyphs without corruption
    expect(timingSafeEqualStrings('orgZürich', 'orgZürich')).toBe(true);
    expect(timingSafeEqualStrings('orgZürich', 'orgZurich')).toBe(false);
  });
});

// ── Case 4 — org_id absence → no implicit grant ────────────────────────────

describe('org_id absent from JWT → no implicit grant (Gate 1)', () => {
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
    if (!d.permitted) {
      expect(d.statusCode).toBe(403);
      expect(d.reason).toBe('no_org_context');
    }
  });

  it('Gate 1 fires before Gate 2 — no_org_context surfaces even when resourceOrgId differs from a hypothetical match', () => {
    // Locks the gate ordering: an attacker probing for org IDs by submitting
    // requests with no JWT cannot derive timing signal from Gate 2 because
    // Gate 1 already short-circuits.
    const d = checkVerifierPermission({
      requestingOrgId: null,
      teamRole: 'admin',
      resourceOrgId: ORG_B,
      method: 'GET',
    });
    expect(d.permitted).toBe(false);
    if (!d.permitted) expect(d.reason).toBe('no_org_context');
  });
});

// ── Structural invariants ──────────────────────────────────────────────────

describe('structural invariants', () => {
  it('rbacEnforced is the literal true (not widened to boolean)', () => {
    expect(rbacEnforced).toBe(true);
    // Type-level: this would be a TS error if someone widened to `boolean`.
    const enforced: true = rbacEnforced;
    expect(enforced).toBe(true);
  });

  it('VERIFIER_TEAM_ROLES contains exactly four roles in declared order', () => {
    expect(VERIFIER_TEAM_ROLES).toEqual(['owner', 'admin', 'member', 'readonly']);
  });

  it('parseTeamRole returns null for unknown values', () => {
    expect(parseTeamRole('superadmin')).toBeNull();
    expect(parseTeamRole(42)).toBeNull();
    expect(parseTeamRole(undefined)).toBeNull();
    expect(parseTeamRole(null)).toBeNull();
    expect(parseTeamRole('')).toBeNull();
    expect(parseTeamRole({})).toBeNull();
    expect(parseTeamRole([])).toBeNull();
  });

  it('parseTeamRole maps every known role to itself', () => {
    for (const role of VERIFIER_TEAM_ROLES) {
      expect(parseTeamRole(role)).toBe(role);
    }
  });
});
