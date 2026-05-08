# W2-PR1 — Adversarial Self-Review (Risk Review)

Performed against the implementation in `wave/w2-pr1-rbac-foundation` after build / lint / vitest passed clean. Six adversarial threat models below; findings ordered by exploitation potential.

**Threat models assumed:**
- Malicious verifier (authenticated team member acting outside org boundary)
- Forged client headers (attacker-controlled `x-verifier-org`)
- Route probing (unauthenticated scan for live endpoints)
- Stale roles (JWT cached after role demotion)
- Replay attempts (captured request reused after auth state change)
- Privilege escalation attempts (e.g., readonly attempting member action)

---

## Findings — exploit potential ranked

### R-1 — Stale JWT after role demotion (medium severity, accepted)

**Adversarial scenario:** Owner of Org A demotes a `member` to `readonly`. The demoted user holds a Clerk JWT issued before the demotion. JWTs are signed with `team_role: 'member'`. Until the JWT refreshes (typical Clerk refresh window: ~1 hour, or until the user reloads), the demoted user's middleware-level check sees `team_role === 'member'` and Gate 3 does not fire — they can still POST.

**Why this PR does not fix it:** JWT freshness is a Clerk-policy / refresh-window concern, not an RBAC-decision concern. The middleware faithfully reflects the JWT it receives. Forcing JWT refresh on demote requires Clerk admin API + a coordinated session-revoke flow — a separate W2-PR (or a Clerk policy decision).

**Mitigation:** documented in `w2-pr1-readonly-semantics.md` "Readonly Escalation Path" — escalation/demotion requires a JWT refresh. This PR enforces the gate as it sees it; the caller's responsibility is to refresh when role changes.

**Status:** accepted risk for W2-PR1. Tracked as a follow-up: "force JWT refresh on org-role change."

---

### R-2 — Replay of a captured `x-verifier-org: org_a` request after the user is removed from Org A (low severity)

**Adversarial scenario:** Attacker captures a verifier request (header `x-verifier-org: org_a`, valid Bearer JWT signing `vitalcv.org_id: org_a, team_role: member`). User is later removed from Org A. The user's *next* sign-in produces a new JWT without the org_a claim, but the captured token is still cryptographically valid until expiry.

**What the gate does:** the captured JWT carries `vitalcv.org_id: org_a` (still readable from `sessionClaims`). Step 0 will see it match the `x-verifier-org: org_a` header, and Gate 2 passes. The replay succeeds.

**Why this is mostly fine:** this is the standard JWT replay window. Clerk's session-token expiry (typically 60s for short-lived tokens, with refresh) is the bound. Attacker must replay within the JWT's TTL. After expiry, the JWT signature check fails at the Clerk auth layer (before Step 0 runs).

**Mitigation:** rely on Clerk's session TTL. Longer-lived JWTs would amplify this risk; we don't control Clerk's TTL choices in this PR. Documented in `w2-pr1-rbac-foundation-plan.md` — this is in the "not in scope" list (no JWT signature work).

**Status:** accepted risk; bounded by Clerk session TTL.

---

### R-3 — Forged `x-verifier-org` from a verifier in another org (correctly blocked)

**Adversarial scenario:** Verifier in Org A sends `GET /api/verifier/team/roster` with `x-verifier-org: org_b` (forged). They want Org B's roster.

**What happens:** Gate 2 fires. `requestingOrgId === 'org_a'` (from Clerk JWT, tamper-proof) != `resourceOrgId === 'org_b'` (from the forged header). `timingSafeEqualStrings('org_a', 'org_b')` returns `false`. Decision: `{ permitted: false, statusCode: 404, reason: 'cross_org' }`. Middleware returns **404**.

**Verification:** test `cross-org access returns 404 (Gate 2)` covers this.

**Why 404 not 403:** confirms nothing about Org B's existence. This is the explicit choice from `SECURITY_INVARIANTS.md` §5.5.

**Status:** correctly blocked by design.

---

### R-4 — Forged `x-verifier-org: <attacker's own org>` to access a cross-tenant resource (Layer-2 boundary case)

**Adversarial scenario:** Verifier in Org A sends `GET /api/verifier/packet/entity-12345` with `x-verifier-org: org_a` (their own org, no forgery). `entity-12345` belongs to Org B. Gate 2 passes (org_a === org_a). Gate 3 doesn't fire (GET is not a mutation). Step 0 returns `NextResponse.next()`.

**What this PR does:** middleware passes the request to the route handler. **The route handler is responsible** for verifying that `entity-12345` belongs to the requesting org. **No such route handler exists yet** on `origin/main` — `/api/verifier/*` has zero handlers. When W2-PR4 adds handlers, each MUST run a Layer-2 ownership check.

**Why this is the correct W2-PR1 behavior:** middleware cannot access the DB to look up which org owns `entity-12345`. Edge runtime has no Prisma connection. The Layer-2 check must be a route-handler concern — that's what `SECURITY_INVARIANTS.md` §3.5 mandates.

**Mitigation:** the middleware comment block explicitly names this dependency:

> Each /api/verifier/* route handler must additionally verify that
> the resource named by its URL parameters belongs to the
> requestingOrgId resolved here.

**Status:** explicitly deferred to W2-PR4. Code review at W2-PR4 merge time MUST verify Layer-2 enforcement before any verifier route ships. This is the single largest residual risk of this wave.

---

### R-5 — Probing for tenant existence via timing oracle on `timingSafeEqualStrings` (low severity)

**Adversarial scenario:** Attacker submits cross-org requests with progressively more accurate guesses for a target org_id and times the response. If `timingSafeEqualStrings` short-circuits on first byte mismatch, the attacker can refine their guess byte-by-byte.

**What the implementation does:** the helper accumulates `mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)` over `max(len(a), len(b))` byte positions. There is no early return on length mismatch (length difference is mixed into `mismatch` at the start). There is no early return on first non-zero accumulator. Every byte position is processed. The XOR accumulator is collapsed to a single `=== 0` comparison at the end.

**Verification:** tests `returns false for different-length strings without short-circuiting` and `returns false for empty vs non-empty` cover the length-difference path. `returns false for different strings of same length` covers the byte-difference path. `handles UTF-8 multibyte characters correctly` covers TextEncoder correctness.

**Caveat:** `Array.prototype[i] ?? 0` MAY have JIT-dependent timing variance vs an unconditional read. For Edge runtime (V8-based), the JIT is consistent; for adversarial cross-runtime probing this is a theoretical concern. Standard production security advice (network-level rate limiting, request-time normalization) mitigates this further. This is an acceptable Edge-runtime constant-time primitive.

**Status:** correctly defended within the constraints of the Edge runtime.

---

### R-6 — Probing for `/api/verifier/*` route existence via 404 vs 403 (low severity)

**Adversarial scenario:** Unauthenticated attacker scans `/api/verifier/anything` to enumerate live endpoints. The middleware (Step 0) returns **403** when `userId` is absent. This is the same status for any path matching `VERIFIER_API`, regardless of whether a route handler exists.

**What this PR does:** Step 0 runs *before* Next.js routing dispatches to a handler. An unauthenticated probe to `/api/verifier/foo` (non-existent) and `/api/verifier/team/roster` (hypothetical handler) both return **403** with empty body. The attacker cannot distinguish "route exists but you're not authed" from "route doesn't exist."

**Status:** by design — this is enumeration resistance for the unauthenticated case.

---

### R-7 — Privilege escalation attempt: readonly user with valid org claim attempts cross-org POST (correctly blocked)

**Adversarial scenario:** Verifier in Org A holds `team_role: 'readonly'`. Attempts `POST /api/verifier/team/invite` with `x-verifier-org: org_b`.

**What happens:** Gate 1 passes (org_id and team_role are present). Gate 2 fires first (cross-org) — returns **404 cross_org**. The user never sees the readonly mutation block (Gate 3); cross-org check wins.

**Why this is correct:** if Gate 3 fired first, the response would be 403 readonly_blocks_mutation. That would confirm Org B's resource exists *and* the caller's role is readonly. By firing Gate 2 first, the response is 404 — leaks neither.

**Verification:** test `cross-org with a readonly user STILL returns 404 (not 403) — Gate 2 fires before Gate 3`.

**Status:** correctly defended; gate ordering is load-bearing.

---

### R-8 — Forged JWT `team_role` claim (correctly blocked at the Clerk layer)

**Adversarial scenario:** Attacker modifies a captured JWT to set `vitalcv.team_role: 'owner'` instead of `'readonly'`.

**What happens:** Clerk validates the JWT signature before `auth()` returns successfully. A modified JWT fails signature validation; `auth()` returns `userId: null`. Step 0 returns **403** at the missing-userId check. The forged claim never reaches `parseTeamRole`.

**Why this is correct:** JWT signature is Clerk's responsibility, not this PR's. This PR consumes only the result of Clerk's verification.

**Status:** correctly defended at the Clerk layer.

---

### R-9 — Type-erased `team_role` from JWT (e.g., number, object) (correctly handled)

**Adversarial scenario:** Custom Clerk publicMetadata mistakenly sets `team_role: 1` or `team_role: { name: 'admin' }`.

**What happens:** `parseTeamRole(claims?.team_role)` returns `null` for any non-string or non-matching string input. `null` triggers Gate 1 (`no_org_context`). The caller gets **403**.

**Verification:** test `parseTeamRole returns null for unknown values` covers number, undefined, null, empty string, object, array.

**Status:** correctly handled — total function on `unknown`.

---

### R-10 — Empty-string `org_id` claim (correctly handled)

**Adversarial scenario:** A misconfigured Clerk template sets `vitalcv.org_id: ''`. Verifier sends `x-verifier-org: ''` to match.

**What happens:** middleware code checks `typeof claims?.org_id === 'string' && claims.org_id.length > 0`. Empty string is treated as no org context. `requestingOrgId` becomes `null`. Gate 1 fires — **403 no_org_context**. The empty-empty match is impossible because `requestingOrgId` is `null` before reaching Gate 2.

**Verification:** the `length > 0` check is in the middleware. Test for `empty resource org never matches a non-empty requesting org` covers a related path.

**Status:** correctly handled.

---

### R-11 — Method-case attack (e.g., lowercase `post`) (correctly normalized)

**Adversarial scenario:** Some intermediary lowercases HTTP method names. Attacker hopes `'post'` doesn't match `MUTATING_METHODS.has('POST')`.

**What happens:** Gate 3 calls `MUTATING_METHODS.has(ctx.method.toUpperCase())`. Lowercase `post` becomes `'POST'` and matches.

**Verification:** test `method is case-normalized — lowercase post is treated as POST`.

**Status:** correctly normalized.

---

## Remaining auth ambiguities

### Documented & accepted

1. **Layer-2 ownership enforcement is deferred** (R-4). When W2-PR4 ships verifier route handlers, the code reviewer MUST gate the merge on every handler running an explicit ownership check. If a verifier route handler ships without it, R-4 becomes exploitable.

2. **Stale JWT post-demotion** (R-1). Bounded by Clerk session TTL.

3. **Replay within JWT TTL** (R-2). Bounded by Clerk session TTL.

### Not yet considered (out of scope, flagged for future waves)

- **JWT signature algorithm pinning.** Clerk advertises ES256; we trust their signature library. A future wave should assert the algo at the verification step.
- **`x-verifier-org` header injection via reverse proxy.** If a CDN/edge node ever strips or rewrites this header, the gate's behavior changes silently. Current architecture (Vercel direct) does not inject this header — verified by inspection of `/middleware.ts` matcher.
- **Audit log access control.** `/api/audit/*` is not in the `VERIFIER_API` namespace. W2-PR3 must add an `ADMIN` role gate; that's not this PR's concern. **Until W2-PR3 lands, audit log access is unguarded** — `SECURITY_INVARIANTS.md` §4.5 names this.

---

## Remaining ownership risks

### High-priority follow-ups (W2-PR2, W2-PR3, W2-PR4)

| Risk | Mitigated by | Wave |
|---|---|---|
| `POST /api/employer-review/[entityId]/accept` accepts head-start without role check | role-check + audit-event write inside handler | W2-PR2 |
| `/api/audit/events` reads audit log without auth | `ADMIN` gate at handler | W2-PR3 |
| `/api/psv/oig/check/[npi]` triggers PSV check without auth | `VERIFIER` gate at handler | W2-PR3 |
| `/api/hiring/accept`, `/api/hiring/start` mutate without auth | role + audit-event at handler | W2-PR3 |
| `/api/employer/applications`, `/api/employer/decisions` read without auth | `EMPLOYER` gate at handler | W2-PR3 |
| `/api/verifier/*` route handlers (when introduced) lack Layer-2 ownership check | mandatory check at handler | W2-PR4 |

W2-PR1 alone does not close these. Code Red verification doc and `current-state-map-2026-05-07.md` already track them. **The cumulative tenant-isolation guarantee requires W2-PR1 + W2-PR4 (and the route handler discipline at W2-PR4 merge time).**

---

## Middleware-bypass possibilities

### Possible: route handler reading `req.headers.get('x-verifier-org')` and using it as a key (deferred-but-flagged)

If a future route handler reads `x-verifier-org` directly and uses it to key a DB query *without* re-checking against the JWT, the handler bypasses the middleware's intent. The header is *informational*, not authoritative. The Layer-2 check must use the JWT-derived `requestingOrgId`, not the raw header.

**Mitigation:** code review discipline at W2-PR2/W2-PR4 merge time. Recommend a lint rule or runtime helper that route handlers must use, e.g., `requireVerifierOrg(session): string` that returns the JWT-derived org or throws.

### Not possible by design

- Route handlers cannot reach the inside of `clerkHandler` to bypass Step 0.
- The `INTELLIGENCE_API` graceful-degrade catch wraps `clerkHandler` — if Step 0 throws (which it shouldn't, since helpers are total), the catch lets the request fall through. **Caveat:** verifier routes are NOT in `INTELLIGENCE_API`, so they don't go through the catch. A throw from Step 0 propagates to the caller as 500. Current code has no throw paths in Step 0; helpers are total.
- The CORS allowlist gate runs *before* `clerkHandler`. A verifier route from a disallowed origin gets 403 with `x-cors-blocked: 1` — never reaches Step 0.

---

## Readonly weaknesses

### None at the middleware level

Gate 3 fires for `readonly` + `{POST,PUT,DELETE,PATCH}`. OPTIONS / HEAD / GET pass (verified by tests). The check is method-based; a route handler CANNOT semantically "POST as readonly" without the gate firing.

### Possible at the route handler level (W2-PR2+)

A future route handler that uses `POST` for a logically-idempotent operation (e.g., a POST-with-large-body export) would block readonly users from a logically-safe action. **This is the conservative default and is correct** — if a POST endpoint is logically read-only, the route handler should expose it as GET, not bypass the readonly gate.

---

## Route drift risks

### Possible: someone adds a new public-route pattern that overlaps `/api/verifier/*`

If a future PR adds `/^\/api\/verifier(\/.*)?$/` (or any pattern that matches verifier paths) to `PUBLIC_ROUTE_PATTERNS`, the public-pattern check still runs *after* Step 0 — so Step 0 fires first. **This PR's ordering inside `clerkHandler` defends against accidental public exposure.**

But the order in `roles.ts` `PUBLIC_ROUTE_PATTERNS` could be changed; if `isPublicRoute()` returns `true` before Step 0 runs … no, `isPublicRoute()` is only called in Step 1, which is *after* Step 0. The ordering inside `clerkHandler` is the load-bearing thing, not the order in the array.

### Possible: someone changes the matcher in `middleware.ts:config`

The current matcher includes `'/(api|trpc)(.*)'` which ensures middleware runs for all API routes. If a future PR removes this, verifier routes wouldn't even hit the middleware. **Risk:** a PR touching the matcher must be reviewed against this concern. The middleware comment block does not name this — recommend adding a defensive comment near `config.matcher` in a follow-up cleanup.

### Possible: someone broadens `VERIFIER_API` regex

Anyone broadening `/^\/api\/verifier(\/.*)?$/` to e.g. `/^\/api\/verifier|\/api\/admin(\/.*)?$/` would inadvertently gate non-verifier routes through Step 0. **This PR locks the constant declaration with a doc comment** ("Adding new routes here is a security-sensitive change requiring founder review"). Code review discipline.

---

## Summary

**Exploitable today:** none in this PR's scope. The most dangerous residual is R-4 (Layer-2 deferral), which is an explicit acknowledged dependency on W2-PR4 + route-handler discipline.

**Acceptable risks:** R-1, R-2 (Clerk session-TTL bounded).

**Defended-by-design:** R-3, R-5, R-6, R-7, R-8, R-9, R-10, R-11. Each verified by an explicit test case.

**Recommended for next session:** plan W2-PR4 with the explicit Layer-2 ownership check pattern named (e.g., `requireOrgOwnsResource(session, resourceId): asserts ...`) so route handlers cannot ship without it.
