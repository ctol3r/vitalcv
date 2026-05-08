# VitalCV Ownership Invariants

**Version:** 2026-05-07 · **Status:** constitutional · **Authority:** subordinate to `VITALCV_OPERATING_DOCTRINE.md` and `SECURITY_INVARIANTS.md`; defines Layer 3 of the canonical model in `AUTHORIZATION_LAYERS.md`. Supersedes implementation-convenience appeals to "the middleware will catch it."

This document defines the immutable ownership-authorization invariants for VitalCV. It governs resource ownership, mutation legitimacy, tenant-resource relationships, verifier-resource authorization, and workflow mutation safety.

Ownership is **the layer that cannot be enforced in middleware** because middleware has no DB. It is enforced exclusively at the route handler. The invariants below are floors, not ceilings — a PR may strengthen them; a PR may not weaken them without founder approval.

Where this doc and any other doc conflict on an ownership matter, **this doc wins**. Where this doc is silent, defer to `VITALCV_OPERATING_DOCTRINE.md` §5 (auditability) + §7 (security & privacy), `SECURITY_INVARIANTS.md` §1.5 (route handlers validate ownership), and `AUTHORIZATION_LAYERS.md` §3 (Ownership Authorization layer).

---

## The four distinct layers (read this first)

These are routinely conflated. Every reviewer and implementer must hold them apart:

| Layer | Question answered | Where decided | Failure mode |
|---|---|---|---|
| **Authentication** | Who is this caller? | Clerk (`auth()`); resolved at middleware | 401 / sign-in redirect |
| **RBAC** | What role / org claims does this caller hold? | `apps/web/lib/auth/orgInvitations.ts` checked in middleware Step 0 | 403 (`no_org_context` / `readonly_blocks_mutation`) or 404 (`cross_org`) |
| **Ownership authorization** | Does this caller's tenant own the resource named by the URL? | **Route handler** with DB read | 404 (cross-tenant) — never 403 |
| **Workflow authorization** | Is the requested state transition legitimate given the resource's current state? | Domain modules (`apps/web/lib/issuer-verification/`, `packages/domain-common/`) called from the route handler | 409 / 422 / 403 depending on the gate that refused |

Authentication ≠ RBAC ≠ ownership ≠ workflow legitimacy. Each is necessary; none is sufficient. A request that mutates a resource passes through all four.

---

## 1. Ownership Principles

### 1.1 — Authentication does not imply ownership

A signed-in Clerk session proves the user holds a valid identity. It proves nothing about which resources that identity owns. A handler that returns resource data on the basis of "the user is signed in" is a defect. Ownership is **always** derived from server-side state (DB row owner, JWT-derived org_id, or both).

### 1.2 — RBAC does not imply resource control

A user holding `team_role: 'admin'` for Org A can do admin actions on Org A's resources. They cannot do anything on Org B's resources, regardless of role. Role membership in Org A is not a proxy for ownership of any resource — only Org A's resources. The route handler must check the resource's actual `tenantId` against the JWT-derived `requestingOrgId`; the role alone is insufficient.

### 1.3 — All mutations require ownership validation

Every API route handler that mutates persistent state must, before the mutation, perform an explicit ownership check. The check must:
1. Read the requesting actor's tenant / org / clinician id from the JWT (server-side, never from headers).
2. Read the resource's owner from persisted state (DB row, or service that wraps the DB).
3. Compare. Mismatch fails closed (returns 404 — see §6.2).

A mutating handler without an ownership check is a defect, regardless of middleware passing. Per `SECURITY_INVARIANTS.md` §1.5: "Comments like `// trust caller` are defects."

### 1.4 — Ownership must be derived server-side

The owner of a resource is the value persisted in the DB at write time. It is **not** the `tenantId` that arrived in the request body, query string, header, or any other client-controlled channel. A route handler that uses a client-supplied tenant_id without comparing it to the persisted owner is a defect.

The `x-verifier-org` header (per `SECURITY_INVARIANTS.md` §2.4) names the org the caller wants to act on behalf of. It is validated by middleware against the JWT (identity coherence — Layer 1). It is **never** ownership proof.

### 1.5 — Resource ownership must never rely on client headers alone

Headers are client-controlled. `x-verifier-org`, `x-tenant-id`, `x-clerk-org`, any custom header, any cookie — none of them establish ownership. Ownership is established by:
- The Clerk-signed JWT claim (`sessionClaims.vitalcv.org_id`), which is tamper-proof, AND
- The persisted resource's `tenantId` field, which is server-set at write time.

A route handler that reads a header and uses it as the persistence key is a defect, even if the middleware has already validated the header against the JWT. The handler must use the JWT-derived value.

---

## 2. Tenant Boundary Invariants

### 2.1 — Resources belong to explicit tenant scopes

Every persisted row that participates in a multi-tenant flow MUST carry a `tenantId` (or `org_id`) field. The field is required (non-null). The field is set at write time from a server-side source (the JWT claim, or derived from a parent resource's owner). Adding a multi-tenant resource without a `tenantId` field is a defect; surfacing it without filtering by `tenantId` is a worse defect.

### 2.2 — Cross-tenant mutation is forbidden

A request authenticated as Org A may not insert, update, or delete a row owned by Org B. This includes "soft" mutations (e.g., bumping `lastViewedAt`, appending to `comments`, attaching a note to another tenant's PSV receipt). The forbidden response is **404 Not Found** (per `SECURITY_INVARIANTS.md` §5.5; see also §6.2 below).

Mutating routes must scope every write by `tenantId = requestingOrgId`. A bare `WHERE id = $resourceId` clause without the tenant filter is a defect.

### 2.3 — Cross-tenant reads require explicit authorization

The default is no cross-tenant read. A read that crosses a tenant boundary requires an explicit consent artifact (e.g., the `crossTenantConsentReceiptId` introduced for cross-tenant PSV reuse) AND a documented allow-listed flow. There is no "global admin" role that bypasses tenant boundaries; an `ADMIN` `UserRoleType` may operate across tenants only on routes explicitly designed for cross-tenant administration, with audit-event writes per row.

### 2.4 — Tenant derivation is server authoritative

The tenant of a resource is whatever the server says it is, period. The DB row is the authority. If a request's claimed tenant disagrees with the row's tenant, the row's tenant wins and the request is rejected — never the other way around. There is no path where the client-asserted tenant rewrites the persisted owner.

---

## 3. Mutation Authorization Invariants

### 3.1 — Readonly cannot mutate

A user with `team_role: 'readonly'` (per `apps/web/lib/auth/roles.ts` `VERIFIER_TEAM_ROLES`) cannot invoke any mutating HTTP method on `/api/verifier/**`. This is enforced at the middleware layer (Gate 3 of `checkVerifierPermission`). The route handler MUST also enforce it on any logically-mutating route that uses `GET` (rare, but possible — e.g., a side-effecting export). Middleware-only readonly enforcement is insufficient when the route uses non-mutating HTTP methods semantically.

### 3.2 — Mutation authorization requires ownership validation

Authorization to mutate a resource requires ALL of:
- Authenticated session (Layer 1).
- Permitted role (Layer 2 — non-readonly, role grants the action).
- **Ownership** of the resource being mutated (Layer 3 — this doc).
- Workflow legitimacy of the requested transition (Layer 4).

Skipping Layer 3 because Layer 1+2 passed is a defect. A `member` role user from Org A still cannot mutate Org B's resource, even though their role would permit the action on their own org's resources.

### 3.3 — Workflow transitions require authorization AND ownership

The five-gate flow in `applyPolicyReviewDecision` (`apps/web/lib/issuer-verification/policyReview.ts`) enforces workflow legitimacy: a `ReceiptCandidate` in `review_required` state cannot be promoted to `PSVReceiptCandidate`; only `ready_for_policy_review` permits acceptance. **Workflow legitimacy is not ownership.** A correct workflow transition on an unowned resource is still forbidden.

The route handler must verify ownership **before** invoking the workflow function. If the user does not own the resource, the workflow check never runs — the request is rejected at Layer 3 with 404.

### 3.4 — All mutating actions must be attributable

Every mutating route must, in the same transaction as the mutation, write an `AuditEvent` row carrying:
- `actorId` — resolved from the JWT (`session.userId`); never defaulted to `'system'`, `'unknown'`, or empty.
- `tenantId` — the JWT-derived `requestingOrgId`.
- `action` — a structured action name (e.g., `'employer_review.accept'`, `'verifier.invitation.created'`).
- `subjectId` — the resource being mutated.
- `decidedAt` — server timestamp.
- `payloadHash` — SHA-256 of the request payload (with PII redaction per `SECURITY_INVARIANTS.md` §7.3).
- `correlationId` — request-scoped UUID for replay.
- `replaySafe: boolean` — whether the event is safe to replay in audit reconstruction.

A mutation that completes without an `AuditEvent` write is a defect, regardless of any other check passing. Per `SECURITY_INVARIANTS.md` §4.1, audit writes are atomic with the mutation — both succeed or neither does.

---

## 4. Employer Review Invariants

The employer-review surface is the highest-blast-radius mutation in VitalCV today. `POST /api/employer-review/[entityId]/accept` (and its sibling actions: `confirm-start`, `request-refresh`, `route-to-review`) emits the `EmployerAcceptance` row that gates the canonical path's `Start` step. A defect here means an attacker accepts a clinician on behalf of an org they don't represent.

### 4.1 — Review acceptance requires ownership validation

Before mutating, the handler must verify:
- `requestingOrgId` (from JWT) is non-null.
- The persisted `EmployerReview` (or equivalent) row keyed by `entityId` has `tenantId === requestingOrgId`.
- If the row is missing OR the tenant mismatches: return **404 Not Found** with empty body (no leak of whether the entity exists in another tenant).

A handler that accepts on the basis of "the request includes a valid JWT" alone is a defect.

### 4.2 — Verifier org must match review ownership

The verifier org claimed via `x-verifier-org` (validated by middleware Layer 1) and the verifier org persisted on the review row (read by the route handler Layer 3) MUST match. This is a two-layer check:
- Layer 1 ensures the JWT's org_id matches the header.
- Layer 3 ensures the resource's persisted tenant matches the JWT's org_id.

The two checks compose. Layer 1 alone is insufficient because the resource could belong to a third org. Layer 3 alone is insufficient because the JWT could be replayed; Layer 1 catches that.

### 4.3 — Acceptance actions must be auditable

Per §3.4, every accept / confirm-start / request-refresh / route-to-review must write an `AuditEvent` in the same transaction. The audit row's `actorId` is the human verifier who initiated; never a service account; never inferred. Per `MASTER_PROMPT.md` §7: the acceptance is **atomic** with the audit write.

A user reading `/api/audit/events?subjectId=<entityId>` (with appropriate `ADMIN` role per `SECURITY_INVARIANTS.md` §4.5) must see exactly one row per acceptance attempt — including the failed attempts (those with permission denied at any layer). Silent failures break audit reconstruction.

### 4.4 — Acceptance routes fail closed

Per `FAIL_CLOSED_MATRIX.md`, any uncertainty in the authorization stack on a mutating employer-review route MUST collapse to a refusal. Specifically:
- Auth resolution failure → 503 (`clerk_unavailable`) or 500 (uncaught throw).
- Missing JWT claim → 403 (`no_org_context`).
- Cross-tenant access → 404 (`cross_org` or "resource not found" — same wire response).
- Workflow gate refusal → 409 / 422 with structured error.

There is **no** "let it through and the route handler will figure it out" path. The refusal is the default; permission is the exception.

---

## 5. Invitation Ownership Invariants

### 5.1 — Invitations belong to the issuing tenant

A `VerifierInvitation` row carries `tenantId = issuingOrgId`. Any read or mutation by a non-owning tenant is rejected with 404. The invitation table cannot be queried without a `tenantId` filter except by an `ADMIN` `UserRoleType` on a documented cross-tenant administrative route.

### 5.2 — Invitation acceptance requires validation

When an invited user accepts an invitation:
- The invitation code MUST be valid (not expired, not revoked, not already accepted).
- The accepting Clerk session establishes the new member's identity (Layer 1).
- The invitation's `tenantId` is the org the new member joins — this comes from the persisted invitation row, **never** from a request parameter.
- The new member's role is the role persisted on the invitation row, **never** elevated by the accept request.
- The acceptance writes an `AuditEvent` row with `actorId = sessionUserId`, `tenantId = invitation.tenantId`, `action = 'verifier.invitation.accepted'`, `subjectId = invitation.id`.

An accept request that proposes a different `tenantId` or role than the invitation persists is rejected. The persisted invitation is authoritative.

### 5.3 — Invitation mutation requires ownership

Creating, revoking, resending, or modifying an invitation requires:
- Authenticated session (Layer 1).
- A non-`readonly` role in the issuing tenant (Layer 2).
- The handler verifies the issuing-tenant claim matches the requesting org_id (Layer 3) AND that the actor's role permits the specific mutation (e.g., `'admin'` and `'owner'` may invite; `'member'` may not — Layer 4).

A `member` from Org A cannot revoke Org A's invitations (workflow). A member from Org A cannot read Org B's invitations (ownership). Both checks fire.

---

## 6. Auditability

### 6.1 — Ownership authorization decisions must be traceable

Every ownership refusal at the route handler MUST log a structured observability event (NOT a console.log; a structured logger emit) carrying:
- `actorId` from the JWT.
- `attempted_subject_id` — the resource the user tried to access.
- `attempted_tenant_id` (claimed) vs `resolved_tenant_id` (from the row).
- `outcome: 'cross_tenant' | 'role_blocks' | 'workflow_blocks' | 'no_org_context' | 'fail_closed'`.

This trace allows operators to distinguish:
- Honest misconfigurations (a verifier whose JWT claim is stale) from
- Probing attempts (a verifier systematically requesting other orgs' resources).

The trace is internal observability. It is NOT echoed to the response; the response remains enumeration-resistant per §6.2.

### 6.2 — Mutation denials should preserve enumeration resistance

When a request is denied due to ownership failure, the response MUST be **404 Not Found** — never 403 Forbidden. A 403 confirms the resource exists in another tenant; that is itself information leakage. The 404 wire-encoding is identical to the response for "resource never existed at all," yielding maximum enumeration resistance.

The status-code matrix at the route-handler layer:

| Scenario | Wire response |
|---|---|
| Resource does not exist anywhere | 404 |
| Resource exists in caller's tenant; caller's role permits | 200/201 (success) |
| Resource exists in caller's tenant; caller's role denies (e.g., readonly POST) | 403 (`readonly_blocks_mutation`) |
| Resource exists in another tenant | **404** (NOT 403) |
| Resource exists; workflow gate refuses | 409 / 422 with structured error |
| Resource exists; ownership opaque (e.g., DB read fails) | 503 (`fail_closed`) |
| Auth missing entirely | 401 / sign-in redirect (UI) or 403 (API) |

Mixing 403 and 404 inadvertently is the most common ownership-leak defect. Lock the matrix.

### 6.3 — Ownership failures must fail closed

When the route handler cannot determine ownership for any reason (DB read fails, tenant field is null on the row, parser error on the URL parameter), the response MUST be the most-restrictive honest code per `FAIL_CLOSED_MATRIX.md`:

- DB read fails → 503 with `x-rbac-fail-closed: ownership_unresolvable` header.
- Row exists but `tenantId` is null → 500 with internal alert (this is a data integrity defect — the row should never have been written without a tenant).
- Row exists, `tenantId` is set, mismatch with JWT → 404.
- URL parameter parse error → 400 with `x-rbac-fail-closed: malformed_resource_id`.

There is **no** path where ownership uncertainty resolves to permission. The default is refusal.

---

## Doctrine compliance — ownership checklist (per-PR)

A reviewer applying this document at merge time checks:

- [ ] No new dynamic-segment route (`[id]`, `[npi]`, `[entityId]`, `[caseId]`, `[receiptId]`, etc.) without an explicit ownership check (§1.3, §3.2)
- [ ] No new mutation without an `AuditEvent` write in the same transaction (§3.4)
- [ ] No client-supplied `tenantId` / `orgId` used as a persistence key (§1.4, §1.5)
- [ ] Cross-tenant ownership failure returns **404**, not 403 (§6.2)
- [ ] Ownership uncertainty fails closed (§6.3)
- [ ] No `actorId` defaulted to `'system'` / `''` / `'unknown'` (§3.4)
- [ ] Workflow gate fires AFTER ownership check (§3.3)
- [ ] No reorder that places workflow gate before ownership check
- [ ] `ADMIN` cross-tenant capability is route-by-route opt-in, never blanket
- [ ] Founder review obtained for any new cross-tenant administrative route

A PR that fails any item above is **not mergeable**, regardless of feature value or test coverage.

---

> Identity establishes who is acting.
> Ownership establishes what they may control.
