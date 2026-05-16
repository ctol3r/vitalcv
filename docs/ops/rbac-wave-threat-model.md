# RBAC Wave 2 — Threat Model
**Wave:** Wave 2 — Verifier RBAC Hardening  
**Date:** 2026-05-07  
**Classification:** HIGH_RISK  
**Authority:** CLAUDE.md, openclaw-risk-classification.md  
**Status:** Planning only — no implementation

---

## Critical Finding: All API Routes Are Currently Public via Middleware

```typescript
// apps/web/lib/auth/roles.ts — PUBLIC_ROUTE_PATTERNS
/^\/api(\/.*)?$/,  // API routes handle their own auth
```

**This means:** Middleware provides zero protection for any `/api/*` route. Every route handler is solely responsible for its own authentication. Routes without an explicit `auth()` call are completely unprotected.

---

## Threat Matrix — API Surface

### Tier 1: CRITICAL (unauthenticated access to sensitive state)

| Route | Method | Current auth | Threat | Blast radius |
|---|---|---|---|---|
| `POST /api/employer-review/[entityId]/[action]` where action=`accept` | POST | `userId` check only — NO role check | Any authenticated user (including clinicians) can accept a clinician on behalf of an employer | HIGH |
| `POST /api/employer-review/[entityId]/[action]` where action=`confirm-start` | POST | `userId` check only | Any authenticated user can confirm a clinical start | HIGH |
| `GET /api/audit/events` | GET | None detected | Full audit log readable by any unauthenticated caller | CRITICAL |
| `GET/POST /api/psv/oig/check/[npi]` | GET/POST | None detected | OIG check triggers accessible without auth | HIGH |
| `POST /api/psv/oig/batch` | POST | None detected | Batch OIG triggers accessible without auth | HIGH |
| `POST /api/hiring/accept` | POST | None detected | Hiring acceptance endpoint accessible without auth | CRITICAL |
| `POST /api/hiring/start` | POST | None detected | Start confirmation accessible without auth | CRITICAL |
| `GET /api/compliance/evidence` | GET | None detected | Compliance evidence shape readable without auth | MEDIUM |
| `GET /api/employer/applications` | GET | None detected | Employer application list accessible without auth | HIGH |
| `GET /api/employer/decisions` | GET | None detected | Employer decision history accessible without auth | HIGH |
| `POST /api/employer/setup` | POST | None detected | Employer account setup accessible without auth | HIGH |

### Tier 2: HIGH (auth present but no role or tenant check)

| Route | Method | Current auth | Threat |
|---|---|---|---|
| `POST /api/employer-review/[entityId]/accept` | POST | `userId` only | CLINICIAN role user can accept their own candidacy |
| `POST /api/employer-review/[entityId]/request-refresh` | POST | `userId` only | Any authenticated user can trigger verifier refresh |
| `POST /api/employer-review/[entityId]/route-to-review` | POST | `userId` only | Any authenticated user can route to review |
| `GET /api/employer-review/[entityId]/packet` | GET | `userId` only | Any authenticated user can read an evidence packet |
| `GET /api/employer-review/[entityId]/status` | GET | `userId` only | Any authenticated user can read review status |
| `GET/POST /api/apply/*` | GET/POST | Varies | No org-scoped tenant isolation |
| `GET /api/candidates` | GET | `userId` only | Any authenticated user can list all candidates |
| `POST /api/trust/events` | POST | None detected | Trust events can be written without auth |

### Tier 3: MEDIUM (public by design but warrants review)

| Route | Current state | Risk |
|---|---|---|
| `GET /api/passport/[npi]` | Public | NPI-based public profile — acceptable if no PHI |
| `GET /api/review/*` | Public in middleware | Review packets are clinician-shared links — acceptable if correctly scoped |
| `GET /api/trust-state/[npi]` | Public | Public trust state — acceptable |
| `GET /api/verify-professional/[npi]` | Public | Public verification — acceptable |
| `GET /api/entity/resolve/npi/[npi]` | Public | Public NPI resolution — acceptable |

### Tier 4: ACCEPTABLE (genuinely public)

```
/api/health, /api/readyz, /api/deploy-info,
/api/.well-known/jwks.json, /api/system/status,
/api/compliance/evidence (public posture doc — low risk)
```

---

## Tenant Boundary Threats

### T-01: Cross-Org Acceptance
**Description:** A user with `userId` in Org A can call `POST /api/employer-review/[entityId]/accept` for a candidate being reviewed by Org B. No `orgId` check exists in the current route handler.

**Why dangerous:** An employer competitor could accept candidates on behalf of a rival org, polluting their audit trail and creating compliance risk.

**Evidence:** The route reads `userId` from Clerk session but does NOT read `orgId`. The backend proxy receives `x-clerk-user-id` but has no tenant scope injected.

### T-02: Clinician Self-Acceptance
**Description:** A CLINICIAN-role user is authenticated and can call `accept` on their own entity review. The route checks `userId` but not that the `userId` maps to a VERIFIER role.

**Why dangerous:** Allows clinicians to self-accept, bypassing the entire employer review flow.

### T-03: Audit Log Leakage
**Description:** `GET /api/audit/events` has no auth guard (grep confirmed no `auth()` call). Any unauthenticated caller can read the system audit log.

**Why dangerous:** Audit logs contain entity IDs, user IDs, timestamps, and action types — operational data that should be ADMIN-gated.

### T-04: OIG Check Injection
**Description:** `POST /api/psv/oig/batch` has no auth guard. Any caller can trigger OIG checks against arbitrary NPIs.

**Why dangerous:** Could be used to probe OIG status of providers without being an authenticated verifier. Creates unbounded API usage.

---

## Current RBAC State vs Required State

| Capability | Current | Required for Pilot |
|---|---|---|
| `/verifier/*` page routes protected | ✅ VERIFIER role required in middleware | ✅ |
| Verifier team roles defined | ✅ PR #243 defines `owner/admin/member/readonly` (not yet merged) | Needs merge |
| Invitation system live | ⚠️ Foundation only (`invitationSystemLive: false`) | Needs merge (#248) |
| `/api/employer-review/*` mutations require VERIFIER role | ❌ Only requires `userId` | Required |
| `/api/employer-review/*` mutations require matching `orgId` | ❌ No org check | Required |
| `/api/audit/events` requires auth | ❌ No auth guard | Required |
| `/api/psv/oig/*` requires auth | ❌ No auth guard | Required |
| `/api/hiring/*` requires auth | ❌ No auth guard | Required |
| Verifier readonly cannot mutate | ⚠️ Defined in PR #243 (not merged) | Needs merge |
| Cross-tenant reuse blocked | ⚠️ PR #240 (conflicting, not merged) | Needs merge |

---

## Explicit Non-Threats (Acceptable Current State)

These are not threats and should NOT be changed in Wave 2:

- Public passport pages (`/passport/[id]`) — clinician controls sharing; no PHI exposed
- Public review packet links (`/review/*`) — time-scoped, clinician-shared
- Intelligence routes (`/intelligence/*`) — AUTHENTICATED guard via middleware
- Public NPI resolution (`/api/entity/resolve/npi/[npi]`) — NPPES data is public
- `GET /api/review/*` — Public by design; review is a shared link pattern
- `GET /api/trust-state/[npi]` — Public trust state
