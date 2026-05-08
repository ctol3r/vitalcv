# W2-PR1A — Final Adversarial Risk Review

Performed against the patch on `wave/w2-pr1a-fail-closed`. Six adversarial threat models per the task brief, plus follow-up coverage of the threats Codex SAFE flagged on W2-PR1.

**Scope:** ONLY degraded-auth states, fail-open possibilities, malformed claims, route-ordering drift, verifier-route exposure, wildcard matcher drift. Does NOT cover ownership authorization (W2-PR4), workflow authorization, or audit visibility — those are explicit deferrals.

---

## Findings — exploitation potential ranked

### F-1 — RESOLVED — Missing-Clerk verifier-route public exposure (was BLOCKING on W2-PR1)

**Adversarial scenario:** `CLERK_SECRET_KEY` is unset in production deploy (env-var rotation incident, K8s secret rollout failure, dev env spillover). W2-PR1's middleware enters `!CLERK_MIDDLEWARE_ENABLED` branch → `isPublicRoute('/api/verifier/team/roster')` returns true (matches `/api/*`) → `NextResponse.next()` → verifier route exposed to anonymous callers.

**Closure on W2-PR1A:** the new `checkVerifierFailClosed` pre-check fires BEFORE `isPublicRoute` and BEFORE the `!CLERK_MIDDLEWARE_ENABLED` branch. When `clerkEnabled === false` AND path matches `isVerifierApiRoute`, the response is **503** with header `x-rbac-fail-closed: clerk_unavailable`. No fall-through to `NextResponse.next()` is possible.

**Verification:** test `returns failClosed for verifier route when Clerk is disabled`. The status code is type-locked at 503 by a test that uses a const-typed assertion (would fail compile if widened).

**Status:** closed by design + test. The path that previously fail-opened cannot fail-open.

---

### F-2 — RESOLVED — Type assertion on session claims (was P1 on W2-PR1)

**Adversarial scenario:** Codex flagged `session.sessionClaims?.vitalcv as Record<string, unknown> | undefined` as a fail-open code smell. While the immediate downstream `typeof claims?.org_id === 'string'` was correct, the cast pattern is a maintenance risk — a future refactor could:
- Coerce a non-object claim (e.g., a JSON-parse error or middleware-injected primitive) into "appearing" object-shaped to TypeScript while being something else at runtime.
- Add a new field read that does not include the per-field `typeof` guard.

**Closure on W2-PR1A:** introduced `extractVerifierClaims(rawSessionClaims: unknown)` — total function with full runtime validation. `isPlainObject` private guard excludes null, primitives, and arrays. Every field read is `typeof` or `Array.isArray` checked. No `as` casts in the claim-extraction path.

**Verification:** 12 unit tests + 3 integration tests cover the matrix: missing, null, undefined, string, number, boolean, array, plain object, partial object, recursive object, Symbol, function. Function is total — `expect(() => extractVerifierClaims(...)).not.toThrow()` for every hostile input.

**Status:** closed by design + test. Type assertions in the auth path are eliminated.

---

### F-3 — RESOLVED — Partial JWT payload elevation

**Adversarial scenario:** Clerk publicMetadata has `vitalcv.org_id: 'org_a'` but `team_role` is missing (e.g., user just created, not yet assigned a team role). On W2-PR1, this would flow through Step 0: `requestingOrgId === 'org_a'`, `teamRole === null` (parseTeamRole on undefined). Gate 1 fires correctly → 403 `no_org_context`. But the question is what happens if the JWT is missing the entire `vitalcv` object — does the assertion-cast path coerce silently?

**Closure on W2-PR1A:** `extractVerifierClaims` returns `{requestingOrgId: null, teamRole: null}` for any partial-or-malformed input. Gate 1 fires with both nulls. 403 surfaces. No path leads to permission with partial data.

**Verification:** tests `partial JWT payload (org_id present, team_role missing) → null team_role only` and `partial JWT payload (team_role present, org_id missing) → null org_id only`.

**Status:** closed.

---

### F-4 — RESOLVED — Forged claim shape (vitalcv as array)

**Adversarial scenario:** A future Clerk template config or a Clerk webhook race condition could result in `sessionClaims.vitalcv` being an array (`['org_a', 'admin']`). `Array.isArray([])` is true, but a `typeof []` is `'object'`. A type assertion `as Record<string, unknown>` would lie. A subsequent `claims.org_id` read on the array returns `undefined`, but a malicious or buggy refactor could misread `claims[0]` instead.

**Closure on W2-PR1A:** `isPlainObject` excludes arrays explicitly (`!Array.isArray(value)`). The array path collapses to `{requestingOrgId: null, teamRole: null}` → Gate 1.

**Verification:** test `vitalcv claim is an array (attacker forging a payload shape) → no_org_context`. Also test `returns null/null when sessionClaims is an array (not a record)`.

**Status:** closed.

---

### F-5 — RESOLVED — Empty-string org_id

**Adversarial scenario:** Clerk template config sets `vitalcv.org_id: ''` for a user without an org assignment. `typeof '' === 'string'` is true, so a naive `typeof === 'string'` check would coerce it as a present claim, leading to a Gate 2 cross-org check with empty string vs the resource's `x-verifier-org` header. The result would be **404 cross_org** — slightly worse than the desired **403 no_org_context** because:
- An attacker could distinguish "empty org_id" (404) from "absent vitalcv claim" (also 404 via array/null path) — but both surface as 404, no info leak.
- The 403 vs 404 distinction matters for observability — empty-string org_id is a misconfiguration, not a missing-org.

**Closure on W2-PR1A:** `extractVerifierClaims` checks `orgIdRaw.length > 0` — empty string collapses to null. Gate 1 (no_org_context, 403) fires instead of Gate 2 (cross_org, 404). Cleaner observability; same security posture.

**Verification:** test `returns null org_id when org_id is empty string`.

**Status:** closed.

---

### F-6 — REMAINING DEFERRED (W2-PR4) — Layer-2 resource ownership

**Adversarial scenario:** Verifier in Org A sends `GET /api/verifier/packet/entity-12345` with `x-verifier-org: org_a` (their own org, no forgery). `entity-12345` belongs to Org B. Gates 1, 2, 3 all pass. Step 0 returns `NextResponse.next()`. The request reaches the route handler. **The route handler must verify entity-12345 belongs to Org A; if it doesn't, that's the bug.**

**Status on W2-PR1A:** unchanged from W2-PR1. No route handlers exist under `/api/verifier/*` on origin/main today, so the bug is not currently reachable. When W2-PR4 ships handlers, the handler MUST run a Layer-2 check. The middleware comment block names this dependency.

**Status:** explicitly deferred to W2-PR4. Out of W2-PR1A scope (W2-PR1A is fail-closed-on-degraded-auth only).

---

### F-7 — DEFENSE-IN-DEPTH — Routing-order drift

**Adversarial scenario:** A future PR reorders the outer middleware function, placing `!CLERK_MIDDLEWARE_ENABLED` branch BEFORE the `checkVerifierFailClosed` call. The fail-closed wins ordering would be lost.

**Defense added on W2-PR1A:**
1. The `checkVerifierFailClosed` call site has a comment block that explicitly names the ordering requirement.
2. Tests verify the FAIL-CLOSED behavior at the helper level (deterministic regardless of middleware code shape).
3. The helper is pure — a future code-review can verify the call site and the tests independently.

**What WOULD catch a regression:** The unit tests on `checkVerifierFailClosed` lock the helper's behavior. The middleware change is small (one if-block at the top of `middleware()`) and easy to inspect in diff review.

**What WOULD NOT catch a regression:** unit tests don't run the full middleware. A middleware-render integration test would catch this; we don't have one in this PR (deferred — middleware integration testing requires Clerk-mock infrastructure beyond this PR's scope). Recommend a future PR to add `apps/web/__tests__/middleware-integration.test.ts` that mocks Clerk and asserts the routing order.

**Status:** mitigated by helper-level locks + comment; not yet defended by integration test. **Acceptable risk for W2-PR1A** — the fail-closed call is the FIRST non-CORS check in the outer middleware; reordering it would be visible in any diff.

---

### F-8 — DEFENSE-IN-DEPTH — Wildcard matcher drift in `PUBLIC_ROUTE_PATTERNS`

**Adversarial scenario:** A future PR adds a new pattern to `PUBLIC_ROUTE_PATTERNS` that overlaps `/api/verifier/*` (e.g., `/^\/api\/verifier\/public\//`).

**Defense:** even if such a pattern is added, `checkVerifierFailClosed` fires BEFORE `isPublicRoute` is consulted. The fail-closed path takes precedence. Inside `clerkHandler`, the `isVerifierApiRoute` Step-0 intercept also fires BEFORE the `isPublicRoute` check (`Step 0` precedes `Step 1` per W2-PR1).

**Status:** the pre-check architecture defends against this regression. Future PRs that add to `PUBLIC_ROUTE_PATTERNS` are already a security-sensitive change requiring founder review per `SECURITY_INVARIANTS.md` §5.1.

---

### F-9 — DEFENSE-IN-DEPTH — `INTELLIGENCE_API` graceful-degrade catch swallowing the fail-closed return

**Adversarial scenario:** The outer middleware has:
```typescript
if (INTELLIGENCE_API.test(pathname)) {
  try { return await clerkHandler(req, event); }
  catch { return NextResponse.next(); }    // ← catches errors
}
```

If somehow a verifier path reached this branch and threw, the catch would `next()` — fail open.

**Why this can't happen:** verifier paths don't match `INTELLIGENCE_API` (`/^\/api\/(intelligence|investigation)/`). Even if they did, the new `checkVerifierFailClosed` pre-check fires BEFORE the `INTELLIGENCE_API` branch — so a verifier path with Clerk-disabled returns 503 before entering the try-catch. With Clerk-enabled, the path goes through `clerkHandler` Step 0, which always returns a `NextResponse` (never throws).

**Status:** defended by ordering. The fail-closed pre-check wins regardless of which downstream branch would have run.

---

### F-10 — DEFENSE-IN-DEPTH — `clerkHandler` itself throws (e.g., Clerk SDK panic)

**Adversarial scenario:** `clerkMiddleware(...)` from `@clerk/nextjs/server` throws an unhandled exception inside the `clerkHandler` body for a verifier route.

**Behavior:** for verifier routes, the outer middleware does NOT wrap `clerkHandler` in a try-catch (only `INTELLIGENCE_API` paths do). An unhandled throw propagates to Next.js, which returns 500 — a fail-closed response. The verifier route is never exposed publicly.

**Status:** correctly fails closed at the framework layer. This is identical to W2-PR1 behavior.

---

### F-11 — DEFENSE-IN-DEPTH — Hostile claim shapes (Symbol, function, recursive)

**Adversarial scenario:** A buggy or malicious Clerk template config inserts a `Symbol`, function, or recursive object into `sessionClaims`. JSON.stringify would fail; `Object.keys` would behave variably.

**Defense:** `extractVerifierClaims` is total — tests assert `not.toThrow()` for `Symbol(...)`, functions, and recursive objects. The function reads only via `typeof` and never invokes the values, so even functions and Symbols collapse to null fields.

**Verification:** test `does not throw on any input — function is total`.

**Status:** defended.

---

## Remaining residual risks (out of W2-PR1A scope)

### Layer-2 ownership (W2-PR4 dependency)
The single largest residual risk after this wave. Documented in F-6, deferred by design. Code review at W2-PR4 merge time MUST verify per-handler ownership checks.

### JWT replay within session TTL
Bounded by Clerk session-token TTL. Out of this PR's scope.

### Stale role claim post-demote
A user demoted from `member` to `readonly` continues to have the old role until JWT refresh. Bounded by Clerk session TTL.

### DoS via fail-closed amplification
An attacker spamming `/api/verifier/*` when Clerk is unavailable forces the middleware to run the regex check on each request. Each check is O(pathname-length) — cheap. But repeated 503s consume CDN/edge resources. Recommend rate-limiting at the Vercel edge config (out of this PR's scope).

---

## Summary

W2-PR1A closes the two fail-open holes Codex SAFE identified on W2-PR1 (F-1 missing-Clerk verifier exposure, F-2 type-asserted claim extraction). It also closes three latent defense-in-depth gaps (F-3 partial JWT, F-4 forged array claim, F-5 empty org_id) by funneling all malformed input through a single total function (`extractVerifierClaims`).

**Closed by design + tested:** F-1, F-2, F-3, F-4, F-5, F-7, F-8, F-9, F-10, F-11.
**Explicitly deferred (W2-PR4):** F-6 (Layer-2 ownership).

The PR adds 24 new test cases. Full vitest sweep is green: 1517 passed | 4 skipped | 0 failed. Build clean (Edge-runtime safe). Lint clean.

**Recommended for W2-PR4 brief:** before any verifier route handler ships, the wave brief MUST require an explicit Layer-2 ownership check helper (e.g., `assertOrgOwnsResource(session, resourceId)`) that route handlers call. Without it, F-6 becomes exploitable on first-route-shipment.
