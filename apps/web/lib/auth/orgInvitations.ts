/**
 * apps/web/lib/auth/orgInvitations.ts
 *
 * Verifier org RBAC enforcement. rbacEnforced is the literal `true`.
 *
 * Truth contracts:
 *   - readonly role cannot POST/PUT/DELETE/PATCH on /api/verifier/*.
 *     Returns statusCode 403.
 *   - Cross-org request (requesting org ≠ resource org) returns statusCode 404.
 *     404 is deliberate: no information leaks about whether the resource org
 *     exists, who owns it, or what roles it has.
 *   - Absent org context (org_id or team_role missing from JWT) → no implicit
 *     grant → statusCode 403 with reason 'no_org_context'.
 *   - org_id comparison is timing-safe: all bytes processed regardless of
 *     length to prevent oracle-based timing attacks on org IDs.
 *
 * This module is a pure transform — no DB reads, no Clerk API calls, no fetch.
 */

import type { VerifierTeamRole } from './roles';

// Seal the enforcement flag as a literal so callers cannot accidentally
// widen it to `boolean` and bypass the guard.
export const rbacEnforced = true as const;

/** HTTP methods that modify state — blocked for readonly members. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export type RbacFailureReason =
  | 'no_org_context'
  | 'readonly_blocks_mutation'
  | 'cross_org';

export type RbacDecision =
  | { permitted: true }
  | { permitted: false; statusCode: 403 | 404; reason: RbacFailureReason };

export interface MembershipContext {
  /** org_id from the Clerk JWT vitalcv claim; null when absent. */
  requestingOrgId: string | null;
  /** team_role from the Clerk JWT vitalcv claim; null when absent. */
  teamRole: VerifierTeamRole | null;
  /** The org that owns the verifier resource being accessed. */
  resourceOrgId: string;
  /** HTTP method of the incoming request. */
  method: string;
}

/**
 * Evaluate whether the requesting member may access a verifier resource.
 *
 * Gate order (must not be reordered — each gate is load-bearing):
 *   1. No org context  → 403 no_org_context
 *   2. Cross-org check → 404 cross_org  (timing-safe compare)
 *   3. Readonly + mutating method → 403 readonly_blocks_mutation
 *   4. Permitted
 */
export function checkVerifierPermission(ctx: MembershipContext): RbacDecision {
  // Gate 1 — no org context in JWT → no implicit grant
  if (!ctx.requestingOrgId || !ctx.teamRole) {
    return { permitted: false, statusCode: 403, reason: 'no_org_context' };
  }

  // Gate 2 — cross-org access → 404 (no info leak)
  if (!timingSafeEqualStrings(ctx.requestingOrgId, ctx.resourceOrgId)) {
    return { permitted: false, statusCode: 404, reason: 'cross_org' };
  }

  // Gate 3 — readonly role cannot mutate
  if (ctx.teamRole === 'readonly' && MUTATING_METHODS.has(ctx.method.toUpperCase())) {
    return { permitted: false, statusCode: 403, reason: 'readonly_blocks_mutation' };
  }

  return { permitted: true };
}

/**
 * Timing-safe string equality for org IDs.
 *
 * Processes every byte of both strings before returning, preventing
 * timing oracles that could enumerate valid org IDs by measuring
 * how quickly an early-exit comparison returns.
 *
 * Edge-runtime safe: uses TextEncoder (Web API), not Node crypto.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  // Length difference is a mismatch but we do NOT early-return here —
  // we continue processing all bytes so timing stays constant.
  let mismatch = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

/**
 * Extract and validate the team role from a raw JWT claim string.
 * Returns null when the value is absent or not a known VerifierTeamRole.
 * Does not throw — invalid values are treated as no role.
 */
export function parseTeamRole(raw: unknown): VerifierTeamRole | null {
  if (typeof raw !== 'string') return null;
  const known: ReadonlyArray<string> = ['owner', 'admin', 'member', 'readonly'];
  return known.includes(raw) ? (raw as VerifierTeamRole) : null;
}
