# W2-PR1 — Auth Helper Specification
**Wave:** Wave 2, PR 1  
**Date:** 2026-05-07  
**Status:** Planning only  
**File:** `apps/web/lib/auth/orgInvitations.ts`

---

## Module Contract

`orgInvitations.ts` is a **pure transform module** with zero side effects.

Invariants that must hold for the lifetime of this file:
- No `fetch()` calls
- No Prisma/DB reads
- No Clerk API calls (`clerkClient.*`)
- No `console.log` or observability in the RBAC decision path (call sites may log)
- No mutation of any argument
- Every function is synchronous (no `async`, no `Promise`)
- Every export is explicitly typed (no `any`, no implicit `unknown`)
- `rbacEnforced` is the literal `true as const` — never widened to `boolean`

---

## Exported Interface (exact)

### `rbacEnforced`
```typescript
export const rbacEnforced = true as const;
```
A sealed literal. Callers may not assign `rbacEnforced = false`. Tests assert this is `true` not merely truthy.

---

### `VERIFIER_TEAM_ROLES` and `VerifierTeamRole`
Defined in `roles.ts`, re-exported from `orgInvitations.ts` if needed, but sourced from `roles.ts` as the canonical location.

```typescript
// roles.ts (canonical)
export const VERIFIER_TEAM_ROLES = ['owner', 'admin', 'member', 'readonly'] as const;
export type VerifierTeamRole = (typeof VERIFIER_TEAM_ROLES)[number];
```

Privilege ascending: `readonly < member < admin < owner`  
No implicit inheritance. Owner does not get member permissions by inheritance — the role check is explicit.

---

### `RbacFailureReason`
```typescript
export type RbacFailureReason =
  | 'no_org_context'        // JWT org_id or team_role absent
  | 'readonly_blocks_mutation'  // readonly + POST/PUT/DELETE/PATCH
  | 'cross_org';            // requestingOrgId !== resourceOrgId
```

These three reasons map to exactly two HTTP status codes:
- `no_org_context` → 403
- `readonly_blocks_mutation` → 403
- `cross_org` → 404

The 404 for cross-org is deliberate: it leaks no information about whether the resource org exists, what it contains, or who has access.

---

### `RbacDecision`
```typescript
export type RbacDecision =
  | { permitted: true }
  | { permitted: false; statusCode: 403 | 404; reason: RbacFailureReason };
```

A discriminated union. Callers narrow via `if (!decision.permitted)`.  
There is no `statusCode` on the permitted branch — callers do not check it.

---

### `MembershipContext`
```typescript
export interface MembershipContext {
  requestingOrgId: string | null;   // from JWT vitalcv.org_id — null if absent
  teamRole: VerifierTeamRole | null; // from JWT vitalcv.team_role — null if unknown
  resourceOrgId: string;             // from x-verifier-org header — empty string if absent
  method: string;                    // HTTP method, uppercase normalized in function
}
```

**`requestingOrgId` source:** `sessionClaims?.vitalcv?.org_id` — Clerk JWT only.  
**`teamRole` source:** `parseTeamRole(sessionClaims?.vitalcv?.team_role)` — validated against `VERIFIER_TEAM_ROLES`.  
**`resourceOrgId` source:** `req.headers.get('x-verifier-org') ?? ''` — client-supplied, validated against JWT (not trusted as resource ownership proof).  
**`method` source:** `req.method` — from the Next.js request object.

---

### `checkVerifierPermission`
```typescript
export function checkVerifierPermission(ctx: MembershipContext): RbacDecision
```

**Gate evaluation order (immutable — do not reorder):**

```
Gate 1: Is org context present?
  if (!ctx.requestingOrgId || !ctx.teamRole)
    → { permitted: false, statusCode: 403, reason: 'no_org_context' }

Gate 2: Does requesting org match resource org? (timing-safe)
  if (!timingSafeEqualStrings(ctx.requestingOrgId, ctx.resourceOrgId))
    → { permitted: false, statusCode: 404, reason: 'cross_org' }

Gate 3: Is readonly attempting a mutation?
  if (ctx.teamRole === 'readonly' && MUTATING_METHODS.has(ctx.method.toUpperCase()))
    → { permitted: false, statusCode: 403, reason: 'readonly_blocks_mutation' }

Default: → { permitted: true }
```

**Why this order is load-bearing:**
- Gate 1 before Gate 2: prevents timing oracle on org comparison when there's no org context. An attacker cannot probe for org IDs by submitting requests with no JWT org_id and timing the response.
- Gate 2 before Gate 3: cross-org access is denied before method is checked. An attacker cannot learn whether cross-org readonly access would be permitted by observing different status codes.
- Gate 3 before default: readonly check happens last — this is the least sensitive check and belongs at the end.

---

### `timingSafeEqualStrings`
```typescript
export function timingSafeEqualStrings(a: string, b: string): boolean
```

**Implementation requirements (exact):**
1. Both strings are padded or handled so every byte position is processed regardless of actual length
2. The function uses `crypto.timingSafeEqual` from Node.js `node:crypto`
3. Result is a single boolean — no intermediate leakage
4. Both arguments are encoded as UTF-8 Buffers of the SAME length before comparison
5. If lengths differ, the shorter is padded to match the longer — then compared. The return is `false` (lengths differ → cannot be equal) but the full comparison still runs to prevent length-based timing leak.

**Implementation pattern:**
```typescript
import { timingSafeEqual } from 'node:crypto';

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  const maxLen = Math.max(bufA.length, bufB.length);
  if (maxLen === 0) return true;
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  // timingSafeEqual requires same length — paddedA and paddedB are both maxLen
  const equal = timingSafeEqual(paddedA, paddedB);
  // Return false if lengths differed (cannot be equal) even if padding made bytes equal
  return equal && bufA.length === bufB.length;
}
```

---

### `parseTeamRole`
```typescript
export function parseTeamRole(raw: unknown): VerifierTeamRole | null
```

Safe parser. Returns `null` for any value not in `VERIFIER_TEAM_ROLES`.

```typescript
export function parseTeamRole(raw: unknown): VerifierTeamRole | null {
  if (typeof raw !== 'string') return null;
  if ((VERIFIER_TEAM_ROLES as readonly string[]).includes(raw)) {
    return raw as VerifierTeamRole;
  }
  return null;
}
```

**Why `null` not an error:** The JWT claim may be absent on first login before role assignment. `null` → Gate 1 fires → 403 `no_org_context`. Clean failure, no exception.

---

## Middleware Integration Shape

The middleware integration must follow this shape exactly. This is NOT implementation — it is the specification Claude Code Terminal must match.

```typescript
// In middleware.ts, BEFORE step 1 (isPublicRoute check)

// ── Step 0: Verifier API RBAC ─────────────────────────────────────────────
// Intercepts /api/verifier/* before the /api/* public-route pass-through.
//
// LAYER 1 of 2 (tenant isolation):
//   Validates the caller's JWT org matches the org they claim to represent.
//   Does NOT verify the requested resource belongs to that org.
//   Route handlers are responsible for Layer 2 (resource ownership check).
//
// x-verifier-org is client-supplied. It is validated against the JWT org_id —
// it is NOT accepted as a resource ownership claim.
if (VERIFIER_API.test(pathname)) {
  const session = await auth();
  if (!session.userId) {
    return new NextResponse(null, { status: 403 });
    // 403 not 401: the /api/* branch is declared public in isPublicRoute.
    // 401 would be incorrect; the caller knows they need to be authed.
  }
  const claims = session.sessionClaims?.vitalcv as Record<string, unknown> | undefined;
  const requestingOrgId = typeof claims?.org_id === 'string' ? claims.org_id : null;
  const teamRole = parseTeamRole(claims?.team_role);
  const resourceOrgId = req.headers.get('x-verifier-org') ?? '';

  const decision = checkVerifierPermission({
    requestingOrgId,
    teamRole,
    resourceOrgId,
    method: req.method,
  });

  if (!decision.permitted) {
    return new NextResponse(null, { status: decision.statusCode });
    // statusCode is either 403 or 404 — both are correct per rbac-wave-threat-model.md
  }
  return NextResponse.next();
}
```

**Why 403 on missing `userId` (not 401):**  
The `/api/*` namespace is declared public in `PUBLIC_ROUTE_PATTERNS` and bypasses normal Clerk auth handling. Returning 401 would suggest the route expects Clerk-mediated auth. 403 is correct: "you are requesting a restricted resource and you haven't established who you are."

---

## What the Helper Does NOT Do

These are explicitly out of scope for `orgInvitations.ts` permanently:

| Forbidden capability | Why |
|---|---|
| DB read for org membership | No I/O — pure transform only |
| Clerk API call for org roles | No I/O — pure transform only |
| Permission check beyond the 3 gates | Additional gates belong in route handlers |
| Resource ownership check | Layer 2 — belongs in route handlers |
| Invitation creation/validation | W2-PR4 scope, different module |
| Session caching | Not this module's concern |
| Logging/observability | Call sites decide; helper is silent |
