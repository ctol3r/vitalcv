# VitalCV Security Invariants

**Version:** 2026-05-07 · **Status:** constitutional · **Authority:** supersedes implementation convenience, speed, and code-shortcut considerations; subordinate only to the founder's explicit override and to U.S. healthcare regulation (HIPAA, 42 CFR §455.106, state credentialing law).

This document defines the immutable security and authorization invariants for VitalCV. Each invariant is enforceable through CI gates, code review, and the merge protocol. They are floors, not ceilings — a PR may strengthen them; a PR may not weaken them without founder approval and a written justification in the PR body.

Where this doc and any other doc conflict on a security matter, **this doc wins**. Where this doc is silent, defer to `VITALCV_OPERATING_DOCTRINE.md` §5 (auditability) + §7 (security & privacy), `CLAUDE.md`, and the most recent code-red verification snapshot.

---

## 1. Identity & Auth Invariants

### 1.1 — Authentication does not imply authorization

A signed-in Clerk session proves the user holds a valid identity. It proves nothing about which resources that identity is allowed to read or mutate. Every ownership-sensitive route must run an authorization check separate from the auth check.

**Implementation reference:** `apps/web/middleware.ts` performs auth + role gating; route handlers under `apps/web/app/api/**` perform per-resource ownership checks. The two layers compose; neither alone is sufficient.

### 1.2 — Identity coherence does not imply ownership

Reading a coherent JWT (signed, not expired, well-formed) tells the system *who* the caller is. It does not tell the system whether the caller owns the resource named in the URL or body. Ownership is **always** derived from server-side state.

### 1.3 — orgId from client input is never ownership proof

A request carrying `?orgId=foo`, `body.orgId`, `x-verifier-org: foo`, `cookie.orgId`, or any client-controlled field is naming a desired resource. It is not proving access to it. Ownership of org-scoped resources is derived from the JWT's `vitalcv.org_id` claim (Clerk-signed) cross-checked against the resource's persisted owner.

**Implementation reference:** `apps/web/lib/auth/orgInvitations.ts` `checkVerifierPermission(...)` reads `requestingOrgId` from the JWT claim only; the `resourceOrgId` arrives via the URL or header but is **compared** to the JWT-derived value, not trusted.

### 1.4 — Middleware validates identity coherence only

`apps/web/middleware.ts` answers two questions: "is there a session?" and "does the session's role match the requested route prefix?" It must not be expected to answer "does this user own the resource?" Cross-resource authorization belongs in the route handler.

### 1.5 — Route handlers validate ownership semantics

Every route handler that reads or mutates a row keyed by clinician / org / case / receipt must perform an explicit ownership check before touching the row. The check must consult server-side state (DB row owner, JWT claim, or both). Comments like `// trust caller` are defects.

### 1.6 — Service layers preserve security invariants

A service module called from a route handler must not silently widen access. If a service is given a `clinicianId`, it must not return data for a different clinician even if a parameter could be interpreted that way. Service-layer cross-tenant reads are **prohibited** (see §2).

---

## 2. Tenant Boundary Invariants

### 2.1 — No cross-tenant reads

A request authenticated as org A may not retrieve resources owned by org B. Period. Caches, denormalized indices, search results, audit replays, and dossier snapshots all inherit this rule. A read that would emit a row owned by another tenant must return `404 Not Found` (see §5.6) and the row must be omitted from the response payload entirely.

### 2.2 — No cross-tenant mutations

A request authenticated as org A may not write, update, or delete resources owned by org B. This includes "soft" mutations (e.g., bumping a `lastViewedAt`, appending to a comments array, attaching a note to another tenant's PSV receipt). The forbidden response is `404 Not Found` (do not surface a 403 — see §5.6).

### 2.3 — Tenant ownership derived server-side

The `tenant_id` / `org_id` of every persisted row is set at write time from a server-side source (JWT claim verified by Clerk, or derived from a resource's parent ownership). Client-supplied `tenant_id` fields are validated against the server-side source before persist. Mismatch fails closed.

**Implementation reference:** `apps/api/backend/prisma/schema.prisma` carries CHECK constraints on truth-contract fields (per the Code Red verification doc). The same defense-in-depth must hold for tenant fields where row ownership is multi-tenant scoped.

### 2.4 — orgId never trusted from client headers alone

The `x-verifier-org` header (used by `apps/web/lib/auth/orgInvitations.ts`) names the resource being accessed. It is **not** proof of ownership. The middleware compares it (timing-safe) against the JWT claim before the request reaches the handler. A handler that reads `x-verifier-org` and uses it as the persistence key without re-checking against the JWT claim is a defect.

### 2.5 — All verifier actions are org-scoped

Every API route under `apps/web/app/api/verifier/**` operates within a single org boundary. There is no global verifier action. Cross-org verifier flows (cross-tenant PSV reuse, federated trust, etc.) require an explicit `crossTenantConsentReceiptId` artifact (per W6 cross-tenant work) and traverse a separate gated flow — never the standard verifier route.

### 2.6 — All resource access must validate ownership

Before returning or mutating a row, the handler must answer "is the requesting tenant the owner of this row?" If the answer is unknown, the handler returns `404` and aborts. There is no "anonymous read" path for org-scoped resources. There is no "system bypass" path for cross-tenant reads.

---

## 3. RBAC Invariants

### 3.1 — Readonly cannot mutate

A user with `team_role: 'readonly'` (per `apps/web/lib/auth/roles.ts` `VERIFIER_TEAM_ROLES`) may not invoke any HTTP method in `{POST, PUT, PATCH, DELETE}` on `/api/verifier/**`. The middleware enforces this and returns `403` with reason `readonly_blocks_mutation`. A route handler that bypasses the middleware-level check and emits a mutation for a readonly user is a defect.

**Implementation reference:** `apps/web/lib/auth/orgInvitations.ts` `checkVerifierPermission(...)` Gate 3.

### 3.2 — Readonly does not imply audit visibility

A user with read-only authorization on a resource is not automatically authorized to view that resource's audit trail. Audit visibility is a separate scope. The audit endpoint must perform its own role check before returning rows. (Default policy: only `admin` and `owner` roles see the full audit trail; `readonly` and `member` see redacted summaries.)

### 3.3 — Role inheritance must be explicit

A user holding role A does not implicitly hold the privileges of role B unless the inheritance is declared in `apps/web/lib/auth/roles.ts` (or backend equivalent) and traced in code review. Implicit "owner can do anything" assumptions are forbidden. Every privilege either belongs to a role or it doesn't.

### 3.4 — Middleware-only RBAC is insufficient

`apps/web/middleware.ts` performs role gating by URL prefix. This is necessary but not sufficient: it cannot distinguish between two resources at the same URL prefix (e.g., two clinician records under `/api/clinician/`). Route-level authorization (per-resource ownership) is mandatory for any route that returns or mutates resource-keyed data.

### 3.5 — Route-level authorization is mandatory for ownership-sensitive resources

Every API route handler whose path contains a dynamic segment (e.g., `[id]`, `[npi]`, `[caseId]`, `[receiptId]`, `[entityId]`) must perform an ownership / scope check before touching the resource. The check must:
1. Read the requesting actor's tenant / org / clinician id from the JWT (server-side).
2. Read the resource's owner from persisted state.
3. Compare them with timing-safe equality where relevant (see §6.2).
4. Respond `404 Not Found` on mismatch (see §5.6) — not 403.

A handler that lacks an ownership check on a dynamic-segment route is a defect, regardless of the URL's middleware-level role gate.

---

## 4. Audit Invariants

### 4.1 — All mutating verifier actions write AuditEvents

Every API route handler that mutates a verifier-scoped row must, in the same transaction as the mutation, write an `AuditEvent` row carrying: `actorId`, `action`, `subjectId`, `decidedAt`, `tenantId`, `payloadHash`, `correlationId`, `replaySafe: boolean`. A mutation that does not write an audit event is a defect.

**Implementation reference:** `POST /api/employer-review/:entityId/accept` — atomic acceptance + audit event, per `MASTER_PROMPT.md` §7.

### 4.2 — Audit trails must preserve actor identity

Every audit row carries the resolved actor identity (`actorId` from JWT-validated session) and the actor's role at decision time (`reviewerRole`). `actorId` is **never** an inferred or default value (`'system'`, `'unknown'`, empty string). A row with an empty or default `actorId` is a defect; the operation that would have produced it must abort and respond `500` with internal logging.

### 4.3 — Audit events are append-only

There is no `UPDATE` path on an `AuditEvent` row. There is no `DELETE` path on an `AuditEvent` row. Corrections happen by appending a new row referencing the original via `correctsEventId`. Schema-level enforcement: no migration may add an `UPDATE` or `DELETE` capability to the audit table without founder review (`FOUNDER_REQUIRED` per `openclaw-risk-classification.md`).

### 4.4 — Audit visibility is explicitly scoped

Reading audit rows for a tenant is itself an audited operation. Cross-tenant audit visibility requires explicit consent / role + is itself recorded. Bulk audit export endpoints carry rate limits and per-actor caps. There is no anonymous audit read path.

### 4.5 — Audit mutation routes are never public

No `apps/web/app/api/audit/**` route may appear in `apps/web/lib/auth/roles.ts` `PUBLIC_ROUTE_PATTERNS`. Audit endpoints require auth + role + ownership checks and should fail closed on any check that returns indeterminate state (see §5.4).

---

## 5. Route Protection Invariants

### 5.1 — Public routes must be explicitly enumerated

A route is public **only if** it appears in `apps/web/lib/auth/roles.ts` `PUBLIC_ROUTE_PATTERNS`. The default for an un-listed route is auth-required. Adding a route to `PUBLIC_ROUTE_PATTERNS` is a security-sensitive change and requires an explicit justification in the PR description.

### 5.2 — No wildcard /api/** public exposure

The current `PUBLIC_ROUTE_PATTERNS` includes `/^\/api(\/.*)?$/` (per `roles.ts` line 111) which exempts ALL API routes from middleware role checks. **This is a delegation pattern**: API routes are expected to perform their own auth + ownership checks. The pattern is acceptable only when every API route handler honors §5.4. A route handler that does not run an auth check is a defect, even if the public-pattern wildcard makes it reachable. Audit gates: every new API route must be reviewed for explicit auth + ownership logic before merge.

### 5.3 — Security-sensitive routes fail closed

A handler whose response would change based on auth state must:
1. Resolve auth state explicitly.
2. On any error or indeterminate state (Clerk timeout, missing claim, malformed JWT, env-var absent), emit the most-restrictive response (typically `401` or `404` per §5.6).
3. Never default to "open" / "public" / "unauthenticated user gets the same response as authenticated" unless the route is explicitly enumerated as public per §5.1.

### 5.4 — Unknown auth states fail closed

`session?.userId === undefined` is not "anonymous user is allowed" — it is "auth state is unknown." The handler must respond with the most-restrictive response. The same applies to: `claims === undefined`, `team_role === null`, `org_id === null`. Each leaves the cap engaged (or the operation refused), per `apps/web/lib/auth/orgInvitations.ts` Gate 1 (`no_org_context`).

### 5.5 — Forbidden responses must not leak tenant existence

Cross-tenant access attempts must return `404 Not Found`, not `403 Forbidden`. A `403` confirms the resource exists in another tenant — that is itself information leakage. The current `checkVerifierPermission(...)` enforces this at Gate 2 (`cross_org` → `statusCode: 404`). Same rule applies to: cross-clinician reads, cross-employer reads, cross-issuer reads.

### 5.6 — 404 semantics for the privacy-sensitive case

| Scenario | Response | Why |
|---|---|---|
| Anonymous user hits a private route | `401` (or redirect to `/sign-in`) | We need them to authenticate; revealing the route exists is fine |
| Authenticated user lacks the role | `403` (or role-mismatch redirect) | We're telling them "you're signed in, but this surface is for a different role" |
| Authenticated user is in the wrong tenant | `404` | Revealing the resource exists is itself a leak |
| Authenticated readonly user attempts mutation | `403 readonly_blocks_mutation` | Role-policy violation, not enumeration |
| Auth state indeterminate | `401` or `404` (preferred most-restrictive of the two) | Fail closed |

---

## 6. Security Semantics

### 6.1 — 403 preferred over 401 where enumeration resistance matters

Per §5.6, the response code carries information. For routes whose existence must not be confirmed to the wrong tenant, prefer `404`. For routes whose existence is fine to confirm but the action is denied (e.g., readonly mutation), `403` is correct.

### 6.2 — Authorization checks must be timing-safe where relevant

String compares between secrets (org IDs, tokens, signatures) must use a constant-time path. `apps/web/lib/auth/orgInvitations.ts` `timingSafeEqualStrings(...)` (Edge-runtime safe via `TextEncoder` byte-XOR) is the canonical helper for org compares. Bearer-token compares (`apps/web/app/api/internal/source-health/_auth.ts:35-45`) use Node's `crypto.timingSafeEqual` with defensive length-mismatch handling. A new auth-check that string-compares secrets via `===` and short-circuits on length is a defect.

### 6.3 — Security helper ordering is load-bearing

The five gates of `checkVerifierPermission(...)` fire in order:
1. No org context (JWT claim missing) → `403 no_org_context`
2. Cross-org access (timing-safe compare fails) → `404 cross_org`
3. Readonly + mutating method → `403 readonly_blocks_mutation`
4. (Future gates — preserve order)
5. Permitted

Reordering them is a defect — Gate 2 must precede Gate 3 because a readonly user attempting cross-org mutation must surface `404` (no leak), not `403` (would confirm the resource exists). Test files lock this order.

### 6.4 — Auth helper primitives must remain deterministic

`parseTeamRole(...)`, `timingSafeEqualStrings(...)`, `checkVerifierPermission(...)` and equivalents are pure functions. They do not read env vars, fetch from network, or consult mutable global state. Same inputs → same outputs. A change that adds a fetch / DB call to one of these helpers is a defect — it must be a separate service layer.

---

## 7. Operational Invariants

### 7.1 — No auth weakening without founder review

A PR that:
- Removes a route from `PROTECTED_ROUTES`
- Adds a route to `PUBLIC_ROUTE_PATTERNS`
- Removes or relaxes any of the five `checkVerifierPermission(...)` gates
- Reorders the gates
- Modifies `apps/web/middleware.ts` auth flow
- Modifies any RBAC role definition in `apps/web/lib/auth/roles.ts`

is **FOUNDER_REQUIRED** per `openclaw-risk-classification.md`. Codex SAFE alone is insufficient; the founder must approve in the PR thread before merge.

### 7.2 — No RBAC schema changes without explicit review

Adding a new role to `VERIFIER_TEAM_ROLES` or `UserRole`, changing the role-to-route mapping in `PROTECTED_ROUTES`, or modifying the role inheritance graph requires explicit review. A new role must come with: a definition (what it can do), a non-definition (what it cannot do), and tests for both.

### 7.3 — No merge without Codex SAFE

Per `VITALCV_OPERATING_DOCTRINE.md` §6.1, every PR merged to `main` must produce a literal `Codex verdict: SAFE` line in the merge transcript. PRs touching auth / RBAC / audit paths additionally require:
- Implementation audit
- Diff audit (verify no file outside the stated scope was touched)
- Security audit (verify the gates listed in this document are not weakened)

### 7.4 — Security invariants supersede implementation convenience

When a feature requirement and a security invariant in this document conflict, the invariant wins. The feature is redesigned, deferred, or split. There is no "we'll add the auth check in the next PR" — a route that mutates without auth is not shippable, regardless of feature pressure.

---

## Doctrine compliance — security checklist (per-PR)

A reviewer applying this document at merge time checks:

- [ ] No new public route added without an explicit justification (§5.1)
- [ ] Every new dynamic-segment route has an explicit ownership check (§3.5)
- [ ] Every new mutating endpoint writes an `AuditEvent` (§4.1)
- [ ] No `actorId` defaulted to `'system'` / empty / `'unknown'` (§4.2)
- [ ] No new string-compare on a secret without timing-safe path (§6.2)
- [ ] No reordering of the five `checkVerifierPermission(...)` gates (§6.3)
- [ ] Cross-org access returns `404`, not `403` (§5.5)
- [ ] Readonly users blocked from mutations at the middleware AND any handler that mutates (§3.1, §3.4)
- [ ] No role-inheritance assumption introduced without explicit declaration (§3.3)
- [ ] Founder review obtained for any change in §7.1 / §7.2 (`FOUNDER_REQUIRED`)
- [ ] Codex SAFE verdict in transcript (§7.3)

A PR that fails any item above is **not mergeable**, regardless of feature value or test coverage.

---

VitalCV trust depends on preserving tenant boundaries, ownership semantics, and audit integrity under all operational conditions.
