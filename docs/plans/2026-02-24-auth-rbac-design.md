# Auth & RBAC Design: Production-Grade Role-Based Authorization

**Date:** 2026-02-24
**Branch:** `phase/trust-safety-signals`
**Status:** Approved

## Overview

Harden VitalCV's existing Clerk-based authentication with a production-grade
authorization layer. Clerk remains the identity provider. Prisma becomes the
canonical source of truth for roles and org membership. Clerk JWT carries role
claims for zero-latency middleware checks.

### Goals

1. Prisma `User` model linked to Clerk `userId` — authorization only, no profile duplication.
2. Role enum: `CLINICIAN | VERIFIER | ISSUER | ADMIN`.
3. Hybrid sync: Prisma authoritative, Clerk metadata (`publicMetadata.vitalcv`) synced for fast reads.
4. Role-based routing enforced in Next.js middleware (fast path) and Express backend guards (sensitive ops).
5. Demo bypass removed from production flows.
6. Type-safe sessions across the full stack.
7. Minimal, targeted test coverage on security boundaries.

### Non-Goals

- Replacing Clerk with Auth.js or any other provider.
- Multi-role users (single `role` field for now, `roleVersion` for migration path).
- E2E browser auth tests (Clerk owns the UI).
- Duplicating Clerk profile data in Prisma.

---

## 1. Data Model

### New Enums

```prisma
enum UserRole {
  CLINICIAN
  VERIFIER
  ISSUER
  ADMIN
}

enum UserStatus {
  ACTIVE
  INVITED
  SUSPENDED
  DEACTIVATED
}
```

### New Model

```prisma
model User {
  id             String     @id @default(uuid()) @db.Uuid
  clerkUserId    String     @unique
  email          String     @unique
  role           UserRole   @default(CLINICIAN)
  roleVersion    Int        @default(1)
  status         UserStatus @default(INVITED)
  organizationId String?    @db.Uuid
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([clerkUserId])
  @@index([organizationId])
  @@index([role])
  @@index([status])
}
```

### Application-Level Invariants

Enforced in service layer (not DB constraints):

- `CLINICIAN` -> `organizationId` MUST be `null`
- `VERIFIER` / `ISSUER` -> `organizationId` MUST NOT be `null`
- `ADMIN` -> `organizationId` is optional (platform-level role)

### Design Decisions

- `clerkUserId` bridges Clerk identity to our domain.
- `organizationId` nullable because clinicians own their own wallet (org-less).
- Single `role` field (not array) — YAGNI. `roleVersion` (int, default 1) future-proofs
  migration when roles split (e.g., `VERIFIER` -> `VERIFIER_ADMIN` + `VERIFIER_REVIEWER`).
- `INVITED` as default status — new users require explicit activation before accessing
  sensitive verification data.
- Links to existing `Organization` model already in schema.

---

## 2. Sync Architecture

### Hybrid Model

```
Prisma User table  ← AUTHORITATIVE (canonical role source)
Clerk publicMetadata.vitalcv  ← CACHE (fast JWT claim for middleware)
```

Sync is best-effort. Clerk metadata failure does NOT block Prisma writes.
No cross-system atomicity assumption.

### Direction 1: Clerk -> Prisma (user creation via webhook)

**Trigger:** Clerk `user.created` webhook

**Flow:**

1. Verify Svix signature (reject 401 on invalid).
2. Extract `clerkUserId` + `email`.
3. Check if User row exists (idempotency guard).
4. If NOT exists: create User with `role: CLINICIAN, status: INVITED`.
5. If exists: **do nothing** — never overwrite existing role/status.
6. Sync current role to Clerk `publicMetadata.vitalcv` (best-effort).

**Idempotency:** Duplicate webhook deliveries must not reset an already-configured
user back to `CLINICIAN/INVITED`. The webhook only creates, never overwrites.

### Direction 2: Prisma -> Clerk (role changes via sync utility)

```typescript
// lib/auth/sync-role.ts
async function syncRoleToClerk(
  clerkUserId: string,
  role: UserRole,
  roleVersion: number
): Promise<void> {
  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      vitalcv: { role, roleVersion }
    }
  });
}
```

Called from:

- Admin dashboard role assignment
- Programmatic role changes (e.g., pilot activation -> VERIFIER)
- Wrapped in helper that updates Prisma first, then syncs Clerk with retry on failure

### Direction 3: Fallback (middleware, no role claim in JWT)

Race condition: user signs up -> webhook delayed -> user visits app -> no JWT claim yet.

**Resolution:**

1. Middleware detects missing `vitalcv` claim.
2. Fetches internal API route `GET /api/auth/resolve-role` (Node runtime, NOT Edge).
3. API route looks up User by `clerkUserId`.
4. If found: returns role, triggers async Clerk metadata sync.
5. If NOT found: creates minimal User row (`CLINICIAN/INVITED`), returns role, syncs.
6. Middleware redirects to role-appropriate landing (forces JWT refresh on next request).
7. If resolution fails entirely: redirect to `/auth/error` (circuit breaker, prevents loops).

### Data Flow Diagram

```
+------------+  webhook   +------------+  upsert   +----------+
|   Clerk    |----------->| /api/      |---------->|  Prisma  |
| (identity) |           | webhooks/  |           |  User    |
+------------+           | clerk      |           +----------+
     ^                   +------------+                |
     |                                                 |
     |  updateUserMetadata                             |
     |  (publicMetadata.vitalcv)                       |
     +-------------------------------------------------+
                   syncRoleToClerk()

+----------------+  reads JWT claim   +--------------+
|   Next.js      |<------------------| Clerk JWT    |
|   Middleware   |  vitalcv.role      | (session)    |
|   (fast path)  |                    +--------------+
+----------------+
       | fallback (no claim)
       v
+----------------+
| /api/auth/     |  <- Node runtime, Prisma lookup
| resolve-role   |  <- creates row on-demand if missing
+----------------+
       | failure
       v
+----------------+
| /auth/error    |  <- circuit breaker, prevents redirect loops
+----------------+
```

---

## 3. Middleware & Route Guards

### 3A. Route Map

| Route Pattern            | Required Role | Auth Required | Notes                      |
|--------------------------|---------------|---------------|----------------------------|
| `/`                      | --            | No            | Landing page               |
| `/sign-in/**`, `/sign-up/**` | --        | No            | Clerk auth pages           |
| `/intake/**`             | --            | No            | Public clinician intake    |
| `/verify/**`             | --            | No            | Public verification lookup |
| `/trust-state/**`        | --            | No            | Public artifact viewer     |
| `/holder/**`             | `CLINICIAN`   | Yes           | Clinician wallet dashboard |
| `/holder/checklist`      | `CLINICIAN`   | Yes           | Role-based credential list |
| `/verifier/**`           | `VERIFIER`    | Yes           | Employer verification      |
| `/issuer/**`             | `ISSUER`      | Yes           | Credential issuance        |
| `/internal/**`           | `ADMIN`       | Yes           | Internal ops pages         |
| `/demo`                  | --            | No            | 308 redirect to `/`        |

### 3B. Next.js Middleware Logic

Runs on Edge Runtime. No DB calls on happy path.

```
Request arrives
  |
  +-- Is public route? -> pass through
  |
  +-- Is /demo? -> 308 redirect to /
  |
  +-- Is user authenticated? (Clerk session)
  |    No -> redirect to /sign-in
  |
  +-- Read role: auth().sessionClaims.vitalcv?.role
  |
  +-- Has role claim?
  |    No -> fetch /api/auth/resolve-role (Node runtime)
  |         -> On success: redirect to role landing (forces JWT refresh)
  |         -> On failure: redirect to /auth/error
  |
  +-- Does role match route?
  |    No -> redirect to role's default landing
  |         Exception: /internal/** mismatch -> redirect to /
  |
  +-- Pass through (authorized)
```

**Post-login redirect mapping:**

| Role        | Default Landing     |
|-------------|---------------------|
| `CLINICIAN` | `/holder`           |
| `VERIFIER`  | `/verifier`         |
| `ISSUER`    | `/issuer`           |
| `ADMIN`     | `/internal/metrics` |

**Design constraints:**

- No DB calls in middleware (Edge runtime).
- Role mismatch -> redirect to role landing (not 403). Friendlier, prevents route leaks.
- `/internal/**` mismatch -> redirect to `/` (not to role dashboard).
- `noopMiddleware` fallback removed. Clerk MUST be configured in production.
- `/api/auth/resolve-role` runs in Node runtime (Prisma cannot run on Edge).

### 3C. Backend API Guards (Express)

Two-layer guard system:

**Layer 1: `clerkAuthGuard`** (all protected routes)

- Verifies Clerk session token from `Authorization: Bearer <token>` header.
- Extracts `clerkUserId` and role claim.
- Attaches to `req.auth`.

**Layer 2: `requireRole(...roles)`** (role-specific routes)

- Reads role from `req.auth` (Clerk claim, fast path).
- For sensitive operations: re-verifies against Prisma `User` table.
- Returns 403 if role doesn't match.

**Guard level by operation type:**

| Operation                    | Guard Level                                |
|------------------------------|--------------------------------------------|
| Self-read (own trust state)  | Layer 1 only (authenticated)               |
| Cross-user read              | Layer 1 + `requireRole` + Prisma org check |
| Issue credentials            | Layer 1 + `requireRole('ISSUER')` + Prisma |
| Change user roles            | Layer 1 + `requireRole('ADMIN')` + Prisma  |
| Revoke credentials           | Layer 1 + `requireRole('ADMIN')` + Prisma  |

**Key distinction:** Reads of own data trust the JWT claim. Cross-user reads require
org membership verification against Prisma. Writes affecting other users always
re-check Prisma.

### 3D. Demo Bypass Removal

1. **`apps/web/lib/api.ts`** -- Remove `DEMO_MODE`, `DEMO_PATHS`, conditional path
   resolution. `apiRoute()` becomes simple `base + path`.
2. **`apps/web/app/demo/page.tsx`** -- Replace with 308 permanent redirect to `/`.
3. **Environment flags** -- Remove `NEXT_PUBLIC_DEMO_MODE` from `.env.example` and
   any deployment configs.
4. **Backend demo routes** -- Preserved (`/demo/*` in Express). They are public API
   endpoints useful for integration testing, but no longer reachable via frontend bypass.

### 3E. Type Safety

Global Clerk session claim augmentation:

```typescript
// types/clerk.d.ts
interface VitalCVMetadata {
  role: 'CLINICIAN' | 'VERIFIER' | 'ISSUER' | 'ADMIN';
  roleVersion: number;
}

declare module '@clerk/nextjs/server' {
  interface CustomJwtSessionClaims {
    vitalcv?: VitalCVMetadata;
  }
}
```

Provides type-safe `auth().sessionClaims?.vitalcv?.role` throughout the app.

---

## 4. Testing Strategy

### 4A. Test Surfaces

| Surface                  | Tool              | Runtime     | What it proves                   |
|--------------------------|-------------------|-------------|----------------------------------|
| Middleware route guards  | Vitest + mock     | Unit        | Role->route mapping, redirects   |
| Backend API guards       | Vitest + supertest| Integration | Express middleware enforcement    |
| Role sync utility        | Vitest + mock     | Unit        | Prisma->Clerk sync correctness   |
| Webhook handler          | Vitest + mock     | Unit        | Clerk->Prisma idempotency        |

### 4B. Middleware Tests (highest priority)

**Table-driven route guard matrix:**

```
(route,        role,        expected)
("/holder",    "CLINICIAN", "allow")
("/holder",    "VERIFIER",  "redirect:/verifier")
("/holder",    "ISSUER",    "redirect:/issuer")
("/holder",    null,        "redirect:/sign-in")
("/verifier",  "CLINICIAN", "redirect:/holder")
("/verifier",  "VERIFIER",  "allow")
("/verifier",  "ADMIN",     "redirect:/internal/metrics")
("/issuer",    "ISSUER",    "allow")
("/issuer",    "CLINICIAN", "redirect:/holder")
("/internal",  "ADMIN",     "allow")
("/internal",  "VERIFIER",  "redirect:/")
("/internal",  "CLINICIAN", "redirect:/")
("/",          null,        "allow")
("/intake",    null,        "allow")
("/demo",      null,        "redirect:/ (308)")
```

Mocks `@clerk/nextjs/server` `auth()` to return controlled session claims.

**Route leak sentinel test:**

Extracts all route patterns from the middleware config and asserts every protected
pattern appears in the test matrix. If a new route is added to the middleware matcher
but not to the test matrix, the sentinel fails. Prevents untested routes from shipping.

### 4C. Backend Guard Tests

supertest against Express app:

```
(endpoint,                  method, role,       expected)
("GET /trust-state/:npi",  GET,    "CLINICIAN", 200)  // self-read
("GET /trust-state/:npi",  GET,    null,        401)  // no auth
("POST /ingest/npi",       POST,   "CLINICIAN", 200)  // own data
("POST /ingest/npi",       POST,   "VERIFIER",  403)  // wrong role
("GET /verification/...",  GET,    "VERIFIER",  200)  // org-scoped read (own org)
("GET /verification/...",  GET,    "VERIFIER",  403)  // cross-org read blocked
```

**JWT tampering test:** JWT claim says `ADMIN`, Prisma User row says `VERIFIER`.
Sensitive write (e.g., role change) -> Prisma wins -> 403 denied.

### 4D. Sync & Webhook Tests

**Sync utility:**

- Happy path: Prisma update + `updateUserMetadata` called with `{ vitalcv: { role, roleVersion } }`
- Clerk API failure: function throws, caller handles retry
- Idempotency: calling sync with same role is safe

**Webhook handler:**

- `user.created` -> creates User row `CLINICIAN / INVITED`
- Duplicate `user.created` -> does NOT overwrite existing role/status (idempotent)
- Invalid Svix signature -> 401 rejection
- Webhook replay (valid signature, duplicate event ID) -> no-op
- Missing required fields -> 400, no row created

**Race condition test:**

- No role claim in JWT + no User row in Prisma
- Fallback `/api/auth/resolve-role` creates User row
- Returns `CLINICIAN` role
- Subsequent requests use JWT claim (no further fallback needed)

### 4E. Demo Removal Tests

- `GET /demo` returns 308 with `Location: /`
- No references to `NEXT_PUBLIC_DEMO_MODE` in any `.env*` or config files
- `apiRoute()` function has no conditional demo path logic

### 4F. What We Are NOT Testing

- E2E browser auth flows (Clerk owns the UI)
- Clerk SDK internals (we mock Clerk)
- Session cookie mechanics (Clerk owns transport)
- Rate limiting in auth context (existing tests cover this)

### 4G. Test File Layout

```
apps/web/__tests__/
  middleware.test.ts               <- route guard matrix + sentinel
  api/auth/resolve-role.test.ts    <- fallback endpoint + race condition

apps/api/backend/src/__tests__/
  guards/
    clerkAuthGuard.test.ts         <- token verification
    requireRole.test.ts            <- role enforcement + org scoping + JWT tampering
  auth/
    syncRole.test.ts               <- Prisma->Clerk sync
    webhook.test.ts                <- idempotency, signatures, replays
```

---

## 5. File Manifest

New files to create:

```
apps/api/backend/prisma/schema.prisma          (modify: add User, UserRole, UserStatus)
apps/api/backend/prisma/migrations/...          (auto: prisma migrate)

apps/web/middleware.ts                          (modify: role-based guards)
apps/web/types/clerk.d.ts                       (new: session claim types)
apps/web/app/api/auth/resolve-role/route.ts     (new: fallback role resolution)
apps/web/app/api/webhooks/clerk/route.ts        (new: Clerk webhook handler)
apps/web/app/auth/error/page.tsx                (new: auth error circuit breaker)
apps/web/app/demo/page.tsx                      (modify: 308 redirect)
apps/web/lib/api.ts                             (modify: remove demo bypass)
apps/web/lib/auth/sync-role.ts                  (new: Prisma->Clerk sync utility)
apps/web/lib/auth/roles.ts                      (new: role constants + route mapping)

apps/api/backend/src/auth/jwt.ts                (modify: expand role types)
apps/api/backend/src/middleware/clerkAuthGuard.ts (new: Clerk token verification)
apps/api/backend/src/middleware/requireRole.ts   (new: role enforcement + org scoping)

apps/web/__tests__/middleware.test.ts            (new)
apps/web/__tests__/api/auth/resolve-role.test.ts (new)
apps/api/backend/src/__tests__/guards/clerkAuthGuard.test.ts  (new)
apps/api/backend/src/__tests__/guards/requireRole.test.ts     (new)
apps/api/backend/src/__tests__/auth/syncRole.test.ts          (new)
apps/api/backend/src/__tests__/auth/webhook.test.ts           (new)
```

Files to remove:

```
(none — demo backend routes preserved for integration testing)
```
