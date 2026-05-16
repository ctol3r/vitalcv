# W2-PR1 — RBAC Foundation Plan
**Wave:** Wave 2, PR 1  
**Date:** 2026-05-07  
**Classification:** HIGH_RISK (middleware.ts modification)  
**Status:** Planning only — no implementation  
**Source PR:** feat/verifier-rbac (PR #243) — rebase required  
**Depends on:** Wave 1 (truth-contract restoration) merged to main

---

## Scope Statement

W2-PR1 installs the RBAC primitives that all subsequent Wave 2 PRs depend on.  
It does exactly four things and nothing else:

1. Add `VERIFIER_TEAM_ROLES` and `VerifierTeamRole` to `lib/auth/roles.ts`
2. Add `lib/auth/orgInvitations.ts` — pure RBAC decision function, no I/O
3. Modify `middleware.ts` — intercept `/api/verifier/*` before the public API pass-through
4. Add `__tests__/verifier-rbac-enforcement.test.ts` — deterministic pure-function tests

**Explicitly NOT in W2-PR1:**
- Employer-review acceptance role check (W2-PR2)
- Unguarded API route guards (W2-PR3)
- Invitation lifecycle (W2-PR4)
- Hiring flow changes
- Audit route changes
- Prisma schema changes

---

## Ground Truth from PR #243

PR #243 has one commit (`eb65f45b`). The implementation is well-formed and needs a rebase — not a rewrite. The core is already correct:

### `lib/auth/roles.ts` additions (clean)
```typescript
export const VERIFIER_TEAM_ROLES = ['owner', 'admin', 'member', 'readonly'] as const;
export type VerifierTeamRole = (typeof VERIFIER_TEAM_ROLES)[number];
```
Privilege order (ascending): `readonly < member < admin < owner`

### `lib/auth/orgInvitations.ts` (clean — pure transform, no I/O)
- `rbacEnforced = true as const` — sealed literal
- `checkVerifierPermission(ctx: MembershipContext): RbacDecision` — 3-gate evaluation
- `timingSafeEqualStrings(a, b)` — constant-time org_id comparison
- `parseTeamRole(raw)` — safe parser that returns `null` for unknown roles

### `middleware.ts` additions (needs conflict resolution)
```typescript
const VERIFIER_API = /^\/api\/verifier(\/.*)?$/;
// Fires BEFORE the /api/* public-route pass-through
if (VERIFIER_API.test(pathname)) {
  // auth check → JWT claim extraction → checkVerifierPermission → pass/block
}
```

### `__tests__/verifier-rbac-enforcement.test.ts` (clean)
Deterministic pure-function tests. 4 invariant groups: readonly, cross-org, timing-safe, no-org-context.

---

## Critical Architectural Decision: `x-verifier-org` Header

The middleware in PR #243 derives `resourceOrgId` from a client-supplied HTTP header:
```typescript
const resourceOrgId = req.headers.get('x-verifier-org') ?? '';
```

This requires explicit justification because it appears to allow clients to spoof resource ownership.

### Why this is safe (two-layer defense model)

**Layer 1 — Middleware (what PR #243 implements):**  
Validates the claim: "Does your JWT org_id match the org you're claiming to represent?"

```
requestingOrgId (from JWT — Clerk-signed, tamper-proof)
    === (timing-safe)
resourceOrgId   (from x-verifier-org header — client-supplied, untrusted)
```

If they don't match → 404. This means:
- Verifier in Org A cannot set `x-verifier-org: org_b` and get through
- Verifier in Org A CAN set `x-verifier-org: org_a` and pass middleware

**Layer 2 — Route handler (NOT in W2-PR1, required in subsequent PRs):**  
"Does the resource being accessed actually belong to Org A?"

The route handler must verify that the entity ID in the URL belongs to the requesting org. Until this layer-2 check is implemented, the middleware provides identity validation only, not full resource ownership isolation.

### What `x-verifier-org` is NOT:
- It is NOT a resource ownership claim that can bypass authentication
- It is NOT accepted from anonymous callers (must have valid Clerk session)
- It is NOT trusted as proof that Org A owns the resource

### What `x-verifier-org` IS:
- A client declaration of "which org I am acting on behalf of"
- Validated against the Clerk JWT claim (tamper-proof)
- Required to be present for any VERIFIER_API route (missing → 404)

### Documentation requirement
W2-PR1 must include a comment in middleware.ts explicitly documenting this two-layer model and the responsibility of route handlers for layer-2 resource ownership checks. Without this comment, future developers may believe middleware provides complete tenant isolation.

---

## Middleware Conflict Analysis

PR #243 is CONFLICTING because the main branch has moved. Since `eb65f45b`, main has received:
- PR #275 (Code Red final verification docs — no middleware change)
- PR #274 (board delta — no middleware change)
- PR #273 (dossier foundation — likely no middleware change)
- PR #268 (knowledge inbox surface — possible middleware change)
- PR #262 (pricing page — no middleware change)
- PR #261 (/status source-health panel — no middleware change)
- etc.

**Most likely conflict surface:** The `const INTELLIGENCE_API` line and surrounding area in middleware.ts. The PR #243 adds `const VERIFIER_API` adjacent to `INTELLIGENCE_API`. If any intervening PR touched that region, there will be a conflict.

### Conflict resolution rule (inviolable):
When resolving middleware.ts conflict:
1. Preserve ALL existing `PROTECTED_ROUTES` entries
2. Preserve ALL existing `PUBLIC_ROUTE_PATTERNS`
3. Preserve the `INTELLIGENCE_API` graceful-degrade pattern
4. Insert the VERIFIER_API block as the FIRST check inside `clerkHandler`, BEFORE step 1 ("Public routes pass through")
5. If the conflict is in the INTELLIGENCE_API constant: keep both — they serve different purposes

---

## PR Scope Boundary

### Files changed: 4 exactly

| File | Change type | Risk |
|---|---|---|
| `apps/web/lib/auth/roles.ts` | Additive — new exports only | LOW |
| `apps/web/lib/auth/orgInvitations.ts` | New file — pure function | MEDIUM |
| `apps/web/middleware.ts` | Modification — adds VERIFIER_API intercept | HIGH |
| `apps/web/__tests__/verifier-rbac-enforcement.test.ts` | New test file | LOW |

### Files must NOT change

```
apps/web/lib/issuer-verification/          # PSV trust chain — untouched
apps/web/prisma/schema.prisma              # Schema — never in this PR
apps/web/app/api/employer-review/          # Acceptance logic — W2-PR2
apps/web/app/api/audit/                    # Audit routes — W2-PR3
apps/web/app/api/hiring/                   # Hiring flows — W2-PR3
apps/web/app/api/psv/                      # OIG/PSV routes — W2-PR3
packages/                                   # All packages — untouched
```

---

## Forbidden Trust Assumptions (Absolute)

W2-PR1 must not encode any of these assumptions:

1. **Never trust `x-verifier-org` as a resource ownership proof.** It validates identity only. Route handlers own resource ownership.

2. **Never widen `rbacEnforced` from literal `true` to `boolean`.** It must be `true as const`.

3. **Never collapse cross-org (404) and no-org-context (403) into the same error.** They are semantically distinct and must remain distinct.

4. **Never short-circuit the timing-safe comparison on length mismatch.** Equal-length padding must be processed for both strings. Length-based early return is a timing oracle.

5. **Never allow an empty `resourceOrgId` to pass the cross-org check.** Empty string vs any org ID is always a mismatch → 404.

6. **Never trust the role from a non-JWT source.** `teamRole` comes from `sessionClaims?.vitalcv?.team_role` only. Not from headers, body, or query params.

7. **Never gate public routes through the VERIFIER_API intercept.** The pattern `/^\/api\/verifier(\/.*)?$/` is precise. Do not broaden it.

---

## Branch and Rebase Instructions for Claude Code Terminal

```bash
# Setup
git fetch origin main
git worktree add -b feat/verifier-rbac-rebased /tmp/vitalcv-w2pr1 origin/main
cd /tmp/vitalcv-w2pr1
pnpm install

# Bring the PR #243 commit onto origin/main
git fetch origin feat/verifier-rbac
git cherry-pick eb65f45b
# OR: git rebase --onto origin/main <base-before-eb65f45b> feat/verifier-rbac

# Resolve middleware.ts conflict:
# Rule 1: All PROTECTED_ROUTES preserved
# Rule 2: VERIFIER_API block goes as step 0 (before isPublicRoute check)
# Rule 3: INTELLIGENCE_API graceful-degrade preserved
# Rule 4: Add two-layer defense comment (see auth-helper-spec.md)

# Verify
pnpm turbo run build --filter='!@vitalcv/web'
pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
pnpm typecheck
pnpm lint
git diff --staged | grep -E "rbacEnforced|timingSafeEqual|VERIFIER_TEAM_ROLES"  # confirm present
```

---

## Completion Definition

W2-PR1 is complete when:
- [ ] All 4 files and only those 4 files are in the diff
- [ ] `rbacEnforced = true as const` in orgInvitations.ts
- [ ] `checkVerifierPermission` has 3 gates in documented order
- [ ] `timingSafeEqualStrings` processes all bytes regardless of length
- [ ] middleware.ts VERIFIER_API intercept is step 0 (before isPublicRoute)
- [ ] middleware.ts two-layer defense comment is present
- [ ] All existing middleware guards preserved (diff confirmed)
- [ ] All 4 invariant groups in tests pass
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] Codex SAFE verdict in transcript
