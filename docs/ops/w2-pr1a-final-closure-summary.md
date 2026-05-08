# W2-PR1A — Final Closure Summary

**Branch:** `wave/w2-pr1a-fail-closed` (off `wave/w2-pr1-rbac-foundation`)
**Risk classification:** **HIGH_RISK** (middleware modification on auth path)
**Status:** patch wave — eliminates fail-open authorization conditions identified by Codex SAFE on W2-PR1.
**Codex parent verdict:** PR #280 (W2-PR1) → UNSAFE (fail-open holes); this PR closes them.

---

## Mission

Eliminate the two fail-open authorization conditions Codex SAFE flagged on W2-PR1:

1. **Missing-Clerk → public exposure of `/api/verifier/**`.** When `CLERK_SECRET_KEY` is unset, the outer middleware enters a fallback branch that calls `isPublicRoute(pathname)`. Because `/api/*` is in `PUBLIC_ROUTE_PATTERNS` as a delegation contract, `/api/verifier/foo` matched → `NextResponse.next()` → verifier routes exposed publicly when Clerk is missing.

2. **Type-asserted claim extraction.** The Step-0 block used `session.sessionClaims?.vitalcv as Record<string, unknown> | undefined`. The downstream `typeof` checks were correct, but the assertion bypassed runtime validation — Codex flagged this as a fail-open code smell (a future refactor could silently allow malformed claims through).

Both are now fixed. PR is intentionally tight: 3 product files + 4 docs + 24 new test cases.

---

## Files changed (7)

### Product (3)

| File | Change | Lines |
|---|---|---|
| `apps/web/lib/auth/orgInvitations.ts` | additive — three new helpers (`isVerifierApiRoute`, `checkVerifierFailClosed`, `extractVerifierClaims`) + one private helper (`isPlainObject`) | +127 |
| `apps/web/middleware.ts` | three surgical edits: import the new helpers; add fail-closed pre-check at top of outer middleware (before `!CLERK_MIDDLEWARE_ENABLED`); replace type-asserted Step-0 claim extraction with `extractVerifierClaims(...)` | +24 / -10 |
| `apps/web/__tests__/verifier-rbac-enforcement.test.ts` | 24 new test cases (5 describe blocks): namespace predicate, fail-closed pre-check, runtime claim validation, integration with `checkVerifierPermission` | +260 |

### Docs (4)

| File | Purpose |
|---|---|
| `docs/ops/w2-pr1a-final-closure-summary.md` | this doc |
| `docs/ops/w2-pr1a-final-risk-review.md` | adversarial self-review focused on degraded-auth states |
| `docs/ops/FAIL_CLOSED_MATRIX.md` | constitutional reference: 15 authorization-degradation scenarios + required fail-closed behavior |
| `docs/ops/AUTHORIZATION_LAYERS.md` | constitutional reference: canonical layered authorization model |

### Files NOT changed

```
apps/web/prisma/schema.prisma              # No schema in this PR
apps/web/lib/issuer-verification/          # PSV trust chain — untouched
apps/web/app/api/employer-review/          # Ownership authorization — W2-PR2
apps/web/app/api/audit/                    # Audit RBAC — W2-PR3
apps/web/app/api/hiring/                   # Hiring workflows — W2-PR3
apps/web/app/api/psv/                      # PSV routes — W2-PR3
apps/web/app/api/verifier/                 # Route handlers — W2-PR4
apps/web/lib/auth/roles.ts                 # No role changes
apps/web/lib/auth/clerkConfig.ts           # Untouched
packages/                                   # All packages untouched
```

---

## Exact middleware changes

### Edit 1 — Import the new helpers

Before:
```typescript
import { checkVerifierPermission, parseTeamRole } from '@/lib/auth/orgInvitations';
```

After:
```typescript
import {
  checkVerifierFailClosed,
  checkVerifierPermission,
  extractVerifierClaims,
  isVerifierApiRoute,
} from '@/lib/auth/orgInvitations';
```

`parseTeamRole` is no longer imported by middleware directly — it's used internally by `extractVerifierClaims`. Single source of truth for claim-shape validation.

### Edit 2 — Remove the local `VERIFIER_API` regex

Before: `const VERIFIER_API = /^\/api\/verifier(\/.*)?$/;` declared at module scope, used twice (inside `clerkHandler` and conceptually intended for the outer fail-closed check).

After: removed. Both call sites use `isVerifierApiRoute(pathname)` from `orgInvitations.ts`. The regex is in ONE place; tests cover its semantics directly.

### Edit 3 — Fail-closed pre-check at the TOP of the outer middleware

Before (post-CORS, line 188 of W2-PR1 middleware):
```typescript
if (!CLERK_MIDDLEWARE_ENABLED) {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next();   // ← FAIL OPEN for /api/verifier/*
  }
  // ...
}
```

After:
```typescript
// W2-PR1A — verifier-API fail-closed enforcement (security-critical).
const verifierFailClosed = checkVerifierFailClosed({
  pathname: req.nextUrl.pathname,
  clerkEnabled: CLERK_MIDDLEWARE_ENABLED,
});
if (verifierFailClosed.failClosed) {
  return new NextResponse(null, {
    status: verifierFailClosed.statusCode,        // 503
    headers: { 'x-rbac-fail-closed': verifierFailClosed.reason },  // 'clerk_unavailable'
  });
}

if (!CLERK_MIDDLEWARE_ENABLED) {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next();   // ← unchanged for non-verifier routes
  }
  // ...
}
```

The fail-closed pre-check fires **before** `isPublicRoute`, so the public-route wildcard for `/api/*` cannot expose verifier routes.

### Edit 4 — Runtime claim validation in Step 0

Before (inside `clerkHandler`):
```typescript
const claims = session.sessionClaims?.vitalcv as Record<string, unknown> | undefined;
const requestingOrgId =
  typeof claims?.org_id === 'string' && claims.org_id.length > 0
    ? claims.org_id
    : null;
const teamRole = parseTeamRole(claims?.team_role);
```

After:
```typescript
const { requestingOrgId, teamRole } = extractVerifierClaims(session.sessionClaims);
```

The new helper performs runtime validation of every shape: `sessionClaims` is checked for plain-object, `vitalcv` is checked for plain-object, `org_id` is checked for non-empty string, `team_role` flows through `parseTeamRole` (already a total function on `unknown`). No type assertions remain. Hostile input (Symbol, function, recursive object) does not throw — `extractVerifierClaims` is total.

---

## Exact invariants enforced

| Invariant | Source | Enforcement |
|---|---|---|
| `/api/verifier/**` MUST never become public | this PR's mission | `checkVerifierFailClosed` fires before `isPublicRoute` |
| Missing Clerk config must fail closed | `SECURITY_INVARIANTS.md` §5.4 | `clerkEnabled: false` + verifier path → 503 `clerk_unavailable` |
| `PUBLIC_ROUTE_PATTERNS` must not implicitly expose verifier routes | mission | The `/api/*` wildcard is a delegation contract; verifier routes opt out via the pre-check |
| Runtime org_id validation, not type assertions | mission | `extractVerifierClaims` uses `typeof` + `Array.isArray` + `null` checks; zero `as` casts |
| Non-string org claims must fail closed | mission | Number / null / object / array `org_id` → null → Gate 1 (`no_org_context`) → 403 |
| Wildcard `/api/**` patterns must never override verifier protection | mission | Pre-check fires before any `/api/*` matcher |
| Degraded auth must reduce capability, never widen exposure | doctrine | 503 closes the path entirely; never falls through to `next()` |

---

## Adversarial threat coverage (24 new test cases)

### `isVerifierApiRoute` — namespace predicate (3 tests)

- Matches `/api/verifier`, `/api/verifier/`, and any subpath
- **Defense**: rejects adjacent paths that could be confused for verifier (`/api/verifiers` plural, `/api/verifier-api`, `/api/v/verifier`, `/verifier` missing prefix, `/api/verify` separate-namespace, `/api/employer-review/anything`)
- **Defense**: empty / non-conforming pathnames safely return `false`

### `checkVerifierFailClosed` — fail-closed pre-check (5 tests)

- Returns `failClosed: true, statusCode: 503, reason: 'clerk_unavailable'` for verifier route + Clerk disabled
- Does NOT fire for verifier route + Clerk enabled (normal flow takes over)
- Does NOT fire for non-verifier routes (e.g., `/api/health` may degrade gracefully when Clerk is down)
- **Defense**: does NOT fire for routes that LOOK like verifier (`/api/verify/...`, `/api/verifiers`)
- **Lock**: type-level assertion that the status code stays 503 (regression block on accidental widening to 200)

### `extractVerifierClaims` — runtime validation (12 tests)

Each test asserts the helper handles malformed input by returning `{requestingOrgId: null, teamRole: null}` — never throwing, never coercing into a permission:

- Well-formed claims → extracted correctly
- `sessionClaims` missing (undefined / null) → null/null
- `sessionClaims` non-object (string / number / boolean) → null/null
- `sessionClaims` is array (not a record) → null/null
- `vitalcv` claim missing → null/null
- `vitalcv` claim non-object (string / number / null / array) → null/null
- `org_id` non-string (number / null / object / array) → null org_id, valid teamRole
- `org_id` empty string → null org_id (collapses to Gate 1 — cleaner 403 than Gate 2's 404)
- `team_role` unknown role string → valid org_id, null teamRole
- `team_role` non-string (number / null / object) → valid org_id, null teamRole
- Partial JWT payloads (org_id only / team_role only) → partial extraction
- **Defense**: function is total — recursive objects, Symbols, functions don't throw

### Integration tests — composition with `checkVerifierPermission` (3 tests)

- Malformed `sessionClaims` → `no_org_context` (403, NOT cross_org/404)
- Non-string `org_id` with valid `team_role` → `no_org_context` (403, NOT cross_org/404)
- `vitalcv` claim is an array (attacker forging payload shape) → `no_org_context`

The integration tests lock the exact status-code semantics under malformed input — the path is 403 (Gate 1) not 404 (Gate 2) so an attacker probing for "does this org exist" via timing differences cannot distinguish a malformed-JWT-from-Org-A request from a malformed-JWT-from-Org-B request.

---

## Verification

```
$ pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
  Test Files  1 passed (1)
        Tests  50 passed (50)
        (W2-PR1 26 cases + W2-PR1A 24 new)

$ pnpm --filter @vitalcv/web exec vitest run
  Test Files  157 passed | 1 skipped (158)
        Tests  1517 passed | 4 skipped (1521)
        (W2-PR1 baseline 1493 + W2-PR1A's 24 new = 1517; no regressions)

$ pnpm --filter @vitalcv/web exec next lint <three-touched-files>
  ✔ No ESLint warnings or errors

$ pnpm turbo run build --filter @vitalcv/web
  Tasks: 13 successful, 13 total
  Time: 31.709s
  (Edge-runtime compile clean; helper functions are Edge-safe — no node:crypto)
```

---

## Intentionally deferred (out of W2-PR1A scope)

| Item | Wave | Reason |
|---|---|---|
| Layer-2 ownership authorization (route handlers verify resource belongs to JWT org) | W2-PR4 | Requires actual `/api/verifier/*` route handlers, none exist on main today |
| Employer-review acceptance role + ownership | W2-PR2 | Different namespace; different file path; ownership concern |
| Audit / hiring / PSV API guards | W2-PR3 | Different namespace; needs `ADMIN`-role gate + audit-event writes |
| Verifier invitation lifecycle | W2-PR4 | Requires Prisma model + DB writer |
| Pre-existing `BLOCKING_REASON_ORDER` `ACTIVE_DIVERGENCE` bug | separate one-line PR | Unrelated; W1.1 surfaced this |
| Force JWT refresh on org-role change | follow-up | Clerk session-management concern, not RBAC code |
| Rate limit on `/api/verifier/*` 503 responses | follow-up | DoS amplification protection if attackers spam fail-closed paths |

---

## Per-PR doctrine compliance checklist

Per `VITALCV_OPERATING_DOCTRINE.md`:

- [x] No banned strings introduced (§2.5)
- [x] No bare `>Verified<` rendered (§2.7) — N/A (no UI)
- [x] No new vendor name claimed (§1.2) — N/A
- [x] Every new mutating endpoint writes `AuditEvent` (§5.1) — N/A
- [x] No literal-typed invariant widened to `boolean` (§2.3, §6.3) — `rbacEnforced`, `failClosed: true` literal preserved
- [x] No env flag introduced bypassing auth/audit/RBAC (§6.4)
- [ ] Codex SAFE verdict in transcript — **REQUIRED BEFORE MERGE**

Per `SECURITY_INVARIANTS.md`:

- [x] No new public route added (§5.1)
- [x] Every new dynamic-segment route has explicit ownership check (§3.5) — N/A
- [x] No `actorId` defaulted (§4.2) — N/A
- [x] No string-compare on a secret without timing-safe path (§6.2)
- [x] No reordering of `checkVerifierPermission(...)` gates (§6.3) — gates unchanged
- [x] Cross-org returns 404, not 403 (§5.5) — preserved
- [x] **Unknown auth states fail closed (§5.4) — NEW: enforced by this PR's fail-closed pre-check**
- [x] **Security-sensitive routes fail closed (§5.3) — NEW: enforced by this PR**
- [ ] Founder review obtained for HIGH_RISK middleware change (§7.1) — **REQUIRED BEFORE MERGE**
- [ ] Codex SAFE verdict in transcript (§7.3) — **REQUIRED**

---

## Rollback

`gh pr revert <PR-NUMBER>`. Removes the three product file changes; the four docs are deleted with the revert. **No data, schema, or persisted state is affected.** Reverting puts back the W2-PR1 fail-open behavior (verifier routes exposed when Clerk missing) — DO NOT revert unless replacing with a tighter fix.
