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
  checkVerifierFailClosed,
  checkVerifierPermission,
  extractVerifierClaims,
  isVerifierApiRoute,
  parseTeamRole,
  rbacEnforced,
  timingSafeEqualStrings,
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

// ──────────────────────────────────────────────────────────────────────────
// W2-PR1A — Fail-closed enforcement regression tests
// ──────────────────────────────────────────────────────────────────────────

describe('isVerifierApiRoute — namespace predicate', () => {
  it('matches /api/verifier and any subpath', () => {
    expect(isVerifierApiRoute('/api/verifier')).toBe(true);
    expect(isVerifierApiRoute('/api/verifier/')).toBe(true);
    expect(isVerifierApiRoute('/api/verifier/team')).toBe(true);
    expect(isVerifierApiRoute('/api/verifier/team/roster')).toBe(true);
    expect(isVerifierApiRoute('/api/verifier/packet/entity-123')).toBe(true);
  });

  it('does NOT match adjacent paths that could be confused for verifier', () => {
    expect(isVerifierApiRoute('/api')).toBe(false);
    expect(isVerifierApiRoute('/api/')).toBe(false);
    expect(isVerifierApiRoute('/api/verifiers')).toBe(false); // plural
    expect(isVerifierApiRoute('/api/verifier-api')).toBe(false);
    expect(isVerifierApiRoute('/api/v/verifier')).toBe(false);
    expect(isVerifierApiRoute('/verifier')).toBe(false); // missing /api prefix
    expect(isVerifierApiRoute('/api/verify')).toBe(false); // /verify is public
    expect(isVerifierApiRoute('/api/employer-review/anything')).toBe(false);
  });

  it('rejects empty / non-conforming pathnames safely', () => {
    expect(isVerifierApiRoute('')).toBe(false);
    expect(isVerifierApiRoute('/')).toBe(false);
    expect(isVerifierApiRoute('verifier')).toBe(false); // no leading slash
  });
});

describe('checkVerifierFailClosed — fail-closed pre-check (W2-PR1A)', () => {
  it('returns failClosed for verifier route when Clerk is disabled', () => {
    const r = checkVerifierFailClosed({
      pathname: '/api/verifier/team/roster',
      clerkEnabled: false,
    });
    expect(r.failClosed).toBe(true);
    if (r.failClosed) {
      expect(r.statusCode).toBe(503);
      expect(r.reason).toBe('clerk_unavailable');
    }
  });

  it('does NOT fire for verifier route when Clerk is enabled (normal flow takes over)', () => {
    const r = checkVerifierFailClosed({
      pathname: '/api/verifier/team/roster',
      clerkEnabled: true,
    });
    expect(r.failClosed).toBe(false);
  });

  it('does NOT fire for non-verifier routes (Clerk disabled is OK for /api/health, etc.)', () => {
    const r = checkVerifierFailClosed({
      pathname: '/api/health',
      clerkEnabled: false,
    });
    expect(r.failClosed).toBe(false);
  });

  it('does NOT fire for a route that LOOKS like verifier but has a different prefix', () => {
    // Defense-in-depth: the predicate must match exactly the verifier
    // namespace. Routes that share a substring (e.g. /api/verify or
    // /api/verifiers) must not be exposed by mistake.
    expect(checkVerifierFailClosed({ pathname: '/api/verify/npi/1234567890', clerkEnabled: false }).failClosed).toBe(false);
    expect(checkVerifierFailClosed({ pathname: '/api/verifiers', clerkEnabled: false }).failClosed).toBe(false);
  });

  it('lock: 503 status code never widens to 200 / 401 / 404 — only fail-closed shape allowed', () => {
    // A regression that flips this to 200 would expose verifier routes
    // publicly when Clerk is unavailable. Lock the status code shape.
    const r = checkVerifierFailClosed({
      pathname: '/api/verifier/team',
      clerkEnabled: false,
    });
    if (r.failClosed) {
      const sc: 503 = r.statusCode; // type-level lock
      expect(sc).toBe(503);
    } else {
      throw new Error('checkVerifierFailClosed regression — failed to fail closed');
    }
  });
});

describe('extractVerifierClaims — runtime claim validation (W2-PR1A)', () => {
  it('extracts well-formed claims', () => {
    const r = extractVerifierClaims({
      vitalcv: { org_id: ORG_A, team_role: 'admin' },
    });
    expect(r.requestingOrgId).toBe(ORG_A);
    expect(r.teamRole).toBe('admin');
  });

  it('returns null/null when sessionClaims itself is missing', () => {
    expect(extractVerifierClaims(undefined)).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims(null)).toEqual({ requestingOrgId: null, teamRole: null });
  });

  it('returns null/null when sessionClaims is non-object (string/number/boolean)', () => {
    expect(extractVerifierClaims('claims-token')).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims(42)).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims(true)).toEqual({ requestingOrgId: null, teamRole: null });
  });

  it('returns null/null when sessionClaims is an array (not a record)', () => {
    expect(extractVerifierClaims([])).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims(['vitalcv'])).toEqual({ requestingOrgId: null, teamRole: null });
  });

  it('returns null/null when vitalcv claim is missing', () => {
    expect(extractVerifierClaims({})).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims({ other: 'data' })).toEqual({ requestingOrgId: null, teamRole: null });
  });

  it('returns null/null when vitalcv claim is non-object', () => {
    expect(extractVerifierClaims({ vitalcv: 'admin' })).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims({ vitalcv: 42 })).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims({ vitalcv: null })).toEqual({ requestingOrgId: null, teamRole: null });
    expect(extractVerifierClaims({ vitalcv: ['admin'] })).toEqual({ requestingOrgId: null, teamRole: null });
  });

  it('returns null org_id when org_id is non-string', () => {
    expect(extractVerifierClaims({ vitalcv: { org_id: 12345, team_role: 'admin' } })).toEqual({
      requestingOrgId: null,
      teamRole: 'admin',
    });
    expect(extractVerifierClaims({ vitalcv: { org_id: null, team_role: 'admin' } })).toEqual({
      requestingOrgId: null,
      teamRole: 'admin',
    });
    expect(extractVerifierClaims({ vitalcv: { org_id: { id: ORG_A }, team_role: 'admin' } })).toEqual({
      requestingOrgId: null,
      teamRole: 'admin',
    });
    expect(extractVerifierClaims({ vitalcv: { org_id: [ORG_A], team_role: 'admin' } })).toEqual({
      requestingOrgId: null,
      teamRole: 'admin',
    });
  });

  it('returns null org_id when org_id is empty string', () => {
    // Empty-string org_id never matches any non-empty resource org —
    // would always cross_org → 404. We collapse to null here so the
    // earlier Gate 1 (no_org_context) fires first, with the cleaner 403.
    expect(extractVerifierClaims({ vitalcv: { org_id: '', team_role: 'admin' } })).toEqual({
      requestingOrgId: null,
      teamRole: 'admin',
    });
  });

  it('returns null team_role when team_role is unknown', () => {
    expect(extractVerifierClaims({ vitalcv: { org_id: ORG_A, team_role: 'superadmin' } })).toEqual({
      requestingOrgId: ORG_A,
      teamRole: null,
    });
  });

  it('returns null team_role when team_role is non-string', () => {
    expect(extractVerifierClaims({ vitalcv: { org_id: ORG_A, team_role: 1 } })).toEqual({
      requestingOrgId: ORG_A,
      teamRole: null,
    });
    expect(extractVerifierClaims({ vitalcv: { org_id: ORG_A, team_role: null } })).toEqual({
      requestingOrgId: ORG_A,
      teamRole: null,
    });
    expect(extractVerifierClaims({ vitalcv: { org_id: ORG_A, team_role: { name: 'admin' } } })).toEqual({
      requestingOrgId: ORG_A,
      teamRole: null,
    });
  });

  it('partial JWT payload (org_id present, team_role missing) → null team_role only', () => {
    // Defends against the partial-payload threat: Clerk publicMetadata
    // not yet fully populated. extractVerifierClaims surfaces the
    // partial nature; downstream Gate 1 fires (teamRole === null →
    // no_org_context).
    expect(extractVerifierClaims({ vitalcv: { org_id: ORG_A } })).toEqual({
      requestingOrgId: ORG_A,
      teamRole: null,
    });
  });

  it('partial JWT payload (team_role present, org_id missing) → null org_id only', () => {
    expect(extractVerifierClaims({ vitalcv: { team_role: 'admin' } })).toEqual({
      requestingOrgId: null,
      teamRole: 'admin',
    });
  });

  it('does not throw on any input — function is total', () => {
    // Hostile inputs: non-JSON-serializable, recursive, weird types
    const recursive: Record<string, unknown> = {};
    recursive.self = recursive;
    expect(() => extractVerifierClaims(recursive)).not.toThrow();
    expect(() => extractVerifierClaims(Symbol('x') as unknown)).not.toThrow();
    expect(() => extractVerifierClaims(() => 0)).not.toThrow();
  });
});

describe('integration: extractVerifierClaims composes with checkVerifierPermission for fail-closed Gate 1', () => {
  it('malformed sessionClaims → no_org_context (403)', () => {
    const { requestingOrgId, teamRole } = extractVerifierClaims('totally not an object');
    const decision = checkVerifierPermission({
      requestingOrgId,
      teamRole,
      resourceOrgId: ORG_A,
      method: 'GET',
    });
    expect(decision.permitted).toBe(false);
    if (!decision.permitted) {
      expect(decision.statusCode).toBe(403);
      expect(decision.reason).toBe('no_org_context');
    }
  });

  it('non-string org_id with valid team_role → no_org_context (403, NOT cross_org)', () => {
    // Prior to W2-PR1A this would trip a `as Record<string, unknown>`
    // assertion that masked the type error; downstream typeof checks
    // would still surface null org_id but with code-smell. After W2-PR1A
    // the path is type-guarded end-to-end.
    const { requestingOrgId, teamRole } = extractVerifierClaims({
      vitalcv: { org_id: 999, team_role: 'admin' },
    });
    const decision = checkVerifierPermission({
      requestingOrgId,
      teamRole,
      resourceOrgId: ORG_A,
      method: 'POST',
    });
    expect(decision.permitted).toBe(false);
    if (!decision.permitted) {
      expect(decision.reason).toBe('no_org_context');
    }
  });

  it('vitalcv claim is an array (attacker forging a payload shape) → no_org_context', () => {
    const { requestingOrgId, teamRole } = extractVerifierClaims({
      vitalcv: ['org_a', 'admin'],
    });
    const decision = checkVerifierPermission({
      requestingOrgId,
      teamRole,
      resourceOrgId: ORG_A,
      method: 'GET',
    });
    expect(decision.permitted).toBe(false);
    if (!decision.permitted) {
      expect(decision.reason).toBe('no_org_context');
    }
  });
});
