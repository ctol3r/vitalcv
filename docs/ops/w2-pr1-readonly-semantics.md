# W2-PR1 — Readonly Semantics
**Wave:** Wave 2, PR 1  
**Date:** 2026-05-07  
**Status:** Planning only  

---

## The Readonly Role Definition

`readonly` is the lowest privilege level in the verifier team.  
A verifier team member with the `readonly` role:
- **MAY** call any `GET` or `HEAD` endpoint in `/api/verifier/*` that belongs to their org
- **MAY NOT** call `POST`, `PUT`, `DELETE`, or `PATCH` on any endpoint
- **MAY NOT** accept a clinician on behalf of their org
- **MAY NOT** route a review to a human reviewer
- **MAY NOT** request a credential refresh
- **MAY NOT** invite new team members
- **MAY NOT** modify any org configuration

The `readonly` restriction is enforced at **both** the middleware level (Gate 3) and must be re-enforced at the route handler level where the route handler cannot rely solely on middleware (defense-in-depth).

---

## Why readonly Cannot Be Inferred from the Route

The readonly check in `checkVerifierPermission` gates on HTTP method, not on route semantics. This is intentional.

**Reason:** Middleware runs at the Edge and has no route-semantic knowledge. It cannot know whether `POST /api/verifier/packet/export` is a mutating action or an idempotent operation that happens to use POST. The HTTP method is the only reliable signal available without a DB lookup or route registry.

**Consequence:** Route handlers must apply additional semantic readonly checks for any POST endpoint that is logically read-only (e.g., a report export that uses POST for large payloads). The middleware provides coarse method-level enforcement; route handlers provide semantic enforcement.

---

## Readonly Access to Audit and Event Routes

**Q: May a readonly verifier team member access `/api/audit/events` or similar audit log routes?**

**A: No — but for a reason unrelated to the readonly gate.**

`/api/audit/events` is NOT in the `/api/verifier/*` namespace. It is not gated by W2-PR1 at all. W2-PR3 adds an ADMIN-role guard to this route. The readonly gate in W2-PR1 does not apply to it.

Even if audit events were under `/api/verifier/audit/events`, readonly access would still be a separate policy decision:
- **Read access to audit logs** reveals operational metadata (user actions, timestamps, entity IDs). This is sensitive even for read-only access.
- The principle: audit log access is an ADMIN function, not a verifier function, regardless of readonly status.

**Rule:** Readonly verifier team members may read verifier-scoped operational data (packet status, coverage maps, clinician profile state). They may NOT access system-level audit logs. Audit log access requires the `ADMIN` `UserRole` — a separate gate implemented in W2-PR3.

---

## Readonly vs Other Roles — Permission Matrix

| Operation | readonly | member | admin | owner |
|---|---|---|---|---|
| View clinician packet | ✅ | ✅ | ✅ | ✅ |
| View review status | ✅ | ✅ | ✅ | ✅ |
| View team roster | ✅ | ✅ | ✅ | ✅ |
| Accept head-start | ❌ | ✅ | ✅ | ✅ |
| Request credential refresh | ❌ | ✅ | ✅ | ✅ |
| Route to human review | ❌ | ✅ | ✅ | ✅ |
| Invite team member | ❌ | ❌ | ✅ | ✅ |
| Remove team member | ❌ | ❌ | ✅ | ✅ |
| Modify org settings | ❌ | ❌ | ❌ | ✅ |
| Access audit logs (W2-PR3) | ❌ | ❌ | ❌ | ❌ (ADMIN UserRole) |

Note: audit log access is a `ADMIN` UserRole action — no verifier team role grants it.

---

## Readonly Semantics in the RBAC Decision Function

The readonly check (Gate 3) fires only when both are true:
1. `ctx.teamRole === 'readonly'`
2. `MUTATING_METHODS.has(ctx.method.toUpperCase())`

where `MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])`.

### What this means in practice:

**A GET to any verifier route with a readonly token passes Gate 3.** Gates 1 and 2 still fire. A readonly member cannot access another org's routes. They can only read their own org's verifier data.

**A POST from a readonly member always fails Gate 3.** This is enforced regardless of what the POST is intended to do semantically.

**An OPTIONS or HEAD from a readonly member is not blocked by Gate 3.** CORS preflight (OPTIONS) must pass; HEAD is a safe read.

---

## Readonly Enforcement is NOT Sufficient Alone

Gate 3 (readonly → no mutations) protects against readonly members taking state-changing actions. It does NOT protect against:

1. A `member` role user taking unauthorized actions (member has full mutation rights)
2. A caller with valid JWT performing actions on resources they don't own (cross-org — Gate 2 handles this)
3. A caller with a forged or expired JWT (Clerk signature validation handles this — not in scope for W2-PR1)

The combination of all 3 gates provides the complete primitive-level protection. Route handlers provide the resource-level protection.

---

## Readonly and the x-verifier-org Header

A readonly caller still must include a valid `x-verifier-org` header. Gate 1 and Gate 2 fire before Gate 3. This means:

- A readonly caller with no org context → 403 `no_org_context` (not "welcome, you can read")
- A readonly caller from Org A accessing Org B's resources → 404 (not "you can read but not write")

Readonly is the minimum privilege for any verifier action. It is not a default grant for unauthenticated or cross-org access.

---

## Readonly Escalation Path

The `readonly` role is set in Clerk `publicMetadata.vitalcv.team_role`. Escalation to `member` or `admin` requires:
1. An `owner` or `admin` of the org to modify the user's role via Clerk org administration
2. A JWT refresh (user must sign out and back in, or force-refresh the Clerk session)

This escalation path is entirely out of scope for W2-PR1. It is a Clerk admin operation, not a code change.

---

## Readonly and the Two-Layer Defense

Layer 1 (middleware, W2-PR1): blocks readonly callers from POSTing to any `/api/verifier/*` route  
Layer 2 (route handler, W2-PR2+): additionally enforces that the caller's org owns the resource being mutated

For readonly callers, Layer 1 is sufficient — they never reach Layer 2 for mutations.  
For non-readonly callers (member, admin, owner), Layer 2 is required for full tenant isolation.
