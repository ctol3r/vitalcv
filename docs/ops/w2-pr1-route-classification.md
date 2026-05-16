# W2-PR1 — Route Classification
**Wave:** Wave 2, PR 1  
**Date:** 2026-05-07  
**Status:** Planning only  
**Scope:** Routes affected by or relevant to the VERIFIER_API middleware intercept

---

## Classification Taxonomy

| Class | Meaning |
|---|---|
| **public** | No auth required. Middleware passes through. Route handler may also do no auth. |
| **authenticated** | Requires a valid Clerk `userId`. No role or org check. |
| **verifier-authenticated** | Requires `userId` + VERIFIER `UserRole` in JWT. No org check beyond role. |
| **org-scoped** | Requires `userId` + VERIFIER role + matching `orgId` in JWT vs resource. |
| **readonly-safe** | A GET/HEAD operation that readonly team members may perform. |
| **mutation-capable** | POST/PUT/DELETE/PATCH — blocked for readonly team members. |

A route can have multiple classifications. Example: `GET /api/verifier/team` is `org-scoped` AND `readonly-safe`.

---

## W2-PR1 Affected Routes

W2-PR1 installs middleware that intercepts `/api/verifier/**`. Below is the complete classification of all routes in that namespace.

### `/api/verifier/invite`
**Classification:** `org-scoped`, `mutation-capable`  
**Methods affected:** POST  
**Why org-scoped:** Creating a team invitation requires the caller to be in the target org. An invitation issued by Org A cannot grant access to Org B resources.  
**Why mutation-capable:** POST creates a new invitation record — state-changing.  
**W2-PR1 enforcement:** Middleware blocks unauthenticated callers (403) and cross-org callers (404). Route handler in W2-PR4 validates org owns the invitation context.  
**Readonly allowed?** NO — readonly members cannot create invitations.

### `/api/verifier/invite/[code]/accept`
**Classification:** `authenticated` (not org-scoped at middleware level)  
**Why authenticated not org-scoped:** The accept flow uses an invitation code, not an org context. The code itself determines the org. Middleware cannot validate org without knowing the code's target org.  
**W2-PR1 enforcement:** Middleware checks userId present. Route handler (W2-PR4) validates the code is valid, not expired, and assigns the invitee to the correct org.  
**Readonly allowed?** N/A — this creates org membership.

### `/api/verifier/team` (if present)
**Classification:** `org-scoped`, `readonly-safe` (GET), `mutation-capable` (POST/DELETE)  
**Why org-scoped:** Team roster is scoped to the caller's org.  
**W2-PR1 enforcement:** Middleware enforces org-scope via x-verifier-org vs JWT org_id.  
**Readonly allowed?** YES for GET (viewing team roster). NO for POST/DELETE (adding/removing members).

### `/api/verifier/packet` or `/api/verifier/review/*` (if present)
**Classification:** `org-scoped`, `readonly-safe` (GET), `mutation-capable` (POST)  
**Why org-scoped:** Evidence packets are owned by the verifier org that requested them.  
**W2-PR1 enforcement:** Middleware enforces org-scope.  
**Readonly allowed?** YES for GET (reading a packet). NO for POST (accepting, routing).

---

## Explicitly NOT Affected by W2-PR1

These routes are classified for completeness. W2-PR1 does not change their auth state.

### `/api/employer-review/[entityId]/[action]`
**Current classification:** `authenticated` (accept/confirm-start/request-refresh/route-to-review), `public` (view, acceptance-history)  
**Current threat:** Any authenticated user (including CLINICIAN) can call `accept`. No VERIFIER role check. No org check.  
**W2-PR1 impact:** NONE — this route is not in the `VERIFIER_API` namespace.  
**Fixed in:** W2-PR2.

### `/api/audit/events`
**Current classification:** `public` (no auth guard detected)  
**Current threat:** Unauthenticated callers can read the audit log.  
**W2-PR1 impact:** NONE.  
**Fixed in:** W2-PR3.

### `/api/psv/oig/check/[npi]`, `/api/psv/oig/batch`
**Current classification:** `public` (no auth guard detected)  
**W2-PR1 impact:** NONE.  
**Fixed in:** W2-PR3.

### `/api/hiring/accept`, `/api/hiring/start`
**Current classification:** `public` (no auth guard detected)  
**W2-PR1 impact:** NONE.  
**Fixed in:** W2-PR3.

### `/api/employer/applications`, `/api/employer/decisions`
**Current classification:** `public` (no auth guard detected)  
**W2-PR1 impact:** NONE.  
**Fixed in:** W2-PR3.

---

## Routes That Remain Public by Design (Confirmed Acceptable)

These routes are intentionally public and must not be gated in W2-PR1 or any future wave without explicit architectural review:

| Route | Reason public |
|---|---|
| `GET /api/passport/[npi]` | Clinician-controlled public share; no PHI |
| `GET /api/review/[entityId]` | Employer-scoped shared link; time-limited |
| `GET /api/trust-state/[npi]` | NPI trust state is public health information |
| `GET /api/entity/resolve/npi/[npi]` | NPPES data is public |
| `GET /api/verify-professional/[npi]` | Public verification surface |
| `GET /api/health`, `GET /api/readyz` | Infrastructure health endpoints |
| `GET /api/.well-known/jwks.json` | OpenID Connect required public endpoint |
| `GET /api/status` | Public status page data |
| `GET /api/compliance/evidence` | Public security posture document |

---

## The Middleware Enforcement Gap: Why Middleware-Only Is Insufficient

**Answer: Middleware-only enforcement is structurally insufficient for full tenant isolation.**

### Why:
Middleware operates at the Edge runtime. It has no DB access, no knowledge of which org owns a given resource (entity ID, packet ID, etc.). It can only validate:
1. "Is the caller authenticated?" (userId from Clerk)
2. "Is the caller's JWT org_id consistent with their x-verifier-org claim?" (timing-safe compare)
3. "Is the caller's team_role permitted for this HTTP method?" (readonly check)

What middleware CANNOT validate:
- "Does this entity ID belong to the org the caller represents?"
- "Was this packet created by the org making the request?"
- "Is this invitation code intended for the requesting user's org?"

### Consequence:
A verifier from Org A could set `x-verifier-org: org_a` (their own org, which passes middleware), then request `/api/verifier/packet/entity-123` where entity-123 belongs to Org B. Middleware passes. Only the route handler can catch this.

### Required invariant:
Every `/api/verifier/*` route handler must perform a resource ownership check: "Does this resource belong to `ctx.requestingOrgId`?" This is the Layer 2 check that makes the full system tenant-safe.

**W2-PR1 documents this requirement. W2-PR2 and W2-PR3 implement it.**

---

## orgId Trust Rules

**Q: May orgId EVER be trusted from client input?**

**A: No — with a precise definition of "trusted."**

| Source | Trust level | Permitted use |
|---|---|---|
| Clerk JWT `sessionClaims.vitalcv.org_id` | Trusted (Clerk-signed, tamper-proof) | Used as `requestingOrgId` in RBAC check |
| `x-verifier-org` request header | Untrusted (client-controlled) | Compared against JWT org_id as a claim declaration. Never used as a resource ownership proof. |
| Request body `{"orgId": "..."}` | Untrusted (client-controlled) | Never accepted. Immediately discard any body-supplied org ID. |
| URL path parameter | Untrusted (client-controlled) | May be used as resource identifier, but route handler must verify the resource belongs to the JWT org. |
| Query parameter | Untrusted (client-controlled) | Same as body — never accept org scoping from query params. |

**The rule:** Only `sessionClaims.vitalcv.org_id` from the Clerk JWT establishes who the caller represents. All other sources of org identity are decorative or advisory, never authoritative.
