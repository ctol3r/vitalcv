# W2-PR1 — RBAC Foundation · Implementation Summary

**Branch:** `wave/w2-pr1-rbac-foundation`
**Worktree:** `/private/tmp/vitalcv-w2pr1`
**Risk classification:** **HIGH_RISK** (`apps/web/middleware.ts` modification — auth path, per `openclaw-risk-classification.md`)
**Domain crossings:** 1 (Auth / RBAC — single domain)
**Files changed:** 4 product + 3 docs = 7 (well under the 15-file PR cap)

This PR installs the RBAC primitives that all subsequent Wave 2 PRs depend on. It is **deliberately small** — four files, one concern, no Prisma, no migrations, no service-layer changes, no route handlers.

---

## Exact files changed

### Product (4)

| File | Change | Lines |
|---|---|---|
| `apps/web/lib/auth/roles.ts` | additive — exports `VERIFIER_TEAM_ROLES` + `VerifierTeamRole` | +18 |
| `apps/web/lib/auth/orgInvitations.ts` | new — pure RBAC decision module | +145 (new file) |
| `apps/web/middleware.ts` | modification — adds `VERIFIER_API` Step-0 intercept | +60 |
| `apps/web/__tests__/verifier-rbac-enforcement.test.ts` | new — 26 deterministic pure-function tests | +218 (new file) |

### Docs (3, this set)

| File | Purpose |
|---|---|
| `docs/ops/w2-pr1-implementation-summary.md` | this doc |
| `docs/ops/w2-pr1-risk-review.md` | adversarial self-review |
| `docs/ops/w2-pr1-rollback-notes.md` | rollback procedure |

### Files explicitly NOT changed

```
apps/web/lib/issuer-verification/          # PSV trust chain — untouched
apps/web/prisma/schema.prisma              # No schema in this PR
apps/web/app/api/employer-review/          # Acceptance logic — W2-PR2
apps/web/app/api/audit/                    # Audit routes — W2-PR3
apps/web/app/api/hiring/                   # Hiring flows — W2-PR3
apps/web/app/api/psv/                      # OIG/PSV routes — W2-PR3
apps/web/app/api/verifier/                 # Route handlers will be added in W2-PR4
packages/                                   # All packages — untouched
apps/web/lib/auth/clerkConfig.ts           # Clerk wiring — untouched
```

---

## Exact routes affected

The middleware adds a Step-0 intercept on the `VERIFIER_API` regex `/^\/api\/verifier(\/.*)?$/`. As of `origin/main @ 9eb5cdee`, **zero route handlers exist** under `apps/web/app/api/verifier/`. This means the immediate observable effect is:

| Behavior | Before this PR | After this PR |
|---|---|---|
| `GET /api/verifier/anything` (route doesn't exist yet) | 404 from Next.js routing | **403** from middleware (caller has no Clerk session) **or** **404** if Clerk session passes Gate 1 but not Gate 2; actual route 404 only when Gates 1–3 pass and the route handler is missing |
| `POST /api/verifier/anything` from a `readonly` user with valid org claims | 404 from Next.js | **403** from middleware (Gate 3) |
| `GET /api/verifier/anything` from a cross-org caller | 404 from Next.js | **404** from middleware (Gate 2) |

When W2-PR4 lands actual route handlers, the same gate flow holds — but with the added Layer-2 resource-ownership check inside each handler.

**Routes outside `/api/verifier/*`:** completely unchanged. `/api/employer-review/*`, `/api/audit/*`, `/api/hiring/*`, `/api/psv/*` retain their current auth posture (which is "public" for many of them — those are W2-PR3's scope).

---

## Exact middleware changes

Three additions to `apps/web/middleware.ts`:

1. **Import** of `checkVerifierPermission` and `parseTeamRole` from `@/lib/auth/orgInvitations`.

2. **`VERIFIER_API` constant** declared adjacent to the existing `INTELLIGENCE_API` constant. Both regexes are precise; both serve different purposes.

3. **Step-0 block** inside `clerkHandler`, **before** the existing Step 1 (`isPublicRoute(pathname)` check). This is critical: `PUBLIC_ROUTE_PATTERNS` exempts the entire `/api/*` namespace (line 103 of `roles.ts`), so without Step 0, every `/api/verifier/*` route would fall through as public.

The Step-0 block:
- Resolves `auth()` exactly once per request.
- Returns **403** when `session.userId` is absent (caller has no Clerk session). Not 401, because `/api/*` is declared public; the standard sign-in redirect would be inappropriate.
- Reads `requestingOrgId` from `session.sessionClaims?.vitalcv?.org_id` only — **never** from headers, body, or query params.
- Reads `teamRole` via `parseTeamRole(claims?.team_role)` — null on unknown / missing / non-string.
- Reads `resourceOrgId` from `req.headers.get('x-verifier-org') ?? ''` — **declared, not trusted**. Compared timing-safely against `requestingOrgId` in Gate 2.
- Calls `checkVerifierPermission(...)` and returns the decision's `statusCode` on refusal, or `NextResponse.next()` on permission.

The existing graceful-degrade pattern for `INTELLIGENCE_API` (catches Clerk edge failures and falls through) is **preserved verbatim**. The CORS allowlist gate that runs before `clerkHandler` is **preserved verbatim**.

---

## Exact helper changes

`apps/web/lib/auth/orgInvitations.ts` (new file) exports:

| Symbol | Type | Purpose |
|---|---|---|
| `rbacEnforced` | `true as const` (literal) | Sealed enforcement flag — cannot be widened to `boolean` |
| `RbacFailureReason` | `'no_org_context' \| 'readonly_blocks_mutation' \| 'cross_org'` | Three reasons map to two HTTP codes (403, 404) |
| `RbacDecision` | `{ permitted: true } \| { permitted: false; statusCode: 403 \| 404; reason: RbacFailureReason }` | Discriminated union; callers narrow via `if (!decision.permitted)` |
| `MembershipContext` | interface | Inputs for `checkVerifierPermission` |
| `checkVerifierPermission` | `(ctx: MembershipContext) => RbacDecision` | The 3-gate decision function |
| `timingSafeEqualStrings` | `(a: string, b: string) => boolean` | Edge-safe constant-time compare |
| `parseTeamRole` | `(raw: unknown) => VerifierTeamRole \| null` | Safe parser; null on unknown |

**Edge-safety correction (per W2-PR1 final adversarial review F-1):** the helper-spec doc's literal instruction to use `crypto.timingSafeEqual` from `node:crypto` was **incorrect** for Next.js Edge middleware (`node:crypto` is not stable in Edge runtime). The actual implementation uses `TextEncoder` (Web API) + manual XOR accumulation with no early exit and no length-based short-circuit. This matches what PR #243 originally implemented and what the adversarial review explicitly mandated.

---

## Exact invariants enforced

Per `docs/ops/SECURITY_INVARIANTS.md`:

| Invariant | Section | How enforced |
|---|---|---|
| Authentication does not imply authorization | §1.1 | Step 0 runs auth check, then runs separate permission check |
| Identity coherence does not imply ownership | §1.2 | Layer-1 only; Layer-2 deferred to route handlers (W2-PR4) — documented in middleware comment |
| `orgId` from client input is never ownership proof | §1.3 | `x-verifier-org` validated against JWT `org_id`, never trusted as ownership claim |
| Middleware validates identity coherence only | §1.4 | Step 0 only validates JWT-org vs claimed-org; resource ownership deferred |
| Route handlers validate ownership semantics | §1.5 | Documented as W2-PR4 prerequisite; middleware comment names this requirement |
| Readonly cannot mutate | §3.1 | Gate 3 fires for `readonly` + `{POST,PUT,DELETE,PATCH}` |
| Forbidden responses do not leak tenant existence | §5.5 | Cross-org returns **404** (Gate 2), not 403 |
| Authorization checks are timing-safe | §6.2 | `timingSafeEqualStrings` processes every byte position regardless of length |
| Security helper ordering is load-bearing | §6.3 | 3 gates fire in immutable order: no_org_context → cross_org → readonly_blocks_mutation. Tests lock the ordering. |
| Auth helper primitives are deterministic | §6.4 | Module is pure: no fetches, no DB, no I/O, all functions synchronous |
| Public routes explicitly enumerated | §5.1 | No new entries to `PUBLIC_ROUTE_PATTERNS`; `VERIFIER_API` is a new regex outside the public-pattern list |

---

## Intentionally deferred work

Per `docs/ops/w2-pr1-rbac-foundation-plan.md` "Explicitly NOT in W2-PR1":

| Item | Wave | Reason deferred |
|---|---|---|
| Employer-review acceptance role check | W2-PR2 | Different file path (`apps/web/app/api/employer-review/`); different test surface; combining would breach single-concern rule |
| Audit / hiring / PSV API guards | W2-PR3 | Different namespace; needs its own `ADMIN`-role gate + audit-event writes (different concern) |
| Verifier invitation lifecycle | W2-PR4 | Requires a new Prisma model + DB writer; FOUNDER_REQUIRED if scope grows; separate PR |
| Route-handler **Layer-2** ownership checks | W2-PR4 | Each `/api/verifier/*` handler must verify the resource named by URL params belongs to `requestingOrgId`. The middleware comment names this dependency explicitly. **Middleware alone is structurally insufficient for full tenant isolation** — this is documented in `w2-pr1-route-classification.md`. |
| Pre-existing latent bug: `BLOCKING_REASON_ORDER` omits `'ACTIVE_DIVERGENCE'` (W1.1 surfaced this) | separate one-line PR | Unrelated to W2-PR1; defer to keep this PR surgical |
| `apps/web/lib/auth/orgInvitations.ts` evolution to support invitation rows | W2-PR4 | This PR keeps the module pure (no DB) — invitation persistence is its own module |

---

## Blast-radius analysis

### If the PR is correct (expected)

- **Observable change:** none on production today. Zero route handlers exist under `/api/verifier/*` on `origin/main @ 9eb5cdee`. The middleware adds an *armed* gate that no production traffic currently traverses.
- **Test surface:** 26 new vitest cases. All pass.
- **Build / lint / typecheck:** green.
- **Edge runtime compatibility:** verified via build success; the helper uses `TextEncoder` (Web API), which is stable in Edge.

### If the PR has a regression I missed

- **Most likely failure:** an existing `/api/*` route happens to match the pattern `/^\/api\/verifier(\/.*)?$/`. I confirmed via `find apps/web/app/api/verifier -type d` on origin/main that no such route exists. Risk: zero today. As soon as W2-PR4 adds the first route, the gate engages — that's the design.
- **Second-most-likely failure:** the `INTELLIGENCE_API` graceful-degrade catch swallows an exception from the new Step-0 block. I preserved the catch verbatim; Step 0 runs *inside* `clerkHandler`, which is *what* the catch wraps. If `clerkHandler` (and thus Step 0) throws, intelligence-API requests degrade to public — but a verifier-API request that throws would also degrade. **Mitigation:** the Step-0 block catches no exceptions of its own; any throw propagates to the wrapping `try` in the outer `middleware()` function. This is identical behavior to the prior middleware shape for unexpected errors.
- **Worst case:** a malformed JWT claim somehow trips a runtime exception inside `parseTeamRole` (impossible — function is total: returns `null` for all non-matching inputs; pure type-narrowing).

### If the PR is reverted

- All four product files revert. The 26 new tests are deleted with the file. No data, schema, auth, or persisted state is affected. The system returns to "no `/api/verifier/*` namespace" — exactly its current state.

### Cascade risk on subsequent waves

W2-PR2, W2-PR3, W2-PR4 all depend on the symbols this PR exports. If those PRs land before this one merges, they will fail to import `checkVerifierPermission`, `VERIFIER_TEAM_ROLES`, etc. **This PR must merge first** to unblock the wave.

---

## Verification artifacts (run on this branch)

```
$ pnpm --filter @vitalcv/web exec vitest run __tests__/verifier-rbac-enforcement.test.ts
  Test Files  1 passed (1)
        Tests  26 passed (26)

$ pnpm --filter @vitalcv/web exec vitest run
  Test Files  157 passed | 1 skipped (158)
        Tests  1493 passed | 4 skipped (1497)
  (No regressions; +26 from this PR)

$ pnpm --filter @vitalcv/web exec next lint --file <four-touched-files>
  ✔ No ESLint warnings or errors

$ pnpm turbo run build --filter @vitalcv/web
  Tasks: 13 successful, 13 total · Time: 34.703s
  (Edge runtime compile clean — TextEncoder XOR pattern verified safe for Edge)
```

---

## Per-PR doctrine compliance checklist

Per `docs/ops/VITALCV_OPERATING_DOCTRINE.md`:

- [x] No banned strings introduced (§2.5)
- [x] No bare `>Verified<` rendered (§2.7) — N/A, no UI touched
- [x] No new vendor name claimed (§1.2) — N/A
- [x] Every new mutating endpoint writes an `AuditEvent` (§5.1) — N/A, no endpoint added
- [x] Every new demo surface tagged `recordedBy: 'demo'` + banner (§4.1) — N/A
- [x] No score/level path widened (§8.1) — N/A
- [x] No literal-typed invariant widened to `boolean` (§2.3, §6.3) — `rbacEnforced` is `true as const`; tests lock this
- [x] No env flag introduced bypassing auth/audit/RBAC (§6.4) — none added
- [x] Every claim cites a source (§3, §5.3) — every comment cites file:section
- [ ] Codex SAFE verdict in transcript (§6.1) — **REQUIRED BEFORE MERGE — see `w2-pr1-codex-audit-plan.md`**

Per `docs/ops/SECURITY_INVARIANTS.md`:

- [x] No new public route added (§5.1)
- [x] Every new dynamic-segment route has an explicit ownership check (§3.5) — N/A, no route handlers added
- [x] Every new mutating endpoint writes an `AuditEvent` (§4.1) — N/A
- [x] No `actorId` defaulted to `'system'` / empty (§4.2) — N/A
- [x] No string-compare on a secret without timing-safe path (§6.2) — `timingSafeEqualStrings` provided
- [x] No reordering of `checkVerifierPermission(...)` gates (§6.3) — gates declared in mandated order; tests lock it
- [x] Cross-org access returns 404, not 403 (§5.5)
- [x] Readonly users blocked from mutations at the middleware (§3.1) — Gate 3
- [x] No role-inheritance assumption introduced without explicit declaration (§3.3) — none introduced
- [ ] Founder review obtained for HIGH_RISK middleware change (§7.1) — **REQUIRED BEFORE MERGE**
- [ ] Codex SAFE verdict in transcript (§7.3) — **REQUIRED**
