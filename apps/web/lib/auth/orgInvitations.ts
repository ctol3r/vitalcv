/**
 * apps/web/lib/auth/orgInvitations.ts
 *
 * Verifier-org RBAC decision module. Pure transform — no fetches, no DB
 * reads, no Clerk API calls, no logging in the decision path. Edge-runtime
 * safe (uses Web `TextEncoder`, not `node:crypto`).
 *
 * Truth contracts:
 *   - `rbacEnforced` is the literal `true as const` — never widens to
 *     `boolean`. Callers cannot toggle it off.
 *   - `readonly` role cannot POST/PUT/DELETE/PATCH on `/api/verifier/*`.
 *     Returns statusCode 403 with reason 'readonly_blocks_mutation'.
 *   - Cross-org request (requesting org ≠ resource org) returns
 *     statusCode 404 with reason 'cross_org'. 404 is deliberate: no
 *     information leaks about whether the resource org exists, who owns
 *     it, or what roles it has.
 *   - Absent org context (org_id or team_role missing from JWT) →
 *     statusCode 403 with reason 'no_org_context'. No implicit grant.
 *   - org_id comparison is timing-safe: every byte position is XOR'd
 *     regardless of length, preventing oracle-based timing attacks on
 *     org IDs.
 *
 * Two-layer defense model (W2-PR1 implements Layer 1 only):
 *   Layer 1 (this module + middleware) — validates the caller's JWT
 *     org matches the org they claim to represent (`x-verifier-org`
 *     header). Does NOT verify the requested resource belongs to that
 *     org.
 *   Layer 2 (route handlers, deferred to W2-PR2+) — verifies the
 *     resource named by the URL belongs to `requestingOrgId`.
 *
 * `x-verifier-org` is client-supplied. It is **never** trusted as a
 * resource-ownership claim. It is compared against the JWT-derived
 * `org_id` (Clerk-signed, tamper-proof). Mismatch → 404. Match passes
 * Layer 1; route handlers must still enforce Layer 2.
 */

import type { VerifierTeamRole } from './roles';
import { VERIFIER_TEAM_ROLES } from './roles';

/**
 * Sealed enforcement flag. Literal `true as const` — callers cannot
 * accidentally widen to `boolean` and bypass the guard.
 */
export const rbacEnforced = true as const;

/**
 * HTTP methods that change persistent state. The `readonly` team role
 * is blocked from these on any `/api/verifier/*` route. OPTIONS / HEAD
 * / GET are permitted to readonly callers (subject to Gates 1 & 2).
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export type RbacFailureReason =
  | 'no_org_context'
  | 'readonly_blocks_mutation'
  | 'cross_org';

export type RbacDecision =
  | { permitted: true }
  | { permitted: false; statusCode: 403 | 404; reason: RbacFailureReason };

export interface MembershipContext {
  /** `org_id` from the Clerk JWT `vitalcv` claim. `null` when absent. */
  requestingOrgId: string | null;
  /** `team_role` from the Clerk JWT `vitalcv` claim. `null` when absent or unknown. */
  teamRole: VerifierTeamRole | null;
  /**
   * The org the client claims to be acting on behalf of (`x-verifier-org`
   * header). NEVER trusted as ownership proof — only compared to
   * `requestingOrgId` for identity coherence (Gate 2). Empty string when
   * the header is absent; this fails Gate 2 against any non-empty
   * `requestingOrgId`.
   */
  resourceOrgId: string;
  /** HTTP method of the incoming request (any case; normalized internally). */
  method: string;
}

/**
 * Evaluate whether the requesting member may access a verifier resource.
 *
 * Gate order (immutable — must not be reordered):
 *
 *   Gate 1 — No org context  → 403 `no_org_context`
 *     Fires before Gate 2 so an attacker cannot probe org IDs by
 *     submitting requests with no JWT and timing the response.
 *
 *   Gate 2 — Cross-org check → 404 `cross_org`
 *     Fires before Gate 3 so cross-org access is denied before the
 *     method is examined. An attacker cannot learn whether cross-org
 *     readonly access would be permitted by observing different status
 *     codes (404 always wins for cross-org).
 *
 *   Gate 3 — Readonly + mutating method → 403 `readonly_blocks_mutation`
 *
 *   Default — Permitted (Layer-1 pass; route handler still enforces
 *     Layer-2 resource ownership).
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
  if (
    ctx.teamRole === 'readonly' &&
    MUTATING_METHODS.has(ctx.method.toUpperCase())
  ) {
    return { permitted: false, statusCode: 403, reason: 'readonly_blocks_mutation' };
  }

  return { permitted: true };
}

/**
 * Timing-safe string equality for org IDs.
 *
 * Edge-runtime safe: uses `TextEncoder` (Web API), NOT `node:crypto`
 * (which is not stable in Next.js Edge middleware). The earlier
 * planning-spec version that imported from `node:crypto` was corrected
 * by the W2-PR1 final adversarial review (F-1) to this Edge-safe pattern.
 *
 * Algorithm:
 *   - Encode both strings as UTF-8 byte arrays.
 *   - Length difference is mixed into the mismatch accumulator (so an
 *     attacker cannot detect length via timing alone).
 *   - Iterate over `max(len(a), len(b))` byte positions, XOR-accumulating
 *     each pair (using `?? 0` for the shorter side's missing bytes).
 *   - There is NO early return on length mismatch and NO early return
 *     on first non-equal byte. Every byte position is processed.
 *   - Result: `mismatch === 0` iff (lengths equal) AND (every byte equal).
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  // Mix length difference into the accumulator. Empty-vs-non-empty is
  // a mismatch; equal-empty (both length 0) yields 0.
  let mismatch = aBytes.length ^ bBytes.length;
  const len = aBytes.length > bBytes.length ? aBytes.length : bBytes.length;
  for (let i = 0; i < len; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

/**
 * Extract and validate the team role from a raw JWT claim value.
 *
 * Returns `null` for any value not in `VERIFIER_TEAM_ROLES`. Does NOT
 * throw — invalid values are treated as no role (which fires Gate 1).
 *
 * Why `null` not an exception: the JWT may be absent on first sign-in
 * before role assignment. `null` → Gate 1 fires → 403 `no_org_context`.
 * Clean failure, no exception bubbling through middleware.
 */
export function parseTeamRole(raw: unknown): VerifierTeamRole | null {
  if (typeof raw !== 'string') return null;
  if ((VERIFIER_TEAM_ROLES as readonly string[]).includes(raw)) {
    return raw as VerifierTeamRole;
  }
  return null;
}
