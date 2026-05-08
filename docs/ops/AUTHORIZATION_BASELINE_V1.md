# Authorization Baseline v1

**Title:** VitalCV Authorization Baseline v1 — Post-W2-PR1A Stabilization Snapshot · **Date:** 2026-05-08 · **Status:** **FROZEN** — defines the stable authorization posture as of W2-PR1A close (`caa01cd9`); subsequent waves evolve from this baseline · **Authority:** subordinate to `VITALCV_OPERATING_DOCTRINE.md`, `SECURITY_INVARIANTS.md`, `OWNERSHIP_INVARIANTS.md`; supersedes ad-hoc descriptions of "what's protected today" in launch tracking.

This document freezes the stable post-W2-PR1A authorization baseline for VitalCV. It is a snapshot of what the platform **does** guarantee, what it **does not yet** guarantee, the semantics that have stabilized, the invariants that are now load-bearing, and the risks that have been **explicitly deferred**.

The baseline exists so that subsequent ownership/workflow/audit enhancement waves (W2-PR2x and beyond) evolve from a known good floor rather than from drifting assumptions. A change that weakens any guarantee in §1 below is, by definition, a regression of v1 — flag it at review.

---

## 1. Stable Guarantees

These properties hold today on `origin/main` after the W2-PR1A merge. Each is verified by automated test, by code inspection of the merged diff, or by both. They are the load-bearing security floor of v1.

### 1.1 Degraded auth fails closed

When the Clerk dependency is unavailable (CLERK_SECRET_KEY unset, Clerk reachability degraded, JWKS fetch fails), middleware returns 503 with header `x-rbac-fail-closed: clerk_unavailable` for every `/api/verifier/**` route. No verifier endpoint becomes implicitly public when authentication is unhealthy. Verified by `__tests__/verifier-rbac-enforcement.test.ts` — `checkVerifierFailClosed` suite (5 cases).

### 1.2 `/api/verifier/**` never becomes public

The verifier API namespace is unconditionally authenticated regardless of the public-route matcher's behavior. Step-0 in `apps/web/middleware.ts` intercepts every `/api/verifier/**` request and routes it through fail-closed enforcement before the public-route check is consulted. Verified by `isVerifierApiRoute` namespace-predicate suite (3 cases).

### 1.3 Verifier-route interception precedes wildcard public matching

The middleware ordering is: identify `/api/verifier/**` first → run `checkVerifierFailClosed` → run `extractVerifierClaims` → only then consult `isPublicRoute`. The previous fail-open hole (where `isPublicRoute('/api/verifier/foo')` matched the `/api/*` wildcard and skipped auth when Clerk was unavailable) is closed. Verified by the integration tests that compose `extractVerifierClaims` with `checkVerifierPermission`.

### 1.4 Malformed org claims fail closed

A JWT whose `vitalcv.org_id` is missing, null, non-string, empty string, an array, or any other non-string-leaf is rejected by `extractVerifierClaims`. The handler returns 403 with no implicit grant. There is no path that uses an "unknown org" claim as if it were a valid tenant. Verified by `extractVerifierClaims — runtime claim validation` suite (12 cases).

### 1.5 Runtime claim validation is enforced

All consumption of `session.sessionClaims.vitalcv` flows through `extractVerifierClaims`, which performs runtime `isPlainObject` validation before reading any field. There are no `as Record<string, unknown>` casts on the claim path; the previous F-2 type-assertion code smell is eliminated. Verified by code-search assertion in the merge gate (`grep` for the cast pattern returns zero hits in `middleware.ts` and `lib/auth/orgInvitations.ts`).

### 1.6 Readonly cannot mutate verifier routes

The `readonly` team role is denied for all mutating verbs on `/api/verifier/**`. The denial is enforced by `checkVerifierPermission` which returns `{ permitted: false, reason: 'role_denied' }` for `readonly` against any verb other than the read-only set. Verified by `readonly role enforcement on /api/verifier/* (Gate 3)` suite (9 cases).

### 1.7 Cross-org access returns 404

When an actor in Org A requests a verifier resource owned by Org B, the response is 404 (not 403). This holds at the middleware level for org-id mismatches and is the wire that downstream ownership enforcement (W2-PR2B+) is required to reproduce. Verified by `cross-org access returns 404 (Gate 2)` suite (4 cases).

### 1.8 No implicit grant from absent org_id

A request with a Clerk session but no `vitalcv.org_id` claim is denied (no implicit fallback to "default tenant," no inheritance from another claim, no environment-default tenant). Verified by `org_id absent from JWT → no implicit grant (Gate 1)` suite (4 cases).

### 1.9 Constant-time org-id comparison (Edge-safe)

The `timingSafeEqualStrings` helper compares JWT-derived org_id to expected values via `TextEncoder` XOR over the full byte length, with no early return on mismatch. The Edge-runtime constraint (no `node:crypto`) is honored; the F-1 finding is closed. Verified by the constant-time-comparison suite (5 cases).

---

## 2. Frozen Authorization Layers

The platform's authorization stack is defined as five layers. Layers 1 and 2 are **stabilized** in v1; Layers 3, 4, and 5 are **defined but not yet load-bearing** and evolve in subsequent waves.

| Layer | Name | v1 status | Source of truth |
|---|---|---|---|
| 1 | Middleware authorization | **stabilized (W2-PR1 + W2-PR1A)** | `apps/web/middleware.ts`, `apps/web/lib/auth/orgInvitations.ts` |
| 2 | RBAC helper authorization | **stabilized (W2-PR1)** | `checkVerifierPermission`, `VERIFIER_TEAM_ROLES` in `apps/web/lib/auth/{orgInvitations,roles}.ts` |
| 3 | Ownership authorization | **planned, not yet load-bearing (W2-PR2B target)** | `OWNERSHIP_INVARIANTS.md`, `RESOURCE_OWNERSHIP_DICTIONARY.md`, `w2-pr2b-implementation-lock.md` |
| 4 | Workflow authorization | **planned, not yet load-bearing (W2-PR2B+W2-PR3)** | `MUTATION_GATE_SEQUENCE.md` §3.5, `packages/domain-common/employmentGuards.ts` (existing canonical-path enforcement) |
| 5 | Audit authorization | **partially defined, not yet load-bearing on mutations (W2-PR2B target)** | `MUTATION_GATE_SEQUENCE.md` §3.6 + §4, `w2-pr2b-audit-coupling.md` |

### 2.1 Layer 1 — Middleware authorization (frozen)

Every `/api/verifier/**` request passes through `apps/web/middleware.ts` Step-0 before reaching any other handler. Step-0 enforces:

- Fail-closed when Clerk is degraded.
- Authenticated session present.
- Runtime-validated `vitalcv.org_id` and `vitalcv.team_role` claims.
- Cross-org 404 wire.

The frozen contract is: **no verifier API request reaches a route handler unless these four sub-checks have passed.**

### 2.2 Layer 2 — RBAC helper authorization (frozen)

`checkVerifierPermission(role, verb)` is the single source of truth for "can role X perform verb Y on a verifier route." The frozen contract:

- Roles: exactly `'owner' | 'admin' | 'member' | 'readonly'`.
- Verbs: the set permitted by the matrix in `lib/auth/orgInvitations.ts`.
- Result: pure decision; no side effects, no DB reads.
- `rbacEnforced: true as const` — the literal type pins the contract at compile time.

### 2.3 Layer 3 — Ownership authorization (planned)

Defined in `OWNERSHIP_INVARIANTS.md` and `RESOURCE_OWNERSHIP_DICTIONARY.md`. Compares JWT-derived `org_id` to DB-loaded `resource.tenantId`. Cross-tenant returns 404. **Not yet enforced on the route handlers.** W2-PR2B introduces the first load-bearing implementation (employer-review domain only).

### 2.4 Layer 4 — Workflow authorization (planned)

Defined in `MUTATION_GATE_SEQUENCE.md` §3.5. Reads workflow gates from existing domain code (`packages/domain-common/employmentGuards.ts`, the canonical 5-step path Recognition → Acceptance → Start, the CRS-80 acceptance gate, etc.). The path-level enforcement of these gates exists; the **handler-level coupling** (gate refusal → 409/422 + denied audit row) is not yet load-bearing on the route handlers. W2-PR2B introduces the first load-bearing handler-level coupling.

### 2.5 Layer 5 — Audit authorization (partially load-bearing)

Defined in `MUTATION_GATE_SEQUENCE.md` §3.6 and `w2-pr2b-audit-coupling.md`. Backend services (`apps/api/backend/src/services/audit/auditService.ts`) write audit rows for some flows today. The contract that **every mutation produces exactly one paired audit row in the same transaction, and every denied attempt also writes an audit row**, is defined but not yet enforced end-to-end on the web-route mutating actions. W2-PR2B closes this for the employer-review domain.

---

## 3. Current Non-Guarantees

These properties are NOT guaranteed in v1. A request that lands in a state where one of these properties matters is, by today's posture, either dependent on backend enforcement (which may or may not be load-bearing) or genuinely unguarded.

A subsequent wave is required to make each property load-bearing. Until that wave merges, do not market, document, or assume the property holds.

### 3.1 Route-level ownership enforcement

Web-route handlers in `/api/verifier/**`, `/api/employer-review/**`, `/api/hiring/**`, `/api/audit/**`, `/api/psv/**`, `/api/employer/applications/**`, `/api/employer/decisions/**`, `/api/credentials/**`, and `/api/applications/**` do NOT today re-derive `resource.tenantId` and compare to JWT `org_id`. Cross-tenant access on these routes is mitigated only insofar as:

- Layer 1 enforces tenant membership on the verifier namespace (Layer 1 covers admission, not resource ownership).
- Backend services (`apps/api/backend`) may enforce ownership themselves; this enforcement is not audited end-to-end and is not the web layer's contract.

W2-PR2B introduces this for the employer-review domain. Other domains follow in W2-PR3 / W2-PR4.

### 3.2 Workflow legitimacy validation at handler level

A POST that reaches a handler with a valid session, valid role, and ownership confirmed is NOT today universally checked against the workflow state machine before the proxy/DB-write occurs. The canonical-path domain enforces some of this; the handler-level coupling (which produces the 409/422 wire and the denied audit row) is not yet a load-bearing contract. W2-PR2B is the first wave to make it load-bearing on a domain.

### 3.3 Replay resistance

`correlationId`-based replay resistance over a 24h window per actor is **defined** in `MUTATION_GATE_SEQUENCE.md` §3.7 but is **NOT enforced** at the web-route level today. A client that retries a mutation with the same body and same correlation ID is not blocked by the web layer in v1. Backend services may have idempotency keys at the persistence layer; that enforcement is inconsistent across domains.

W2-PR2B introduces handler-level replay resistance for the employer-review domain.

### 3.4 Stale ownership invalidation

If a user is removed from an org (or their team_role is downgraded), their existing JWT may continue to authorize requests until the JWT expires. v1 does not introduce a server-side invalidation list, a JWT-to-revocation lookup, or a real-time membership re-check. Clerk's session refresh cycle is the only mechanism for stale-claim invalidation.

This is a known deferred risk per §5.1.

### 3.5 Audit authorization

The contract that every mutation writes exactly one paired audit row in the same Prisma transaction is NOT enforced on the web-route mutating actions in v1. Some backend services write audit rows; the coupling is not auditable end-to-end. There is no v1 guarantee that an action that reached the proxy resulted in either a permit-row or a deny-row.

W2-PR2B introduces this for the employer-review domain.

### 3.6 Invitation ownership authorization

`apps/web/app/api/verifier/invite/**` and the org-invitations flow rely on Layer 1 admission + Layer 2 RBAC. The handler does NOT today verify that the invitation belongs to the inviter's org by re-reading the invitation row's tenant column. Cross-org probing of invitations is mitigated by 404 at Layer 1 for the namespace; resource-row ownership is not a v1 guarantee.

A separate wave will harden invitations after W2-PR2B's pattern is proven on employer-review.

---

## 4. Stable Mutation Rules

These are the rules that today govern any mutation under the verifier API namespace. They are stable in v1 — meaning subsequent waves may **strengthen** them but may not weaken them.

### 4.1 RBAC alone does not authorize mutations

Layer 2 (RBAC) is necessary but not sufficient. A user with `admin` role on Org A who tries to mutate a resource owned by Org B is NOT authorized merely because their role permits the verb. Ownership (Layer 3, currently planned) is the additional gate. Until W2-PR2B lands ownership for a given domain, the v1 mitigation is Layer 1's namespace-level cross-org 404 — but resource-row ownership is not a v1 guarantee outside the verifier namespace.

The rule's v1 wording: **a mutation is authorized only when (Auth ✓) AND (RBAC ✓) AND (ownership-where-defined ✓)**. The "where-defined" caveat is the v1 honest position; v2 removes the caveat by making ownership universal.

### 4.2 Ownership must be server-derived

When ownership is consulted, it is derived ONLY from the JWT-signed `vitalcv.org_id` claim and the server-loaded `resource.tenantId` column. Headers (`x-verifier-org`), body fields (`tenantId`, `orgId`, `org_id`), query parameters (`?tenantId=`), and cookies (other than the Clerk session) MUST be discarded for ownership purposes. This rule is frozen — a future wave that introduces a "tenant override" header or "admin masquerade" parameter is rejected at review by default.

The rule applies wherever ownership is enforced in v1 (Layer 1 namespace check) and binds wherever ownership is enforced in subsequent waves (Layer 3 resource check).

### 4.3 Degraded auth never widens capability

When Clerk degrades, no actor's capability surface widens. The fail-closed branch returns 503; it does NOT fall back to "anonymous read-only" or "demo tenant." Whatever an authenticated actor could do before degradation, they can do nothing while degraded. Whatever an unauthenticated request was denied, it remains denied.

This is the canonical fail-closed contract from `FAIL_CLOSED_MATRIX.md` §1. v1 freezes it as a mutation rule because mutation safety depends on it: a degraded-auth window must never be a mutation window.

---

## 5. Deferred Risks

These risks are **known and explicitly deferred**. v1 does not address them. A subsequent wave is required for each. Listing them here makes the deferral auditable: the platform owner cannot claim "we didn't know" if one of these manifests before the corresponding wave merges.

### 5.1 Stale role/session invalidation

**Risk:** A user removed from Org A whose JWT is still valid retains capability until the JWT expires (typically minutes). A team-role downgrade (e.g., admin → readonly) similarly takes effect only after the next session refresh.

**Why deferred:** Clerk's session refresh cycle bounds the staleness window to minutes. Server-side revocation requires either a Clerk webhook listener with state, a JWT-to-revocation table, or a real-time membership re-check on every request — all of which are larger architectural commitments than v1 scope.

**Wave that addresses it:** TBD; flagged for a "session-revocation" wave after W2-PR3 (audit hardening) provides the audit visibility needed to prove the revocation table is consulted.

### 5.2 Ownership/workflow desynchronization

**Risk:** A resource's `tenantId` is server-persisted at recognition time and must match the JWT-derived `org_id` of every actor mutating it. If a recognition pipeline ever sets the wrong `tenantId` (e.g., due to a misrouted webhook, a manual DB edit, or a bug in the recognition handler), every subsequent ownership comparison silently uses a wrong baseline. Workflow gates (CRS-80, prior-acceptance-exists) compound the failure.

**Why deferred:** v1 trusts the recognition pipeline's `tenantId` write. There is no v1 audit row at recognition time that captures (actor, intended_tenant, persisted_tenant) for forensic comparison.

**Wave that addresses it:** flagged for the recognition-audit-coupling wave (post-W2-PR3). Until then, the mitigation is operational: any production observability that surfaces `EmployerReview.tenantId` drift is treated as a P0 incident.

### 5.3 Replay mutation semantics

**Risk:** A retry storm (network partition, client retry loop, malicious replay of a captured request) can cause duplicate mutation rows, duplicate audit rows, or both, on routes that lack handler-level idempotency. Today, only a subset of backend services have idempotency-key enforcement at the persistence layer.

**Why deferred:** Handler-level `correlationId` enforcement requires both the audit-row coupling (W2-PR2B) and a per-action idempotency anchor (UNIQUE constraint on `(actorId, correlationId, 24h)` on the audit table or equivalent). v1 does not guarantee either.

**Wave that addresses it:** W2-PR2B for the employer-review domain; subsequent waves for other domains. Until then, the mitigation is the canonical-path's existing UNIQUE constraints (e.g., one acceptance per entity) — which prevents duplicate mutation rows but does not prevent duplicate audit rows.

### 5.4 Audit coupling resilience

**Risk:** Even where audit rows are written today (backend services), the coupling between mutation and audit is not universally transactional. A mutation that commits while the paired audit write fails leaves a "ghost mutation" with no forensic record. A mutation that rolls back while a paired audit attempt has already succeeded leaves a "ghost audit" referencing nothing.

**Why deferred:** The constitutional contract (`MUTATION_GATE_SEQUENCE.md` §4 — "atomic mutation+audit semantics") is defined; the load-bearing implementation requires per-domain `prisma.$transaction((tx) => { ... })` wrapping. v1 does not enforce it across all domains.

**Wave that addresses it:** W2-PR2B for the employer-review domain. The pattern then extends to other domains in subsequent waves. Until then, audit-coupling resilience is best-effort.

---

## 6. Merge-Gated Constitutional Artifacts

The following constitutional documents are the load-bearing source of truth for the authorization baseline. They are merge-gated in the sense that a PR which contradicts any of them is, by default, rejected at review. Subsequent waves evolve the baseline by editing these documents under explicit founder approval — never by silently superseding them.

| Artifact | Role |
|---|---|
| `SECURITY_INVARIANTS.md` | Identity, RBAC, audit, route-protection invariants; founder-approval matrix for HIGH_RISK changes |
| `OWNERSHIP_INVARIANTS.md` | Layer-3 ownership invariants; cross-tenant 404 rule; resource-tenancy contract |
| `RESOURCE_OWNERSHIP_DICTIONARY.md` | Per-resource owner/controller/viewer/mutator definitions for the 11 known resource types |
| `ROUTE_OWNERSHIP_MATRIX.md` (current shape: `w2-pr2-route-ownership-matrix.md`) | Per-route classification: PUBLIC_READ / AUTHENTICATED_READ / AUTHENTICATED_MUTATION / PUBLIC_MUTATION; owner-resource mapping; reclassification roadmap |
| `MUTATION_GATE_SEQUENCE.md` | Canonical 6-step mutation algorithm; per-step purpose, failure semantics, allowed outputs, forbidden shortcuts; audit + tenant implications |
| `FAIL_CLOSED_MATRIX.md` | 15 authorization-degradation scenarios; per-scenario expected behavior; verification requirement |

These six docs together specify the v1 baseline. A change to authorization behavior that is not reflected in at least one of these documents is, by definition, a drift — flag it at review and require the doc update before merge.

The lock + scaffolding bundle for W2-PR2B (`w2-pr2b-implementation-lock.md`, `w2-pr2b-scaffolding-plan.md`, `w2-pr2b-mutation-flow.md`, `w2-pr2b-ownership-derivation.md`, `w2-pr2b-audit-coupling.md`) is subordinate to these six docs and reifies them into the per-action implementation contract for the first ownership-enforcement wave.

---

## 7. Versioning and successor baselines

This document is **v1**. It freezes the post-W2-PR1A authorization posture as of `caa01cd9` (the merged W2-PR1A HEAD). A successor baseline (v2) is created when a wave makes Layer 3 (ownership) load-bearing across the verifier and employer-review namespaces — at minimum after W2-PR2B and W2-PR2C (if a `C` wave is required to complete cross-domain ownership coverage).

A successor baseline does NOT delete this document. It is appended (as `AUTHORIZATION_BASELINE_V2.md` etc.) so that historical guarantees and deferrals remain auditable. A v1→v2 transition log lives in the v2 doc's §0 ("what changed since v1").

The version number is incremented only by waves that change a stable guarantee (§1) or remove a non-guarantee (§3). Bug fixes that preserve §1 and do not remove §3 do not bump the version.

---

## 8. Closing principle

Authorization baseline v1 is stable enough for controlled ownership-enforcement evolution.
