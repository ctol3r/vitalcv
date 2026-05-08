# VitalCV Fail-Closed Matrix

**Version:** 2026-05-07 · **Status:** constitutional · **Authority:** subordinate to `VITALCV_OPERATING_DOCTRINE.md` and `SECURITY_INVARIANTS.md`; supersedes implementation-convenience appeals to "let it pass through."

This document enumerates every known authorization-degradation scenario in VitalCV and the required fail-closed behavior. Every row is enforceable through CI gates, code review, and the merge protocol. New degradation scenarios are added by appending; rows are not deleted without founder approval.

**Definitions** (used throughout this matrix):

- **FAIL_CLOSED** — the request is rejected with the most-restrictive honest response. The system reduces capability when uncertain; it does not widen access.
- **NEVER_PUBLIC** — under the named scenario, the named route MUST NOT return a 2xx success that exposes data; an explicit error response is required.
- **SAFE_RESPONSE** — a structured response with no resource data; minimum-information disclosure that does not reveal the route's existence, the tenant's identity, or the failure cause beyond a coarse header.
- **enumeration-resistant response** — a response code that cannot be used to distinguish "resource exists but you can't see it" from "resource does not exist." For VitalCV: `404` for cross-tenant; `503` for unavailable-auth-service; `403` for known-actor / forbidden-method.

---

## Matrix

### 1. Missing Clerk secret (`CLERK_SECRET_KEY` absent)

| Field | Value |
|---|---|
| Trigger condition | `process.env.CLERK_SECRET_KEY` is `undefined` or empty string |
| Affected routes | All `/api/verifier/**`; degraded handling permitted on `/api/intelligence/**` and `/api/investigation/**` per existing graceful-degrade pattern |
| Expected behavior | **FAIL_CLOSED** — return `503 Service Unavailable` with header `x-rbac-fail-closed: clerk_unavailable`; empty body |
| Allowed fallback | None for `/api/verifier/**`. For non-verifier `/api/*`: existing Clerk-disabled fallback in `middleware.ts` (sign-in redirect for protected routes) |
| Forbidden fallback | `NextResponse.next()` for any `/api/verifier/**` path. Returning the route's normal response. Returning a public-style 200. |
| Security invariant protected | `SECURITY_INVARIANTS.md` §5.4 (unknown auth states fail closed); §1.3 (orgId never trusted from client) |
| Regression test coverage | `verifier-rbac-enforcement.test.ts` — `checkVerifierFailClosed — fail-closed pre-check` (5 cases), `lock: 503 status code never widens` |

### 2. Missing auth middleware (Clerk handler absent or stripped)

| Field | Value |
|---|---|
| Trigger condition | `clerkMiddleware(...)` import fails, or `middleware.ts` is bypassed entirely (e.g., misconfigured `config.matcher`) |
| Affected routes | All routes that depend on middleware enforcement |
| Expected behavior | **FAIL_CLOSED** at the framework boundary — Next.js routing returns the route handler's response WITHOUT auth, so the route handler MUST refuse if it cannot resolve a session. For `/api/verifier/**`, route handlers must call `auth()` directly (or via a shared helper) and return 503/403 if the session is absent. |
| Allowed fallback | Route handlers may emit 503 with `x-rbac-fail-closed: middleware_bypassed` if they detect auth absence. |
| Forbidden fallback | Returning 200 with resource data. Trusting that "middleware would have rejected this." |
| Security invariant protected | §1.4 (middleware validates identity coherence only — but if absent, route handler must defend); §5.3 (security-sensitive routes fail closed) |
| Regression test coverage | Future — middleware-integration test wire-up. Out of W2-PR1A scope; tracked as follow-up. |

### 3. Malformed `org_id` claim (`vitalcv` is non-object)

| Field | Value |
|---|---|
| Trigger condition | `sessionClaims.vitalcv` is `null`, an array, a primitive, a function, or a Symbol |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **FAIL_CLOSED** — `extractVerifierClaims` collapses to `{requestingOrgId: null, teamRole: null}` → `checkVerifierPermission` Gate 1 fires → `403 no_org_context` |
| Allowed fallback | None — there is no fallback. Malformed claim never grants permission. |
| Forbidden fallback | Type-asserting (`as Record<string, unknown>`) without runtime validation. Reading positional indices on an array as if it were a record. |
| Security invariant protected | §1.3 (orgId never trusted from client); §5.4 (unknown auth states fail closed) |
| Regression test coverage | `extractVerifierClaims` — 6 cases on malformed sessionClaims/vitalcv shapes; integration test `vitalcv claim is an array (attacker forging a payload shape) → no_org_context` |

### 4. Non-string `org_id` claim (`vitalcv.org_id` is number / null / object / array)

| Field | Value |
|---|---|
| Trigger condition | `vitalcv.org_id` exists but is not a non-empty string |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **FAIL_CLOSED** — `requestingOrgId` set to `null` → Gate 1 fires → `403 no_org_context` |
| Allowed fallback | None. |
| Forbidden fallback | `String(claims.org_id)` coercion. Trusting `claims.org_id?.toString()`. Defaulting to `''`. |
| Forbidden fallback (subtle) | Returning **404 cross_org** instead of **403 no_org_context** — both are restrictive but the 403 surfaces the misconfiguration cleanly to ops; the 404 obscures it as if the resource were missing. |
| Security invariant protected | §1.3, §5.4 |
| Regression test coverage | `returns null org_id when org_id is non-string`; integration `non-string org_id with valid team_role → no_org_context (403, NOT cross_org)` |

### 5. Missing verifier role (`vitalcv.team_role` undefined)

| Field | Value |
|---|---|
| Trigger condition | `vitalcv.team_role` is absent (undefined / null / missing key) |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **FAIL_CLOSED** — `parseTeamRole` returns `null` → `extractVerifierClaims` returns null teamRole → Gate 1 fires → `403 no_org_context` |
| Allowed fallback | None. There is no default verifier role. |
| Forbidden fallback | Defaulting to `'readonly'`. Defaulting to `'member'`. Inferring role from anything other than the JWT claim. |
| Security invariant protected | §3.3 (role inheritance must be explicit — no implicit default); §5.4 |
| Regression test coverage | `partial JWT payload (org_id present, team_role missing) → null team_role only`; existing W2-PR1 `returns 403 no_org_context when teamRole is null` |

### 6. Unknown role value (`vitalcv.team_role` is a string not in `VERIFIER_TEAM_ROLES`)

| Field | Value |
|---|---|
| Trigger condition | `team_role: 'superadmin'`, `'guest'`, `'system'`, or any string not in `['owner', 'admin', 'member', 'readonly']` |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **FAIL_CLOSED** — `parseTeamRole` returns `null` → Gate 1 fires → `403 no_org_context` |
| Allowed fallback | None. |
| Forbidden fallback | Treating unknown role as `'admin'`, `'owner'`, `'member'`, or `'readonly'`. |
| Forbidden fallback (subtle) | Throwing an exception that's caught upstream and degrades to `next()`. The `parseTeamRole` function MUST be total — it returns null, never throws. |
| Security invariant protected | §3.3, §5.4 |
| Regression test coverage | W2-PR1 `parseTeamRole returns null for unknown values`; W2-PR1A `returns null team_role when team_role is unknown` |

### 7. Route classification drift (route added without explicit class)

| Field | Value |
|---|---|
| Trigger condition | A new route is added to `apps/web/app/api/` that:<br>(a) is not in `PUBLIC_ROUTE_PATTERNS`,<br>(b) does not match a `PROTECTED_ROUTES` pattern,<br>(c) does not run an explicit auth check in its handler |
| Affected routes | The new route, plus any other `/api/*` routes that fall through public-pattern delegation without handler-level auth |
| Expected behavior | **NEVER_PUBLIC for ownership-sensitive resources.** The wildcard `/^\/api(\/.*)?$/` in `PUBLIC_ROUTE_PATTERNS` is a delegation contract — it requires the route handler to enforce its own auth. If the handler does not, the route is silently public. |
| Allowed fallback | The handler may explicitly declare itself public (e.g., `/api/health`) when no resource-keyed data is returned. |
| Forbidden fallback | Adding a route handler that returns resource data without an `auth()` check. Adding a route to `PROTECTED_ROUTES` without also adding a test that exercises the role gate. |
| Security invariant protected | §5.1 (public routes explicitly enumerated); §5.2 (no wildcard `/api/**` public exposure for ownership-sensitive routes); §5.5 (route-level authorization mandatory for ownership-sensitive resources) |
| Regression test coverage | Future — `apps/web/__tests__/route-classification.test.ts` per `w2-pr1-route-classification.md`. **Currently uncovered**; flagged as W2-PR3 dependency. |

### 8. Middleware ordering drift (a fail-closed gate is moved after a fail-open path)

| Field | Value |
|---|---|
| Trigger condition | `checkVerifierFailClosed(...)` is moved AFTER `isPublicRoute(...)` or AFTER `!CLERK_MIDDLEWARE_ENABLED` returns `next()`. OR Step 0 inside `clerkHandler` is moved AFTER `isPublicRoute`. |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **NEVER_PUBLIC** — the fail-closed gate must execute BEFORE any path that can return `NextResponse.next()` for a verifier path. |
| Allowed fallback | None. The ordering is load-bearing. |
| Forbidden fallback | Reordering for "performance," "consistency," or "DRY." Adding new middleware steps before the fail-closed gate without verifying they cannot match a verifier path. |
| Security invariant protected | §6.3 (security helper ordering is load-bearing); §5.3 |
| Regression test coverage | Helper-level tests on `checkVerifierFailClosed` lock the helper's behavior. **Middleware-flow integration test** is the better lock; tracked as follow-up. Comment block in `middleware.ts` explicitly names the ordering requirement so a code review catches reordering. |

### 9. Missing auth helper output (helper returns `undefined` or throws)

| Field | Value |
|---|---|
| Trigger condition | `checkVerifierPermission`, `checkVerifierFailClosed`, `extractVerifierClaims`, or `parseTeamRole` returns `undefined` or throws. (Should be impossible by design — all are total and return discriminated unions or null.) |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **FAIL_CLOSED at the framework boundary** — an unhandled throw propagates to Next.js, which returns 500. A `undefined` return where a discriminated union is expected fails the `if (!decision.permitted)` check by truthiness — which would erroneously fall through. |
| Allowed fallback | None. The helpers' totality is a contract; tests lock it. |
| Forbidden fallback | Adding `??` defaults that mask the undefined ("decision ?? { permitted: false }"). Adding `try/catch` that downgrades to `next()`. |
| Security invariant protected | §6.4 (auth helper primitives must remain deterministic); §5.4 |
| Regression test coverage | All helpers have totality tests (`does not throw on any input — function is total`); discriminated-union tests (`if (!d.permitted) ...`) lock the shape. |

### 10. Public-route wildcard regression (`/api/*` matcher widens)

| Field | Value |
|---|---|
| Trigger condition | A PR adds a new pattern to `PUBLIC_ROUTE_PATTERNS` that matches `/api/verifier/...`. E.g., `/^\/api\/verifier\/public/` or accidentally broadens `/^\/api\/v(.*)?$/` to include verifier. |
| Affected routes | `/api/verifier/**` |
| Expected behavior | **NEVER_PUBLIC** — `checkVerifierFailClosed` and the Step-0 verifier intercept fire BEFORE `isPublicRoute` is consulted. New public patterns cannot widen verifier exposure as long as the pre-checks remain ordered correctly. |
| Allowed fallback | None — verifier routes are never public, by definition. |
| Forbidden fallback | Adding any `PUBLIC_ROUTE_PATTERNS` entry that overlaps the verifier namespace. |
| Security invariant protected | §5.1 (public routes explicitly enumerated); §5.2 |
| Regression test coverage | `checkVerifierFailClosed — does NOT fire for a route that LOOKS like verifier but has a different prefix` locks the predicate boundary. Adding a `PUBLIC_ROUTE_PATTERNS` entry is itself a security-sensitive change requiring founder review per §5.1. |

### 11. Session parsing failure (`auth()` throws)

| Field | Value |
|---|---|
| Trigger condition | `auth()` from Clerk throws (Clerk SDK panic, network blip, malformed inbound JWT) |
| Affected routes | All routes inside `clerkHandler` |
| Expected behavior | **FAIL_CLOSED at the framework boundary.** For verifier routes (Step 0): `await auth()` is the first call; if it throws, the unhandled exception propagates to Next.js → 500. For non-verifier routes (Step 3+): same propagation. For intelligence/investigation routes: the outer `try { ... } catch { return NextResponse.next(); }` catches and degrades — **this is a documented graceful-degrade and is acceptable** because the intelligence-API handlers run their own auth resolution. |
| Allowed fallback | Intelligence/investigation graceful-degrade (existing pattern, not modified). |
| Forbidden fallback | Wrapping the verifier Step-0 in a try/catch that degrades to `next()`. |
| Security invariant protected | §5.3 (security-sensitive routes fail closed); §6.4 |
| Regression test coverage | Helper totality tests; framework behavior is Next.js's responsibility. Future middleware integration test would lock this. |

### 12. Undefined auth state (`session.userId` is `undefined`)

| Field | Value |
|---|---|
| Trigger condition | Clerk session is invalid, expired, missing, or anonymous |
| Affected routes | All `/api/verifier/**` (Step 0 handles); all protected routes (Step 3 handles) |
| Expected behavior | **FAIL_CLOSED.** For `/api/verifier/**`: return `403` (not 401, because `/api/*` is in `PUBLIC_ROUTE_PATTERNS` so the standard sign-in redirect path is inappropriate). For protected non-API routes: redirect to `/sign-in`. |
| Allowed fallback | Sign-in redirect for browser-routed protected paths. |
| Forbidden fallback | `NextResponse.next()`. Returning a partially-redacted resource (e.g., "anonymous can see public fields"). |
| Security invariant protected | §5.4 (unknown auth states fail closed); §1.1 (authentication does not imply authorization) |
| Regression test coverage | W2-PR1 middleware structure; helper-level tests lock the gate semantics. |

### 13. Partial JWT payload (some `vitalcv` keys missing)

| Field | Value |
|---|---|
| Trigger condition | JWT carries `vitalcv: { org_id: 'org_a' }` but no `team_role`, OR `vitalcv: { team_role: 'admin' }` but no `org_id` |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | **FAIL_CLOSED** — `extractVerifierClaims` extracts what's present; missing keys collapse to `null`. Gate 1 fires → `403 no_org_context`. |
| Allowed fallback | None. |
| Forbidden fallback | Defaulting missing fields to a "sensible" value. |
| Security invariant protected | §1.2 (identity coherence does not imply ownership); §5.4 |
| Regression test coverage | `partial JWT payload (org_id present, team_role missing) → null team_role only`; `partial JWT payload (team_role present, org_id missing) → null org_id only` |

### 14. Expired verifier claims (JWT signature valid but issued before role demote)

| Field | Value |
|---|---|
| Trigger condition | User was demoted from `member` to `readonly` (or removed from org), but their JWT was issued before the change and is still within Clerk's session-token TTL |
| Affected routes | All `/api/verifier/**` |
| Expected behavior | The middleware enforces the gate AS CLAIMED IN THE JWT. The pre-demotion permissions are honored until the JWT refreshes. **This is bounded fail-closed:** the user has an old set of permissions, not a new set, until session refresh. |
| Allowed fallback | None within this PR's scope. |
| Forbidden fallback | Inferring "user might have been demoted" without a session refresh — speculative permission narrowing is not the right pattern. |
| Required follow-up | A future wave should add a Clerk session-revoke flow tied to org-role changes (force JWT refresh on demote). Tracked as follow-up. |
| Security invariant protected | §6.3 (auth state is what the JWT says); §5.4 (uncertain state is "fresh JWT TTL has expired" → re-auth required) |
| Regression test coverage | Out of scope for W2-PR1A. Bounded by Clerk session TTL. |

### 15. Unknown route class (route exists but is not classified by middleware)

| Field | Value |
|---|---|
| Trigger condition | A route exists at `/api/foo/bar` that does not match `PUBLIC_ROUTE_PATTERNS`, `PROTECTED_ROUTES`, `INTELLIGENCE_API`, or `VERIFIER_API` (via `isVerifierApiRoute`) |
| Affected routes | The new unclassified route |
| Expected behavior | The middleware passes through (line 50 of middleware.ts: `if (!requiredRole) return NextResponse.next()`). **The route handler is solely responsible for its own auth.** |
| Allowed fallback | The route handler may emit 200 if it explicitly does no resource-keyed read. |
| Forbidden fallback | Returning resource data without an `auth()` call in the handler. |
| Security invariant protected | §5.1 (public routes must be explicitly enumerated — but the route is not declared public; the public-pattern delegation requires handler-level enforcement); §5.5 (route-level authorization mandatory for ownership-sensitive resources) |
| Regression test coverage | Future — `apps/web/__tests__/route-classification.test.ts`. Currently the architecture doctrine relies on code review at PR-merge time to catch unclassified routes. |

---

## Definitions in detail

### FAIL_CLOSED

A request that cannot be authoritatively decided MUST receive the most-restrictive honest response:

- **No auth service** → `503 Service Unavailable` with header `x-rbac-fail-closed: clerk_unavailable`. Empty body.
- **Auth service available, no session** → `403 Forbidden`. Empty body.
- **Auth service available, session present, no org context** → `403 no_org_context`. Empty body.
- **Auth service available, session present, cross-tenant request** → `404 Not Found`. Empty body.
- **Auth service available, session present, role lacks privilege** → `403 readonly_blocks_mutation`. Empty body.

### NEVER_PUBLIC

The named route or path SHALL NOT, under any combination of:
- Missing env-var configuration
- Missing Clerk service
- Malformed JWT claim
- `PUBLIC_ROUTE_PATTERNS` regression
- Routing-order drift
- Helper-function bugs

… emit a 2xx response that exposes resource data to an anonymous or cross-tenant caller.

The `NEVER_PUBLIC` properties of `/api/verifier/**` are guaranteed by the COMPOSITION of:
1. `checkVerifierFailClosed` pre-check (kills the route on Clerk-disabled).
2. `isVerifierApiRoute` Step-0 intercept (kills the route on cross-org / readonly mutation / no-org-context).
3. The route handler's own auth checks (defense-in-depth — required at W2-PR4).

Removing any one of these layers without replacing it with an equivalent enforcement point is a security regression.

### SAFE_RESPONSE

A response that:
- Returns no resource data.
- Returns minimum information sufficient for the caller to debug the failure.
- Does not leak the route's existence to an actor who is not entitled to know.
- Does not leak the tenant's identity, role membership, or resource state.

Examples:
- `503` with header `x-rbac-fail-closed: clerk_unavailable` is SAFE — it tells operators the auth service is missing without telling the caller anything about the route.
- `404` with empty body is SAFE — cross-tenant. Indistinguishable from "route does not exist."
- `403` with empty body is SAFE — known caller, known role, known forbidden method.
- `500` with stack trace is **NOT SAFE** — leaks code paths, file paths, library versions.
- `403` with body `{ "error": "user X cannot access resource Y in org Z" }` is **NOT SAFE** — leaks the existence of resource Y.

### enumeration-resistant response

A response that cannot be used by an attacker to distinguish:
- "resource exists, you can't see it" from "resource does not exist"
- "your org is wrong" from "your role is wrong" from "the resource is gone"

For VitalCV:
- Cross-tenant access → **404** (always; not 403)
- Forbidden method by readonly → **403 readonly_blocks_mutation** (caller already has org context; revealing the role is acceptable)
- Missing org context → **403 no_org_context** (caller is authenticated; revealing the missing claim is acceptable)
- Auth service unavailable → **503 clerk_unavailable** (caller's identity cannot be established at all)

The `404` for cross-tenant is the strongest enumeration resistance. Any code path that conditionally returns 403 vs 404 based on tenant existence is a regression.

---

## Authorization degradation must reduce capability, never increase exposure.
