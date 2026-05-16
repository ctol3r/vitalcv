# RBAC Wave 2 — Test Plan
**Wave:** Wave 2 — Verifier RBAC Hardening  
**Date:** 2026-05-07  
**Classification:** HIGH_RISK  
**Status:** Planning only  

---

## Test Coverage Requirements

Every Wave 2 PR must include targeted tests. No PR merges without passing tests.

---

## W2-PR1 Test Requirements (Verifier RBAC Types + Middleware)

### File: `apps/web/__tests__/verifier-rbac-types.test.ts` (or merged into existing)

**Must assert:**

```typescript
// 1. VERIFIER_TEAM_ROLES is frozen as a const
expect(VERIFIER_TEAM_ROLES).toEqual(['owner', 'admin', 'member', 'readonly']);
expect(VERIFIER_TEAM_ROLES).toContain('readonly');

// 2. rbacEnforced is the literal true
const { rbacEnforced } = checkVerifierPermission({ orgId: 'org1', userId: 'u1', method: 'GET', requesterOrgId: 'org1' });
// (or however the module exports this flag)
expect(rbacEnforced).toBe(true);   // NOT expect(rbacEnforced).toBeTruthy()

// 3. No org context → 403
const result1 = checkVerifierPermission({ orgId: undefined, userId: 'u1', method: 'POST', requesterOrgId: 'org1' });
expect(result1.status).toBe(403);
expect(result1.reason).toBe('no_org_context');

// 4. Cross-org → 404 (not 403 — must not reveal the resource exists)
const result2 = checkVerifierPermission({ orgId: 'org1', userId: 'u1', method: 'POST', requesterOrgId: 'org2' });
expect(result2.status).toBe(404);
expect(result2.reason).toBe('cross_org_denied');

// 5. Readonly + mutating method → 403
const result3 = checkVerifierPermission({ orgId: 'org1', userId: 'u1', method: 'POST', requesterOrgId: 'org1', teamRole: 'readonly' });
expect(result3.status).toBe(403);
expect(result3.reason).toBe('readonly_cannot_mutate');

// 6. Owner + mutating method → allowed
const result4 = checkVerifierPermission({ orgId: 'org1', userId: 'u1', method: 'POST', requesterOrgId: 'org1', teamRole: 'owner' });
expect(result4.allowed).toBe(true);

// 7. Timing-safe comparison: orgId comparison must use crypto.timingSafeEqual
// (checked in Codex implementation audit, not directly testable via unit test)
```

**Middleware regression tests** (must run post-rebase):

```typescript
// 8. /verifier/* requires VERIFIER role
// 9. /issuer/* requires ISSUER role
// 10. /internal/* requires ADMIN role
// 11. /holder/* requires CLINICIAN role
// 12. /intelligence/* requires AUTHENTICATED (any role)
// 13. / (root) is public
// 14. /api/* passes through (middleware does not gate API routes)
```

---

## W2-PR2 Test Requirements (Employer-Review VERIFIER Gate)

### File: `apps/web/__tests__/verifier-rbac-employer-review.test.ts` (new)

**Must assert (all using mock Clerk session):**

```typescript
// 1. CLINICIAN role → 403 on accept
await expect(callAction('accept', { role: 'CLINICIAN' })).resolves.toMatchObject({ status: 403 });

// 2. VERIFIER role, no org → 403 on accept
await expect(callAction('accept', { role: 'VERIFIER', orgId: undefined })).resolves.toMatchObject({ status: 403 });

// 3. VERIFIER role, readonly teamRole → 403 on accept
await expect(callAction('accept', { role: 'VERIFIER', orgId: 'org1', teamRole: 'readonly' })).resolves.toMatchObject({ status: 403 });

// 4. VERIFIER role, admin teamRole, orgId present → 200 (proxied to backend)
await expect(callAction('accept', { role: 'VERIFIER', orgId: 'org1', teamRole: 'admin' })).resolves.toMatchObject({ status: 200 });

// 5. Unauthenticated → 401 on accept
await expect(callAction('accept', { userId: undefined })).resolves.toMatchObject({ status: 401 });

// 6. view action (PUBLIC_MUTATION_ACTION) → 200 without auth
await expect(callAction('view', {})).resolves.toMatchObject({ status: 200 });

// 7. acceptance-history (PUBLIC_READ_ACTION) → 200 without auth
await expect(callAction('acceptance-history', {})).resolves.toMatchObject({ status: 200 });

// 8. ISSUER role → 403 on request-refresh
await expect(callAction('request-refresh', { role: 'ISSUER' })).resolves.toMatchObject({ status: 403 });

// 9. orgId is forwarded to backend as x-clerk-org-id header
// Mock the fetch proxy and assert the header is present
const fetchSpy = jest.spyOn(global, 'fetch');
await callAction('accept', { role: 'VERIFIER', orgId: 'org-123' });
expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
  headers: expect.objectContaining({ 'x-clerk-org-id': 'org-123' })
}));
```

---

## W2-PR3 Test Requirements (API Route Guards)

### File: `apps/web/__tests__/rbac-api-route-guards.test.ts` (new)

**Must assert:**

```typescript
// 1. GET /api/audit/events — unauthenticated → 401
// 2. GET /api/audit/events — CLINICIAN role → 403
// 3. GET /api/audit/events — ADMIN role → 200

// 4. POST /api/psv/oig/check/[npi] — unauthenticated → 401
// 5. POST /api/psv/oig/check/[npi] — CLINICIAN role → 200 (clinicians can check their own OIG status)
//    NOTE: Clinicians requesting their own OIG check is acceptable; check for overclaimed access

// 6. POST /api/psv/oig/batch — unauthenticated → 401
// 7. POST /api/psv/oig/batch — CLINICIAN role → 403 (batch is verifier-only)
// 8. POST /api/psv/oig/batch — VERIFIER role → 200

// 9. POST /api/hiring/accept — unauthenticated → 401
// 10. POST /api/hiring/accept — CLINICIAN role → 403
// 11. POST /api/hiring/accept — VERIFIER role, orgId present → 200

// 12. POST /api/hiring/start — unauthenticated → 401
// 13. POST /api/hiring/start — CLINICIAN role → 403

// 14. GET /api/employer/applications — unauthenticated → 401
// 15. GET /api/employer/decisions — unauthenticated → 401
// 16. POST /api/employer/setup — unauthenticated → 401

// 17. apiGuard helper: requireAuth returns 401 response object when userId missing
// 18. apiGuard helper: requireAuth returns 403 when role mismatch
// 19. apiGuard helper: requireAuth returns null (pass-through) when role matches
```

---

## W2-PR4 Test Requirements (Verifier Invitation Foundation)

### Existing test file from PR #248 + additions

**Must assert:**

```typescript
// 1. invitationSystemLive is the literal false (not a variable — the literal)
// Note: if this is the literal `false` in a type, Codex implementation audit verifies it
expect(INVITATION_FOUNDATION.invitationSystemLive).toBe(false);
// NOT: expect(INVITATION_FOUNDATION.invitationSystemLive).toBeFalsy()

// 2. POST /api/verifier/invite → 401 without auth
// 3. POST /api/verifier/invite → 403 without VERIFIER role
// 4. POST /api/verifier/invite → 200 with VERIFIER role and valid org
// 5. Invitation state machine covers: pending → accepted, pending → expired
// 6. Expired invitation → 404 on accept attempt
// 7. Already-accepted invitation → 409 on second accept
// 8. Invitation code is not guessable (random, >= 32 chars or UUID)
```

---

## Pre-Merge Codex Audit Prompts

### W2-PR1 Codex Audit

```
Audit W2-PR1 (feat/verifier-rbac-rebased) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm VERIFIER_TEAM_ROLES = ['owner','admin','member','readonly'] as const
- Confirm rbacEnforced is the literal true (not a variable, not a boolean cast)
- Confirm checkVerifierPermission evaluates exactly 3 gates in order:
    1. no org context → 403
    2. cross-org (timing-safe comparison) → 404
    3. readonly + mutating method → 403
- Confirm timing-safe comparison: orgId comparison uses crypto.timingSafeEqual
  (not === or == which leak timing)
- Confirm no org context returns 403 NOT 401 (do not leak authentication state)
- Confirm cross-org returns 404 NOT 403 (do not reveal the resource exists)

2. DIFF AUDIT
- Confirm ONLY these files changed:
    apps/web/middleware.ts
    apps/web/lib/auth/roles.ts
    apps/web/lib/auth/orgInvitations.ts (new)
    apps/web/__tests__/verifier-rbac-types.test.ts (new or modified)
- Confirm ALL existing PROTECTED_ROUTES patterns are preserved in middleware.ts
- Confirm /verifier/* still requires VERIFIER role
- Confirm /issuer/* still requires ISSUER role
- Confirm /api/** still passes through (no new API gating in middleware)

3. COPY/TRUTH AUDIT
- Confirm no banned strings in new files
- Confirm no "rbacEnforced: false" anywhere (must be literal true)
- Confirm no claim that cross-tenant access is permitted

Verdict: SAFE or FAIL with specific line references.
```

---

### W2-PR2 Codex Audit

```
Audit W2-PR2 (feat/verifier-rbac-employer-review) against origin/main (after W2-PR1 merged).

1. IMPLEMENTATION AUDIT
- Confirm role check fires for all AUTHENTICATED_MUTATION_ACTIONS before proxy call
- Confirm CLINICIAN role → 403 (not 401, not 404)
- Confirm missing orgId → 403 with reason 'no_org_context'
- Confirm readonly teamRole → 403 with reason 'readonly_cannot_mutate'
- Confirm orgId is forwarded as x-clerk-org-id in proxy headers
- Confirm PUBLIC_MUTATION_ACTIONS (view) are NOT gated by role check
- Confirm PUBLIC_READ_ACTIONS (acceptance-history) are NOT gated by role check
- Confirm AuditEvent write path is NOT bypassed (it fires in the backend, not here)

2. DIFF AUDIT
- Confirm ONLY these files changed:
    apps/web/app/api/employer-review/[entityId]/[action]/route.ts
    apps/web/__tests__/verifier-rbac-employer-review.test.ts (new)
- Confirm no changes to packages/
- Confirm no Prisma schema changes

3. COPY/TRUTH AUDIT
- Confirm error messages do not leak internal role names ("VERIFIER" is OK in error; "internal role X" is not)
- Confirm no banned strings
- Confirm 'view' action response does not claim a verification occurred

Verdict: SAFE or FAIL.
```

---

### W2-PR3 Codex Audit

```
Audit W2-PR3 (feat/rbac-api-route-guards) against origin/main.

1. IMPLEMENTATION AUDIT
- Confirm each gated route: auth() is called, userId is checked, role is checked
- Confirm /api/audit/events requires ADMIN role (not just any auth)
- Confirm /api/psv/oig/batch requires VERIFIER or ADMIN role
- Confirm /api/hiring/accept requires VERIFIER or ADMIN role
- Confirm /api/hiring/start requires VERIFIER or ADMIN role
- Confirm employer/* routes require userId (any authenticated user, not role-specific)
- Confirm apiGuard.ts helper is server-only (no client imports)
- Confirm 401 vs 403 distinction: missing userId → 401, wrong role → 403

2. DIFF AUDIT
- Confirm ONLY the 10 listed files are changed
- Confirm /api/passport/*, /api/review/*, /api/trust-state/* are NOT changed
- Confirm /api/health, /api/readyz, /api/compliance/evidence are NOT changed
- Confirm no Prisma schema changes

3. COPY/TRUTH AUDIT
- Confirm error responses do not leak internal architecture
  ('Unauthorized' or 'Forbidden' is fine; stack traces or role names are not)
- Confirm no banned strings

Verdict: SAFE or FAIL.
```

---

## Pre-Implementation Prerequisite Checklist

Before Claude Code Terminal starts W2-PR1, verify:

- [ ] Founder Clerk account has `publicMetadata.vitalcv.role = 'VERIFIER'` (check Clerk dashboard)
- [ ] Founder Clerk account has an active org (`orgId` present in session)  
- [ ] Caller of `/api/audit/events` identified — confirm it's only from ADMIN routes
- [ ] Callers of `/api/psv/oig/*` identified — confirm none are public surfaces
- [ ] Callers of `/api/hiring/*` identified — confirm none are public surfaces
- [ ] Wave 1 (truth-contract restoration) is merged first — Wave 2 should follow clean copy

If any prerequisite check fails, resolve it before starting Wave 2 implementation.
