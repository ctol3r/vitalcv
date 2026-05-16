# RBAC Wave 2 — PR Plan
**Wave:** Wave 2 — Verifier RBAC Hardening  
**Date:** 2026-05-07  
**Classification:** HIGH_RISK  
**Status:** Planning only — no implementation  
**Reference:** rbac-wave-threat-model.md

---

## Sequencing Principle

Wave 2 is split into four sequential PRs. Each PR is independently mergeable after Codex SAFE. Later PRs depend on earlier ones. No PR exceeds 12 files.

```
W2-PR1 (rebase existing): Verifier team RBAC types + middleware guard
  ↓
W2-PR2 (new): Employer-review mutations require VERIFIER role + orgId scope
  ↓
W2-PR3 (new): Gate audit/OIG/hiring API routes behind auth
  ↓
W2-PR4 (rebase existing): Verifier invitation lifecycle foundation
```

**No schema changes in any of these PRs.** RBAC is Clerk JWT + runtime checks only.

---

## W2-PR1 — Rebase and Merge PR #243 (Verifier RBAC Types + Middleware)

**Branch:** `feat/verifier-rbac` (exists — rebase needed against origin/main)  
**Based on:** Existing PR #243 — 4 files  
**Risk:** HIGH_RISK (middleware.ts)  
**Prisma:** No  

### What it delivers
- `apps/web/lib/auth/roles.ts` gains `VERIFIER_TEAM_ROLES = ['owner','admin','member','readonly'] as const` and `VerifierTeamRole` type
- `apps/web/lib/auth/orgInvitations.ts` (new) — pure RBAC logic with `rbacEnforced: true` literal
- `checkVerifierPermission(ctx)` evaluates 3 gates: no-org → 403, cross-org (timing-safe) → 404, readonly+mutating → 403
- Middleware updated to enforce verifier-team role checking on `/verifier/*` routes
- 1 test file

### Rebase procedure
```bash
git fetch origin main
git worktree add -b feat/verifier-rbac-rebased /tmp/vitalcv-rbac1 origin/main
cd /tmp/vitalcv-rbac1
git fetch origin feat/verifier-rbac
git checkout -b feat/verifier-rbac-rebased
git rebase origin/main

# Conflict expected: apps/web/middleware.ts
# Resolution rule: preserve ALL existing route guards
# Add verifier team check AFTER the existing role check (step 6 in current middleware)
# Never remove any existing guard
```

### What NOT to change
- Existing `PROTECTED_ROUTES` order or patterns
- `isPublicRoute()` logic
- `/api/**` public pass-through (that's wave W2-PR3)
- Any route outside `middleware.ts`, `lib/auth/roles.ts`, `lib/auth/orgInvitations.ts`

### Exit criteria
- `rbacEnforced` is the literal `true` in `orgInvitations.ts`
- `checkVerifierPermission` evaluates all 3 gates
- Timing-safe cross-org comparison exists (no direct string equality for orgId)
- Existing middleware route guards are all preserved (diff audit confirms)
- `pnpm typecheck` passes
- Targeted vitest suite passes

---

## W2-PR2 — Employer-Review Mutations: VERIFIER Role + OrgId Check

**Branch:** `feat/verifier-rbac-employer-review` (new)  
**Files:** ~5 files  
**Risk:** HIGH_RISK  
**Prisma:** No  

### What it delivers

Adds two checks to `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` for all `AUTHENTICATED_MUTATION_ACTIONS`:

**Check 1 — Role check:** The caller must have `VERIFIER` role (read from Clerk JWT claim `publicMetadata.vitalcv.role`). Return 403 if role is `CLINICIAN`, `ISSUER`, or missing.

**Check 2 — OrgId check:** The caller's Clerk `orgId` must be present. Return 403 if no org context. The `orgId` is forwarded to the backend as `x-clerk-org-id` header. The backend is responsible for verifying the org owns this review (or has been delegated access).

**Readonly guard:** If the verifier team role (from Clerk publicMetadata or org membership) is `readonly`, reject all mutation actions with 403.

```typescript
// Pseudocode for the new check block (insert after existing userId check):
const requiredRole = UserRole.VERIFIER;
const userRole = session.sessionClaims?.vitalcv?.role;
if (!userRole || userRole !== requiredRole) {
  return NextResponse.json({ error: 'Verifier role required.' }, { status: 403 });
}

const orgId = session.orgId;
if (!orgId) {
  return NextResponse.json({ error: 'Organization context required.' }, { status: 403 });
}

const teamRole = session.sessionClaims?.vitalcv?.teamRole as string | undefined;
if (teamRole === 'readonly') {
  return NextResponse.json({ error: 'Readonly verifier cannot perform this action.' }, { status: 403 });
}
```

Forward `orgId` in all proxy headers:
```typescript
headers: {
  ...
  'x-clerk-user-id': userId,
  'x-clerk-org-id': orgId,    // NEW
}
```

### Files to change
```
apps/web/app/api/employer-review/[entityId]/[action]/route.ts
apps/web/__tests__/verifier-rbac-employer-review.test.ts  (new)
```

### Files NOT to change
```
apps/web/middleware.ts        (handled in W2-PR1)
apps/web/lib/auth/roles.ts    (handled in W2-PR1)
apps/web/prisma/schema.prisma (never)
packages/*                    (never in this wave)
```

### Failure modes to guard against
- Do NOT check `session.orgId` synchronously before awaiting `auth()` — always await first
- Do NOT leak whether a specific entityId exists (return 403, not 404, for role failures)
- Do NOT add role check to `PUBLIC_MUTATION_ACTIONS` (view remains public by design)
- Do NOT add role check to `PUBLIC_READ_ACTIONS` or `acceptance-history` (public by design)

### Exit criteria
- `CLINICIAN` role user returns 403 on `accept`
- No org context returns 403 on `accept`
- `readonly` team role returns 403 on `accept`
- VERIFIER with org context returns 2xx on `accept`
- `view` action still works without auth
- `acceptance-history` still works without auth
- `pnpm typecheck` passes
- All 4 test scenarios pass

---

## W2-PR3 — Gate Unprotected Sensitive API Routes

**Branch:** `feat/rbac-api-route-guards` (new)  
**Files:** ~8 files  
**Risk:** HIGH_RISK  
**Prisma:** No  

### What it delivers

Adds minimal auth guards to the CRITICAL and HIGH threat tier API routes identified in the threat model.

**Routes to gate:**

| Route | Guard to add | Return on failure |
|---|---|---|
| `GET /api/audit/events` | `auth()` — require `userId` + ADMIN role | 403 |
| `POST /api/psv/oig/check/[npi]` | `auth()` — require `userId` | 401 |
| `GET /api/psv/oig/check/[npi]` | `auth()` — require `userId` | 401 |
| `POST /api/psv/oig/batch` | `auth()` — require `userId` + VERIFIER or ADMIN | 403 |
| `POST /api/hiring/accept` | `auth()` — require `userId` + VERIFIER or ADMIN | 403 |
| `POST /api/hiring/start` | `auth()` — require `userId` + VERIFIER or ADMIN | 403 |
| `GET /api/employer/applications` | `auth()` — require `userId` | 401 |
| `GET /api/employer/decisions` | `auth()` — require `userId` | 401 |
| `POST /api/employer/setup` | `auth()` — require `userId` | 401 |

**Shared guard helper (new file):**
```typescript
// apps/web/lib/auth/apiGuard.ts  (new file)
// requireAuth(session, options?) — throws or returns early with 401/403
// Options: { role?: UserRoleType; orgRequired?: boolean; teamRole?: VerifierTeamRole[] }
```

### Files to change
```
apps/web/app/api/audit/events/route.ts
apps/web/app/api/psv/oig/check/[npi]/route.ts
apps/web/app/api/psv/oig/batch/route.ts
apps/web/app/api/hiring/accept/route.ts
apps/web/app/api/hiring/start/route.ts
apps/web/app/api/employer/applications/route.ts
apps/web/app/api/employer/decisions/route.ts
apps/web/app/api/employer/setup/route.ts
apps/web/lib/auth/apiGuard.ts                    (new)
apps/web/__tests__/rbac-api-route-guards.test.ts  (new)
```

### Files NOT to change
```
apps/web/middleware.ts
apps/web/prisma/schema.prisma
apps/web/app/api/passport/*      (public by design)
apps/web/app/api/review/*        (public by design)
apps/web/app/api/trust-state/*   (public by design)
apps/web/app/api/entity/*        (public by design)
apps/web/app/api/health          (public by design)
```

### Key constraint
The `auth()` call pattern must be consistent with existing guarded routes:
```typescript
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
Do not introduce a different auth pattern — stay consistent with existing guarded routes.

### Exit criteria
- All 8 routes return 401 when called without a session
- `/api/audit/events` returns 403 when called by non-ADMIN authenticated user
- `/api/psv/oig/batch` returns 403 when called by CLINICIAN role
- `/api/hiring/accept` returns 403 when called without VERIFIER or ADMIN role
- All existing guarded behavior unchanged
- `pnpm typecheck` passes

---

## W2-PR4 — Rebase and Merge PR #248 (Verifier Invitation Foundation)

**Branch:** `feat/verifier-invitations` (exists — rebase may be needed)  
**Based on:** Existing PR #248 — 11 files  
**Risk:** GUARDED  
**Prisma:** No  
**Dependency:** W2-PR1 must be merged first  

### What it delivers
- `POST /api/verifier/invite` — invitation creation endpoint
- `/verifier/team/invite` page — team invite UI
- `/verifier/invite/[code]/accept` page — invitation acceptance
- `lib/auth/clerkInvitationSender.ts` — Clerk email invite dispatch
- Foundation behavior: `invitationSystemLive: false` flag preserved — this is a foundation, not a live activation
- 2 test files

### Key constraint
`invitationSystemLive: false` must remain as a literal `false` in the foundation type. The invitation system exists but is not activated in production without a separate flag flip. Do not change it to `true` in this PR.

### Rebase procedure
```bash
git fetch origin main
git worktree add -b feat/verifier-invitations-rebased /tmp/vitalcv-rbac4 origin/main
cd /tmp/vitalcv-rbac4
git fetch origin feat/verifier-invitations
git checkout -b feat/verifier-invitations-rebased
git rebase origin/main
# If tests conflict with W2-PR1 changes: preserve W2-PR1 test additions
```

### Exit criteria
- `/api/verifier/invite` exists and requires auth
- Foundation test passes: `invitationSystemLive` is `false` in the type export
- Invitation code state machine covers: pending → accepted → expired
- `pnpm typecheck` passes

---

## Wave 2 Total Scope Summary

| PR | New files | Modified files | Risk | Schema? |
|---|---|---|---|---|
| W2-PR1 | 2 (orgInvitations.ts + test) | 2 (roles.ts + middleware.ts) | HIGH_RISK | No |
| W2-PR2 | 1 (test) | 1 (employer-review route) | HIGH_RISK | No |
| W2-PR3 | 2 (apiGuard.ts + test) | 8 (route handlers) | HIGH_RISK | No |
| W2-PR4 | 5 (invite API + pages + sender + tests) | 1 (existing types) | GUARDED | No |
| **Total** | **10** | **12** | HIGH_RISK | **No** |

All 4 PRs require full Codex three-audit. W2-PR1 and W2-PR2 require Claude Desktop architectural pre-review.
