# W2-PR1 — Final Adversarial Security Review
**Wave:** Wave 2, PR 1
**Date:** 2026-05-07
**Classification:** HIGH_RISK — middleware.ts modification on Clerk auth path
**Status:** Pre-implementation review only — NO implementation, NO merge
**Reviewer roles:** multi-tenant authorization adversary, org-boundary reviewer, verifier-trust reviewer, infrastructure security reviewer
**Threat model:** malicious verifier, forged client headers, stale JWT roles, replay, route probing, privilege escalation
**Inputs read:**
- [w2-pr1-rbac-foundation-plan.md](docs/ops/w2-pr1-rbac-foundation-plan.md)
- [w2-pr1-auth-helper-spec.md](docs/ops/w2-pr1-auth-helper-spec.md)
- [w2-pr1-route-classification.md](docs/ops/w2-pr1-route-classification.md)
- [w2-pr1-readonly-semantics.md](docs/ops/w2-pr1-readonly-semantics.md)
- [w2-pr1-codex-audit-plan.md](docs/ops/w2-pr1-codex-audit-plan.md)
- [rbac-wave-threat-model.md](docs/ops/rbac-wave-threat-model.md)
- [rbac-wave-risk-analysis.md](docs/ops/rbac-wave-risk-analysis.md)
- [rbac-wave-test-plan.md](docs/ops/rbac-wave-test-plan.md)
- [rbac-wave-pr-plan.md](docs/ops/rbac-wave-pr-plan.md)
- Actual PR #243 diff (4 files: roles.ts, orgInvitations.ts, middleware.ts, test)
- Current state of [middleware.ts](apps/web/middleware.ts), [roles.ts](apps/web/lib/auth/roles.ts), [employer-review/[entityId]/[action]/route.ts](apps/web/app/api/employer-review/[entityId]/[action]/route.ts)

**Note on missing inputs:** Two referenced files do not exist on this branch:
- `docs/ops/SECURITY_INVARIANTS.md` — not created
- `docs/ops/rbac-adversarial-security-review.md` — not created

Their absence is itself a finding (see F-12).

---

## Executive Summary

W2-PR1 is conceptually sound: a small, additive, pure-function RBAC primitive plus a precise middleware intercept. The threat model is correctly understood, the gate ordering is load-bearing and documented, and the cross-org-as-404 design is sound. Most invariants in the spec match how PR #243 actually implements them.

However, this review surfaces **three blocking findings** and **eight non-blocking findings** that must be resolved before Claude Code Terminal begins implementation. The blocking findings are not exploitation paths in the code itself — they are contradictions between the spec, the audit plan, and PR #243 that will cause the Codex audit to fail or, worse, cause the implementer to write dead-wrong code.

The single most dangerous failure mode is not in W2-PR1 itself: it is that **W2-PR1 deliberately defers Layer-2 ownership enforcement to later PRs while simultaneously moving forward with a route namespace (`/api/verifier/*`) that will receive its first real route handlers in W2-PR4**. If W2-PR4 lands without explicit, mandatory route-handler ownership checks, the system will be tenant-leaky despite middleware being "armed."

---

## Findings

### F-1 — BLOCKING — Spec/audit/PR contradiction on `timingSafeEqualStrings` implementation

**Layer:** auth helper (`orgInvitations.ts`)
**Exploit path:** None directly — this is a planning bug, not a runtime bug
**Severity:** BLOCKING (Codex will FAIL the audit; implementer cannot proceed without resolving)

The auth-helper spec, the Codex audit plan, and the PR #243 actual code disagree about the correct implementation:

| Source | Required implementation |
|---|---|
| `w2-pr1-auth-helper-spec.md` §`timingSafeEqualStrings` | "uses `crypto.timingSafeEqual` from Node.js `node:crypto`" — code sample imports `from 'node:crypto'` |
| `w2-pr1-codex-audit-plan.md` Audit 1 | "Uses crypto.timingSafeEqual from node:crypto (NOT a manual loop)" — manual loop = FAIL |
| `rbac-wave-test-plan.md` test #7 | "orgId comparison must use crypto.timingSafeEqual" |
| **PR #243 actual code** | `TextEncoder` + manual XOR loop, no `node:crypto` import |

Next.js middleware runs in the **Edge runtime by default**, and `node:crypto` is NOT a stable Edge primitive. PR #243's approach (TextEncoder XOR with no early exit) is the correct implementation for Edge. The spec and audit plan are technically wrong: they require code that would fail at Edge runtime startup or when bundled.

If Claude Code Terminal follows the spec literally and imports `node:crypto`, the middleware will fail to build for Edge, OR will run in Node runtime with measurably worse cold-start, OR will silently downgrade. If Codex follows the audit plan literally, it will FAIL PR #243's correct implementation.

**Mitigation (must complete BEFORE implementation):**
1. Update `w2-pr1-auth-helper-spec.md` §`timingSafeEqualStrings` to require an Edge-runtime-safe constant-time compare. Replace the Node-crypto example with the TextEncoder XOR pattern from PR #243 (no early exit, full-length scan).
2. Update `w2-pr1-codex-audit-plan.md` Audit 1 to allow the manual XOR loop **specifically when** (a) every byte position is processed regardless of length, (b) length difference is folded into the mismatch accumulator before the loop, and (c) no `===` short-circuit is used anywhere in the function.
3. Update `rbac-wave-test-plan.md` test #7 to remove the "must use crypto.timingSafeEqual" assertion; replace with a behavioral test that demonstrates: identical → true; different-but-same-length → false; different-length → false.

**Proper enforcement layer:** Specification + audit checklist (must be reconciled in writing before Codex runs).

---

### F-2 — BLOCKING — Type-assertion `as string` for `requestingOrgId` is unsafe and contradicts spec

**Layer:** middleware (`middleware.ts`)
**Exploit path:** Middleware crash → 500 → fail-open behavior depending on Next.js error handling
**Severity:** BLOCKING — easily fixed but presently in PR #243

PR #243 derives `requestingOrgId` via:
```typescript
const requestingOrgId = (claims?.org_id as string | undefined) ?? null;
```
This is a **type assertion** (lies to the compiler), not a **type check**. If Clerk publicMetadata is misconfigured and `org_id` is a number, boolean, or object, the runtime value flows through unchecked. It is then passed to `timingSafeEqualStrings`, which calls `TextEncoder.encode(a)`. `TextEncoder.encode` will coerce non-strings, but the behavior on numbers/booleans is implementation-defined (V8 generally stringifies, but the result is unsafe — `true` → `"true"`, `12345` → `"12345"`).

The spec correctly mandates the safer pattern:
```typescript
const requestingOrgId = typeof claims?.org_id === 'string' ? claims.org_id : null;
```
This is also what `parseTeamRole` already does for `team_role`. The asymmetry between `org_id` (unchecked cast) and `team_role` (checked parser) is itself suspicious.

**Exploit path:** A Clerk admin who misconfigures `publicMetadata.vitalcv.org_id` (e.g., sets it as a number from an internal ID) creates an `org_id` of type `number`. The middleware passes the number to `timingSafeEqualStrings`. The number is stringified by TextEncoder and may match `x-verifier-org: "12345"`. This is not a remote attack but is a tenant-isolation footgun.

A more pointed exploit: if the Clerk JWT can have `vitalcv.org_id: { toString: () => 'org_a' }`, the cast lies about the type, the value passes through, and stringification produces `'org_a'`. JWT claims are JSON, so functions can't be embedded — but the pattern of trusting an untyped cast for a security-critical field is unsafe regardless.

**Mitigation (must complete BEFORE implementation):**
- Replace the cast with `typeof claims?.org_id === 'string' ? claims.org_id : null` exactly as the spec requires.
- Add a test: "non-string org_id claim is treated as null and produces 403 no_org_context."
- Add to Codex audit: "requestingOrgId derivation uses `typeof === 'string'`, not `as string`."

**Proper enforcement layer:** Middleware (input validation at the boundary).

---

### F-3 — BLOCKING — Layer-2 ownership enforcement is documented as required but has no implementation gate

**Layer:** route handlers (does not yet exist for `/api/verifier/*`)
**Exploit path:** Cross-tenant resource access via correctly-stamped JWT + matching `x-verifier-org` + arbitrary resource ID
**Severity:** BLOCKING for the wave (not for W2-PR1 specifically — but W2-PR1 cannot ship without an enforcement plan for W2-PR4)

The plan correctly states (`w2-pr1-rbac-foundation-plan.md` §"What `x-verifier-org` is NOT"): the header is NOT a resource-ownership claim. It only proves "I am acting on behalf of this org," validated against the JWT. Layer-2 — "the resource being accessed actually belongs to this org" — is delegated to route handlers.

But:
1. `/api/verifier/*` route handlers do not exist on `origin/main` today (`find apps/web/app/api -type d` confirms zero `verifier` directories).
2. W2-PR4 is the PR that adds `/api/verifier/invite`, `/api/verifier/team`, etc.
3. W2-PR4 is classified GUARDED, not HIGH_RISK, and its scope ("Verifier Invitation Foundation") does not explicitly require Layer-2 ownership checks in its exit criteria (`rbac-wave-pr-plan.md` §W2-PR4).
4. The `w2-pr1-route-classification.md` document states "Every `/api/verifier/*` route handler must perform a resource ownership check" but the W2-PR4 exit criteria do not enforce this.

**Exploit path (post-W2-PR4 if Layer-2 is omitted):** A verifier in Org A signs in. Their JWT contains `vitalcv.org_id: 'org_a'`. They call `GET /api/verifier/team/members?orgId=org_b` with header `x-verifier-org: org_a`. Middleware validates: requestingOrgId (org_a) matches resourceOrgId (org_a) → permitted. Route handler reads `?orgId=org_b` from the URL or body and returns Org B's roster. **Tenant isolation broken.**

**Mitigation (must complete BEFORE W2-PR4 plans are finalized — but documented now to gate W2-PR1's correctness):**
1. Add a hard exit criterion to W2-PR4: "Every new `/api/verifier/*` route handler MUST call a centralized ownership check (e.g., `assertResourceOwnedByOrg(resourceId, requestingOrgId)`) before any read or write. Codex audit MUST verify this for every new route."
2. Add a unit test pattern (W2-PR4 test plan): "Cross-org resource access — a request with valid JWT + matching x-verifier-org + a resource ID owned by another org returns 404 (not 200, not 403)."
3. Add to W2-PR1 documentation an explicit reminder block at the top of `orgInvitations.ts` that says: "This module enforces Layer 1 only. Layer 2 (resource ownership) is the responsibility of the route handler. Do not import or call this module without a corresponding ownership check."

**Proper enforcement layer:** Route handler. Middleware can never enforce ownership without a DB read, and middleware should not have DB access in Edge runtime.

---

### F-4 — NON-BLOCKING — Stale JWT role retains privileges after demotion

**Layer:** Clerk session lifecycle (out of code)
**Exploit path:** Recently-demoted user retains write privileges until JWT refresh
**Severity:** MEDIUM (window-bounded; requires prior elevated access)

When an org owner demotes a member to readonly, the demoted user's existing JWT still contains `team_role: 'member'` until it is refreshed. Clerk's session token TTL is typically ~60s and the long-lived session cookie refreshes the JWT periodically — but the worst-case window for a stale role is on the order of one minute, plus any time the user is offline.

`w2-pr1-readonly-semantics.md` §"Readonly Escalation Path" acknowledges this for escalation but does not address the symmetric demotion case.

**Exploit path:** An admin demotes a malicious member to readonly. The malicious user, mid-session, posts a credential refresh request before their JWT refreshes. The middleware checks the cached JWT (still says `member`), Gate 3 passes, the action lands.

**Mitigation:**
- Document the stale-role window in `w2-pr1-readonly-semantics.md`.
- For high-risk actions (e.g., `accept` in W2-PR2), consider a parallel real-time role check via Clerk's `clerkClient.users.getUser()` — but only on the highest-risk mutations, since this is a server-only API call and adds latency.
- For W2-PR1, document only. Do not add the real-time check (out of scope).

**Proper enforcement layer:** Route handler for the highest-risk endpoints (W2-PR2/W2-PR4); middleware accepts the JWT staleness window as a known limitation.

---

### F-5 — NON-BLOCKING — No try/catch around `await auth()` in the VERIFIER_API block

**Layer:** middleware (`middleware.ts`)
**Exploit path:** Clerk Edge transient failure → uncaught exception → Next.js default 500
**Severity:** LOW-MEDIUM (fail-closed in practice — 500 is not pass-through — but degrades UX and is inconsistent with INTELLIGENCE_API graceful-degrade pattern)

The existing `INTELLIGENCE_API` block (`middleware.ts:124-131`) wraps `clerkHandler` in `try/catch` and falls through on Clerk Edge failure: "route handlers degrade gracefully." This pattern is intentional for the intelligence routes.

The new VERIFIER_API block has NO try/catch. If `await auth()` throws (Clerk edge timeout, missing key, transient network), the request errors out as 500.

**Exploit path:** None directly. But: an attacker who can induce Clerk transient failures (e.g., DNS poisoning at the resolver) could turn `/api/verifier/*` into a 500-fountain, denying service. More importantly, an inconsistency between INTELLIGENCE_API (graceful-degrade) and VERIFIER_API (no degrade) reflects a design inconsistency. Verifier should fail-closed (correct) but should fail-closed with a deterministic 503, not a 500 from an uncaught exception.

**Mitigation:**
- Wrap the VERIFIER_API block in try/catch.
- On Clerk failure, return `new NextResponse(null, { status: 503 })` — explicit, deterministic, fail-closed.
- Distinct from the INTELLIGENCE_API pattern: VERIFIER_API must NOT fall through to NextResponse.next() on Clerk failure.

**Proper enforcement layer:** Middleware. Add to spec and Codex audit.

---

### F-6 — NON-BLOCKING — 403 vs 401 inconsistency with rest of API

**Layer:** middleware
**Exploit path:** None — semantic inconsistency only
**Severity:** LOW

Spec mandates that missing `userId` on `/api/verifier/*` returns 403 (not 401). Justification given: the `/api/*` namespace is declared public via `PUBLIC_ROUTE_PATTERNS`, so 401 would be misleading.

Other API routes (`/api/employer-review/*`, `/api/clinician/*`, etc.) return 401 for missing `userId`:
```typescript
function unauthorizedResponse() {
  return NextResponse.json({ error: 'unauthorized', ... }, { status: 401 });
}
```

This inconsistency means a correctly-coded client that handles 401 → "redirect to /sign-in" will get 403 from `/api/verifier/*` and not redirect.

**Mitigation (advisory):**
- Consider returning 401 for missing `userId` on the VERIFIER_API path to maintain consistency with the rest of the API.
- If 403 is retained, document the rationale in code (the spec rationale is not in the comment in PR #243).
- This is non-blocking; either choice is defensible. Cross-checking shows the spec rationale ("the /api/* branch is declared public") is technically correct but not how the rest of the codebase behaves.

**Proper enforcement layer:** Middleware. Decision is advisory.

---

### F-7 — NON-BLOCKING — No audit visibility for RBAC failures in the middleware path

**Layer:** middleware + observability stack
**Exploit path:** Detection gap, not exploit gap
**Severity:** LOW (operational)

Middleware silently returns 403/404 on RBAC failure with no body, no audit event, and no log line. An attacker probing 1000 cross-org variants leaves no fingerprint in the audit log.

`w2-pr1-auth-helper-spec.md` says "No `console.log` or observability in the RBAC decision path (call sites may log)" and "Logging/observability — Call sites decide; helper is silent." This is correct for the helper. But the middleware itself does not emit any signal on RBAC failure.

**Exploit path:** Reconnaissance. Attacker enumerates org IDs and resource IDs without leaving any trace until they actually exfiltrate data via a Layer-2 bypass (F-3).

**Mitigation:**
- Out of scope for W2-PR1 to add observability (would expand scope beyond 4 files).
- Document as a known limitation: "RBAC decisions in middleware are not currently audited. A future PR may add a structured log emit on Gate 2 (cross_org) and Gate 3 (readonly_blocks_mutation) failures, with rate-limit-aware sampling to avoid log flooding under attack."
- Explicit out-of-scope marker in `w2-pr1-rbac-foundation-plan.md`.

**Proper enforcement layer:** Future PR — observability hook from middleware to a structured logger.

---

### F-8 — NON-BLOCKING — `x-verifier-org` empty-string fallback could be tightened

**Layer:** middleware
**Exploit path:** Probe behavior; very low signal
**Severity:** LOW

PR #243: `const resourceOrgId = req.headers.get('x-verifier-org') ?? '';`

When the header is absent, `resourceOrgId` is `''`. Gate 1 fires only on missing JWT/role. Gate 2 then compares JWT org_id (e.g., `'org_a'`) against `''` and returns 404 cross_org.

This is correct. But: an authenticated verifier who simply forgets to send the header gets 404 (not 400 "missing header"). The 404 is intentional ("don't leak whether the resource exists"), but a developer mistake (e.g., not sending the header in a fetch) presents as "no such route" rather than "you forgot the header."

**Exploit path:** None. This is a UX/DX issue, not security.

**Mitigation (advisory):**
- Acceptable as-is. Document in `w2-pr1-route-classification.md` that the empty-header case returns 404 deliberately.
- Optional: in dev mode (NODE_ENV !== 'production'), include a debug body explaining "x-verifier-org header missing." But this risks accidentally leaking in production. Recommend skipping.

**Proper enforcement layer:** Documentation only.

---

### F-9 — NON-BLOCKING — No regex validation of org_id format

**Layer:** middleware + helper
**Exploit path:** Tenant-isolation bypass via crafted org_id strings
**Severity:** LOW (Clerk's org IDs are well-formed; the worst case is benign)

`requestingOrgId` and `resourceOrgId` are compared as raw UTF-8 byte sequences. There is no validation that either looks like a Clerk org ID (`org_<random>`).

**Exploit paths considered:**
- Unicode normalization: NFC vs NFD encoding of the same logical org ID — `enc.encode` produces different byte sequences. **Risk:** if an attacker controls publicMetadata for one user and sets `org_id: 'org_𝐀'` (mathematical bold A) and the resource org ID is `'org_A'`, the bytes differ, no match, 404. This is fine — fail-closed.
- Null bytes: `'org_a '` vs `'org_a'` — different bytes, 404.
- Trailing whitespace: `'org_a '` vs `'org_a'` — different bytes, 404.

All cases fail-closed. No exploit found. But:

**One concern:** If a future Clerk update adds a new org_id format with embedded whitespace or punctuation, the current regex-less approach is brittle. Adding a `parseOrgId(raw): string | null` helper that asserts `^org_[A-Za-z0-9_-]+$` would harden the input before comparison.

**Mitigation (advisory):**
- Add a `parseOrgId` validator analogous to `parseTeamRole`. Returns `null` for malformed inputs. Both `requestingOrgId` and `resourceOrgId` flow through it.
- This is a defense-in-depth hardening, not a fix for an active exploit.

**Proper enforcement layer:** Helper module (non-blocking enhancement).

---

### F-10 — NON-BLOCKING — `__tests__/verifier-rbac-enforcement.test.ts` does not assert middleware integration

**Layer:** test plan
**Exploit path:** Regression in middleware wiring not caught by test
**Severity:** LOW

The current PR #243 tests are pure-function tests of `checkVerifierPermission`, `timingSafeEqualStrings`, and `parseTeamRole`. They do NOT exercise the middleware wiring — i.e., they do not assert that:
- `/api/verifier/foo` is intercepted before `isPublicRoute`
- The intercept reads org_id from `sessionClaims.vitalcv.org_id` (and not from headers)
- Gate-2 mismatch returns a response with `null` body (no info leak)
- A 401-vs-403-vs-404 distinction is preserved

This is acceptable for a foundation PR (middleware tests are integration-level and would require a Clerk mock harness), but it leaves a regression-detection gap.

**Mitigation:**
- Acceptable for W2-PR1.
- Add a follow-up test in W2-PR4 that uses Next.js' `next/dist/server/middleware-runtime` or a request-mocking harness to exercise the middleware end-to-end.
- Document in `rbac-wave-test-plan.md` as a known follow-up.

**Proper enforcement layer:** Future test PR.

---

### F-11 — NON-BLOCKING — Method-spoofing surface

**Layer:** middleware (HTTP method derivation)
**Exploit path:** None observed in Next.js; theoretical
**Severity:** LOW

`ctx.method` comes from `req.method`. Next.js does not honor `_method` query overrides or `X-HTTP-Method-Override` headers by default. But:
- Some Next.js plugins or proxies (CDN, edge functions) may rewrite the method.
- If a future intermediary adds method rewriting, a readonly user could send `POST` with override `GET`, bypassing Gate 3.

**Mitigation:**
- Out of scope for W2-PR1.
- Document: "method comes from `req.method`. Method override headers are not currently honored. Any future middleware that honors method override must do so AFTER VERIFIER_API or the readonly gate is bypassable."

**Proper enforcement layer:** Documentation only.

---

### F-12 — NON-BLOCKING — Two referenced authority docs do not exist

**Layer:** documentation
**Exploit path:** Misalignment of guidance
**Severity:** LOW

The review prompt referenced:
- `docs/ops/SECURITY_INVARIANTS.md` — does not exist
- `docs/ops/rbac-adversarial-security-review.md` — does not exist

If these are intended as authoritative inputs to W2-PR1 reviewers, their absence means reviewers (Codex, Claude Desktop, this review) cannot verify against them. The W2-PR1 plan does not list them as dependencies, so the absence is not a blocker — but if they were intended to be created, they were not, and that is a process gap.

**Mitigation:**
- Either create both docs, OR remove references to them from review prompts and audit checklists.
- If `SECURITY_INVARIANTS.md` is intended to be the canonical list of inviolable invariants (e.g., "rbacEnforced must be literal true"), creating it would consolidate the list currently spread across 6 separate planning docs.

**Proper enforcement layer:** Documentation maintenance.

---

## Direct Answers to Required Questions

### 1. Is middleware-only RBAC insufficient?

**Yes — categorically insufficient for full tenant isolation.**

Middleware operates at Edge runtime with no DB access. It can validate **identity** (does the JWT match the claimed org?) but cannot validate **ownership** (does the requested resource belong to that org?). A verifier in Org A can set `x-verifier-org: org_a` (matching their JWT) and request a resource ID belonging to Org B; middleware permits the request because identity validation passes. Only the route handler — with DB access — can verify resource ownership.

This is a structural limit, not a design choice. The plan acknowledges it correctly. The danger is that W2-PR1 ships and creates the false impression that `/api/verifier/*` is protected; without Layer-2 enforcement in W2-PR4 route handlers, it is not.

### 2. Must ownership checks exist at route/service layer?

**Yes — mandatory. No exceptions.**

Every `/api/verifier/*` route handler must call a centralized ownership check that:
- Reads the resource ID from path/query/body.
- Reads `requestingOrgId` from JWT (NOT from `x-verifier-org`, which is only an identity claim).
- Performs a DB lookup to confirm the resource belongs to that org.
- Returns 404 (consistent with cross-org middleware behavior) if it does not.

This must be a hard gate on every W2-PR4 route in its Codex audit. The W2-PR1 scope does not include this enforcement, but **W2-PR1 cannot be considered safe to ship without an explicit, written commitment that W2-PR4 will enforce it.** See F-3.

### 3. May orgId EVER be trusted from client input?

**No — never as authoritative; only as a declarative claim that must match the JWT.**

The trust hierarchy is:
- **Clerk JWT `sessionClaims.vitalcv.org_id`** — authoritative, Clerk-signed, tamper-proof. This is the only source from which `requestingOrgId` may be derived.
- **`x-verifier-org` header** — declarative ("I am acting on behalf of org X"). Validated against the JWT via timing-safe compare. Never used as ownership proof.
- **Request body / query params / URL path params** — never used as org-scoping inputs. They may carry resource identifiers (which are then validated against `requestingOrgId` in Layer 2) but cannot establish org context themselves.

The route classification doc states this correctly. The W2-PR1 plan states this correctly. The risk is implementation drift — a future developer reading `x-verifier-org` as authoritative because middleware happens to pass it through.

### 4. Is readonly audit visibility dangerous?

**No — readonly access to verifier-scoped data is acceptable; readonly access to system audit logs is dangerous and is not in W2-PR1 scope.**

Readonly verifier team members may read packet status, coverage maps, clinician profile state — all org-scoped operational data. This is the intended grant.

Readonly verifier team members may NOT access `/api/audit/events` — that is system-level operational metadata (user actions, timestamps, entity IDs across orgs) and requires the `ADMIN` `UserRole` (not a verifier team role) per `w2-pr1-readonly-semantics.md`.

`/api/audit/events` is currently UNGUARDED (Tier 1 CRITICAL per threat model). W2-PR1 does NOT fix this. W2-PR3 fixes it. The danger is operational: if W2-PR1 ships and W2-PR3 stalls, the audit log remains world-readable.

The naming similarity ("audit visibility" / "audit log") is a hazard. Reviewers may conflate "readonly may view their own org's audit-style events" (acceptable) with "readonly may view system audit logs" (forbidden). The readonly semantics doc handles this correctly; reviewers should be careful not to weaken it.

### 5. Is W2-PR1 scope appropriately constrained?

**Yes — scope is tight and correct, with two caveats.**

The 4-file boundary is strict and the audit plan checks it. The plan correctly defers:
- Employer-review role check → W2-PR2
- API route guards (audit, PSV, hiring) → W2-PR3
- Verifier invitation lifecycle → W2-PR4
- Schema changes → never in this wave

**Caveat 1:** W2-PR1 by itself adds enforcement for routes (`/api/verifier/*`) that **do not yet exist in the codebase**. The middleware is "armed for future use." This is fine in principle, but it means W2-PR1 has zero immediate security impact. It is a foundation for W2-PR4. Reviewers must not interpret "W2-PR1 ships safely" as "the verifier API is now protected" — it is not, because there is nothing to protect yet.

**Caveat 2:** The most critical existing vulnerabilities (`/api/audit/events`, `/api/psv/oig/*`, `/api/hiring/*` all unguarded; `/api/employer-review/*` userId-only) are NOT touched by W2-PR1. They are deferred to W2-PR3 and W2-PR2. This sequencing is defensible (W2-PR1 establishes types and middleware that later PRs depend on), but reviewers should not be confused into thinking that merging W2-PR1 closes any current threat.

### 6. Is the implementation sequence safe?

**Yes — with the W2-PR4 ownership-check requirement (F-3) and the spec corrections (F-1, F-2) made first.**

The sequence is:
- **W2-PR1** (this PR): foundation. Adds types + middleware + helper. No immediate threat closure but is required for W2-PR4.
- **W2-PR2**: closes employer-review acceptance vulnerability. Highest immediate value. Depends on W2-PR1 only for `VerifierTeamRole` type.
- **W2-PR3**: closes audit/PSV/hiring/employer route vulnerabilities. Independent of W2-PR1 except for `apiGuard.ts` helper which may use `parseTeamRole`.
- **W2-PR4**: activates `/api/verifier/*` routes. THIS is where Layer-2 ownership checks become operationally required.

**Sequence risks:**
- If W2-PR4 is delayed indefinitely and W2-PR1 ships, the system has armed middleware with no routes to enforce against. Low risk; no downside beyond dead code.
- If W2-PR1 ships and W2-PR2 stalls, employer-review remains exploitable (CLINICIAN can self-accept). HIGH operational risk. Mitigation: W2-PR2 should follow W2-PR1 within days, not weeks.
- If W2-PR1 ships, W2-PR2 ships, and W2-PR3 stalls, audit log remains world-readable. CRITICAL operational risk. Mitigation: W2-PR3 should follow W2-PR2 within days.
- If W2-PR4 ships without Layer-2 ownership checks, tenant isolation is broken across the verifier API surface. HIGHEST risk in the sequence. Mitigation: F-3.

**Rollback ordering** is correctly specified in `rbac-wave-risk-analysis.md` (W2-PR4 → W2-PR3 → W2-PR2 → W2-PR1). Never revert W2-PR1 first while W2-PR2 still references its types.

---

## Summary of Required Resolutions Before Implementation

| Finding | Type | Resolution required before Claude Code Terminal starts? |
|---|---|---|
| F-1 (timingSafeEqualStrings spec/audit/PR contradiction) | BLOCKING | YES — update spec + audit plan + test plan |
| F-2 (`as string` cast for requestingOrgId) | BLOCKING | YES — change PR #243 to use `typeof` check + add test |
| F-3 (W2-PR4 ownership check missing from exit criteria) | BLOCKING | YES — add hard exit criterion to W2-PR4 plan now |
| F-4 (stale JWT role) | NON-BLOCKING | Document in readonly-semantics.md |
| F-5 (no try/catch around `await auth()`) | NON-BLOCKING | Add try/catch + 503 fallback to spec; update PR #243 |
| F-6 (403 vs 401 inconsistency) | NON-BLOCKING | Decision: keep 403 (rationale documented) OR change to 401 |
| F-7 (no audit visibility) | NON-BLOCKING | Document as out-of-scope known limitation |
| F-8 (empty-string fallback UX) | NON-BLOCKING | Document only |
| F-9 (no org_id format validation) | NON-BLOCKING | Optional; advisory |
| F-10 (no middleware integration test) | NON-BLOCKING | Add to W2-PR4 follow-up test plan |
| F-11 (method spoofing) | NON-BLOCKING | Document only |
| F-12 (missing referenced docs) | NON-BLOCKING | Create or remove references |

---

## Verdict

**IMPLEMENT_BLOCKED**

Three findings are blocking and must be resolved in the planning artifacts before Claude Code Terminal begins implementation:

1. **F-1**: The `timingSafeEqualStrings` implementation requirement is contradicted across the spec (`crypto.timingSafeEqual` from `node:crypto`), the Codex audit plan ("manual loop = FAIL"), and PR #243's actual code (TextEncoder XOR, no Node crypto). PR #243 is correct for Edge runtime; the spec and audit plan are technically wrong. If implementation follows the spec, the build breaks at Edge. If Codex follows the audit plan, it fails the correct PR. **Reconcile in writing first.**

2. **F-2**: PR #243 uses `(claims?.org_id as string | undefined) ?? null` — a type assertion that lies to the compiler about a security-critical input. The spec correctly mandates `typeof claims?.org_id === 'string' ? claims.org_id : null`. The PR's pattern asymmetrically trusts `org_id` (cast) versus `team_role` (validated by `parseTeamRole`). **Fix PR #243 before merge; add a test for non-string org_id; add a Codex audit checkpoint.**

3. **F-3**: The middleware in W2-PR1 is correctly scoped as Layer 1 (identity validation only). Layer 2 (resource ownership) is documented as required of route handlers but is NOT a hard exit criterion of W2-PR4 — the PR that will introduce the first `/api/verifier/*` route handlers. Without an explicit, audited ownership check on every new W2-PR4 route, the verifier API will be tenant-leaky despite the middleware being armed. **Add hard exit criterion to W2-PR4 plan now**, while the planning context is hot and before route implementation begins.

Once F-1, F-2, and F-3 are resolved in the planning artifacts (and PR #243 patched for F-2), W2-PR1 is conceptually safe to implement. The non-blocking findings (F-4 through F-12) should be documented but do not gate implementation.

**Why blocked, not "implement with warnings":** F-1 will cause a Codex FAIL or a build break — either way, implementation cannot complete cleanly. F-2 ships a known-bad pattern that the spec already flagged. F-3 is a structural hole large enough to defeat the entire RBAC wave's intent. Each is small to fix in writing; none is small to fix after the fact.

Do not implement. Do not merge.
