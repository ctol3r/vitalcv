# VitalCV Mutation Gate Sequence

**Version:** 2026-05-08 · **Status:** constitutional · **Authority:** subordinate to `VITALCV_OPERATING_DOCTRINE.md`, `SECURITY_INVARIANTS.md`, `OWNERSHIP_INVARIANTS.md`, `AUTHORIZATION_LAYERS.md`, and `RESOURCE_OWNERSHIP_DICTIONARY.md`. Supersedes implementation-convenience appeals to "we'll add the audit row in a follow-up" or "the route handler doesn't need to re-check what middleware already checked."

This document defines the **canonical mutation-authorization algorithm** for VitalCV. Every state-changing operation in the codebase — every API route handler that writes a row, updates a row, deletes a row, or emits a side effect — runs the same six-step sequence. The order is immutable. The sequence is the contract.

**Skipping any step is a defect.** Reordering the steps is a defect. Implementing the sequence in a different way (e.g., outside a transaction, or by trusting client-supplied identity) is a defect.

---

## The sequence (immutable, six steps)

```
1. AUTHENTICATE                             — who is acting?
2. RBAC VALIDATE                            — what role do they hold?
3. DERIVE OWNERSHIP SERVER-SIDE             — who owns the resource?
4. VALIDATE OWNERSHIP                       — does the actor own it?
5. VALIDATE WORKFLOW LEGITIMACY             — is the transition allowed?
6. WRITE MUTATION + AUDIT ATOMICALLY        — commit, atomically, with attribution
```

Each step has its own failure semantics. Failures terminate the request immediately at the most-restrictive honest response. There is no "skip to the next step" path; there is no "partial success." Either every step passes and the mutation commits with an `AuditEvent`, or the request is rejected with a structured response and (where appropriate) a denied-attempt audit row.

---

## Step 1 — AUTHENTICATE

### Purpose

Establish **who is acting**. Resolve the Clerk session, extract `userId`. The actor identity is the basis for every downstream check.

### Failure semantics

- No Clerk session → **401 Unauthorized** for browser flows (or sign-in redirect); **403 Forbidden** for API flows where `/api/*` is in `PUBLIC_ROUTE_PATTERNS` (sign-in redirect would be inappropriate).
- Clerk session resolution throws → **500** if uncaught, OR **503** if the handler explicitly catches and emits `x-rbac-fail-closed: clerk_unavailable`.
- Clerk JWT signature invalid → resolved by Clerk to `userId: null`; treated identically to "no session."

### Allowed outputs

- Continue to step 2 with `session.userId` populated and non-empty.

### Forbidden shortcuts

- **Inferring identity from a header** (e.g., `x-user-id`) is forbidden. The Clerk JWT is the only authoritative identity source.
- **Defaulting to a "service account" identity** when a session is absent is forbidden. The handler must refuse, not synthesize.
- **Trusting `userId` from the request body** is forbidden.

### Audit implications

- Failures at this step typically write **no** audit row (caller has no `actorId` to attribute).
- Exception: cron / scheduled job paths with `CRON_SECRET` may emit a system-attributed audit row, but only on routes explicitly designed for that path.

### Tenant-boundary implications

- None at this step. Authentication establishes identity, not tenant.
- Per `OWNERSHIP_INVARIANTS.md` §1.1: **authentication does not imply ownership**.

---

## Step 2 — RBAC VALIDATE

### Purpose

Establish **what role and tenant the actor holds**. Read `team_role` and `org_id` from the JWT claim through `extractVerifierClaims(...)` (W2-PR1A). Verify the requested HTTP method is permitted for the role.

### Failure semantics

- JWT claim malformed (non-object, missing keys) → **403 `no_org_context`**. Per `extractVerifierClaims` total semantics — never throws.
- `team_role` missing or unknown → **403 `no_org_context`**.
- `team_role === 'readonly'` and HTTP method is in `{POST, PUT, PATCH, DELETE}` → **403 `readonly_blocks_mutation`** (per `SECURITY_INVARIANTS.md` §3.1).
- Cross-org claim mismatch (`requestingOrgId` ≠ `x-verifier-org` for verifier routes) → **404 `cross_org`** (handled by middleware Layer 1; not the route handler's responsibility for `/api/verifier/*`, but mandatory at handler level for `/api/employer-review/*` and any non-verifier-namespace mutating route).

### Allowed outputs

- Continue to step 3 with `requestingTenantId` (the JWT-derived org) and `teamRole` populated.

### Forbidden shortcuts

- **Reading the role from a header** (e.g., `x-team-role`) is forbidden.
- **Reading the role from the request body** is forbidden.
- **Defaulting to a "permissive" role** when the claim is missing is forbidden — the default is `null`, which fires Gate 1 and refuses the request.
- **Type-asserting the JWT claim** (`as Record<string, unknown>`) is forbidden — use `extractVerifierClaims` runtime validation only.

### Audit implications

- Denials at this step **write a denied-attempt audit row** with `actorId = session.userId`, `tenantId = requestingTenantId` (best-effort), `outcome: 'denied'`, `action: '<intended_action>.<reason>'`. Per `OWNERSHIP_INVARIANTS.md` §6.1.

### Tenant-boundary implications

- The JWT-derived `requestingTenantId` is the **only** trusted tenant identity for the rest of the sequence.
- Headers (`x-verifier-org`), body fields (`tenantId`), and query parameters carry NO weight beyond the middleware's identity-coherence check (Layer 1).

---

## Step 3 — DERIVE OWNERSHIP SERVER-SIDE

### Purpose

Establish **who owns the resource named by the URL parameter**. Load the resource from the database (via Prisma). The resource's persisted `tenantId` (or `subjectId` for subject-scoped resources) is the authoritative owner.

### Failure semantics

- DB read fails (network, timeout, parse error) → **503 `ownership_unresolvable`** with header `x-rbac-fail-closed: ownership_unresolvable`.
- Resource row missing → **404** (no row matches the URL parameter).
- Resource row's `tenantId` is null or empty string → **500** with internal alert (data-integrity defect; the row should never have been written without a tenant).

### Allowed outputs

- Continue to step 4 with `resource` populated AND `resource.tenantId` (or `resource.subjectId`) verified to be a non-empty string.

### Forbidden shortcuts

- **Trusting the URL parameter as the tenant identity** is forbidden. The URL names the *resource* to look up; the resource carries its tenant.
- **Looking up the resource by `(entityId, tenantId)` composite key in a way that "succeeds" only if the caller's tenantId matches** is forbidden. This pattern would return 200 for cross-tenant attempts (no row found) instead of 404 — but the response is correct (404). However, this is a code smell: do the load by primary key first, then compare. Otherwise the audit row cannot be written for the denied attempt because the handler doesn't know whether the resource exists.
- **Skipping the DB read** because the URL parameter "looks valid" is forbidden.
- **Caching the ownership decision across requests** is forbidden in this PR (out-of-scope optimization; ownership decisions are per-request).

### Audit implications

- A "resource not found" 404 still writes a denied-attempt audit row — the probe pattern is operationally informative.
- A 500 (data-integrity) writes a denied-attempt row AND triggers an internal alert.

### Tenant-boundary implications

- The resource's `tenantId` is the **persisted owner** — never re-derived from the request, never inferred from the URL, never trusted from a header.
- Per `OWNERSHIP_INVARIANTS.md` §1.4: **ownership must be derived server-side**.

---

## Step 4 — VALIDATE OWNERSHIP

### Purpose

**Compare** the JWT-derived `requestingTenantId` (step 2) to the persisted `resource.tenantId` (step 3). On mismatch, refuse.

### Failure semantics

- `requestingTenantId !== resource.tenantId` → **404** (cross-tenant; per `SECURITY_INVARIANTS.md` §5.5; never 403).

### Allowed outputs

- Continue to step 5 — ownership confirmed; the actor's tenant owns the resource.

### Forbidden shortcuts

- **Returning 403 for cross-tenant** is forbidden — it confirms the resource exists in another tenant, leaking tenant existence (per `OWNERSHIP_INVARIANTS.md` §6.2).
- **Soft-failure** (e.g., logging the mismatch but continuing) is forbidden.
- **Permitting cross-tenant access for `ADMIN` `UserRoleType`** is forbidden in this canonical sequence; cross-tenant admin reads require an explicit per-route opt-in flow with its own gate.
- **Comparison via `String()` coercion or loose equality (`==`)** is forbidden — use strict equality (`===`) on validated strings.

### Audit implications

- 404 cross-tenant writes a denied-attempt row with `tenantId = requestingTenantId` (the **caller's** org, not the resource's — so probing patterns cluster by attacker org).

### Tenant-boundary implications

- This is **the** tenant-boundary check. Defense-in-depth equivalents at middleware level (Layer 1's `cross_org` check for `/api/verifier/*`) are NOT a substitute — middleware has no DB.
- Per `AUTHORIZATION_LAYERS.md` §3: **ownership authorization belongs to the route handler**.

---

## Step 5 — VALIDATE WORKFLOW LEGITIMACY

### Purpose

Even though the actor owns the resource, the requested action may not be permissible **right now**. Workflow legitimacy is state-aware: a `ReceiptCandidate` in `review_required` state cannot be promoted; a `EmployerReview` not in a sharable state cannot generate a packet share. The workflow gate fires now.

### Failure semantics

- Workflow gate refuses → **409 Conflict** (state-incompatible) OR **422 Unprocessable Entity** (state-incompatible with a structured reason).
- Multiple workflow gates fire (e.g., 5-gate flow in `policyReview.ts`) — the first refusal wins; the response carries the gate name and a human-readable detail.

### Allowed outputs

- Continue to step 6 — all gates pass; the transition is legitimate.

### Forbidden shortcuts

- **Skipping the workflow gate because RBAC and ownership passed** is forbidden. Per `OWNERSHIP_INVARIANTS.md` §3.3: **workflow transitions require authorization AND ownership**.
- **Mutating the resource AND running the workflow gate after** is forbidden — the gate fires before the mutation.
- **Inferring workflow state from the request body** is forbidden. The state lives on the resource row, server-derived.

### Audit implications

- 409 / 422 writes a denied-attempt row with the gate name in `action` (e.g., `'employer_review.accept.workflow_blocked.review_state_not_ready'`).

### Tenant-boundary implications

- None directly. Workflow legitimacy is state-policy, not tenant-policy.
- However, a workflow gate that depends on cross-resource state (e.g., "Acceptance requires a valid Recognition") MUST verify that the dependent resource is also owned by the same tenant. Cross-tenant workflow dependencies are forbidden by default.

---

## Step 6 — WRITE MUTATION + AUDIT ATOMICALLY

### Purpose

Commit the resource update **and** the `AuditEvent` row in a single database transaction. They succeed together or neither does.

### Failure semantics

- Transaction commit fails → **500** with internal alert. Both writes roll back. **No partial state.**
- Resource update succeeds, audit write fails → transaction rolls back; **500** to the caller.
- Audit write succeeds, resource update fails → transaction rolls back; **500** to the caller.
- Network partition mid-transaction → Prisma surfaces the error; transaction is rolled back at the DB level.
- Idempotency violation (duplicate `correlationId` within the dedup window) → **409 `duplicate_request`** before the transaction opens.

### Allowed outputs

- Return 200 / 201 with the structured response shape per the route's contract. The response body MAY include the resulting resource state OR an opaque success acknowledgment per route policy.

### Forbidden shortcuts

- **Two separate `await prisma.X.create(...)` calls** without a transaction wrapper is forbidden. Use `prisma.$transaction((tx) => ...)`.
- **Writing the resource update first, then the audit row** (even within a transaction) is permitted only if BOTH writes are inside the transaction's callback. Splitting across `await` boundaries that release the transaction is forbidden.
- **Defaulting `actorId` to a service account, `'system'`, `'unknown'`, or empty string** is forbidden. If the handler cannot resolve a real `actorId`, the operation must abort at step 1 — never reach step 6 with an unattributed audit row.
- **Skipping the audit row for "small" mutations** is forbidden. Every state change writes one row, period.
- **Writing the audit row to a separate database** (e.g., a logging service) is forbidden in this canonical sequence — atomicity requires the same DB transaction. Audit pipelines that fan out to additional logging systems do so AFTER the transaction commits, asynchronously, and only as defense-in-depth.

### Audit implications

- The audit row's mandatory shape (per `OWNERSHIP_INVARIANTS.md` §3.4 and `w2-pr2-mutation-semantics.md` §3):

| Field | Source | Validation |
|---|---|---|
| `actorId` | `session.userId` | non-empty; never defaulted |
| `tenantId` | `requestingTenantId` from step 2 | non-empty; matches `resource.tenantId` |
| `action` | structured `<verb>.<subject>` enum | matches the route's allowlist |
| `subjectId` | the URL parameter for the resource | non-empty |
| `decidedAt` | server clock (ISO 8601) | always now |
| `payloadHash` | SHA-256 of redacted body | always present; empty string forbidden |
| `correlationId` | request-scoped UUID | unique per `(actorId, 24h)` |
| `replaySafe` | boolean | `false` for state-changing writes |
| `outcome` | `'permitted'` for success | required |

- Per `SECURITY_INVARIANTS.md` §4.3: `AuditEvent` is **append-only**. No `UPDATE`, no `DELETE`. Corrections via new rows with `correctsEventId`.

### Tenant-boundary implications

- The audit row's `tenantId` is the actor's tenant (which equals the resource's tenant after step 4 confirmed ownership). The audit row carries forward the tenant boundary into the audit log.

---

## Explicit distinctions (these are routinely conflated — hold them apart)

### Authentication ≠ ownership

- **Authentication** answers "who is this caller?" — Clerk's job, step 1.
- **Ownership** answers "does the caller own the resource?" — handler's job, steps 3+4.

A signed-in Clerk session proves identity. It proves nothing about resource control. A handler that returns resource data on the basis of "the user is signed in" is exploitable across tenants.

### Ownership ≠ workflow legitimacy

- **Ownership** answers "does the actor's tenant own this resource?" — step 4.
- **Workflow legitimacy** answers "is the requested transition legal in this resource's current state?" — step 5.

A user who owns a `ReceiptCandidate` cannot necessarily promote it right now — promotion requires the candidate be in `ready_for_policy_review` state. Owning the resource is the *precondition*; workflow legitimacy is the *second gate*. Skipping either is a defect.

### Workflow legitimacy ≠ audit visibility

- **Workflow legitimacy** answers "is this transition allowed?" — step 5.
- **Audit visibility** answers "can the caller read the audit log of this resource?" — a separate gate, typically `ADMIN`-role-only.

A user with all of (authentication, RBAC, ownership, workflow legitimacy) MAY STILL not be entitled to read every audit row of every action they took. Audit access is `ADMIN`-only or a redacted summary view per `SECURITY_INVARIANTS.md` §4.4. Conflating them is a privilege-escalation pattern.

---

## Forbidden patterns (any of these in a route handler is a defect)

### Mutation-before-audit coupling

```
// FORBIDDEN
await prisma.employerReview.update(...);   // step 6a
await prisma.auditEvent.create(...);       // step 6b — separate await; not in transaction
```

The two writes are not atomic. A failure between them leaves a mutation without an audit record. Always wrap in `prisma.$transaction((tx) => { ...both writes... })`.

### Ownership derivation from client headers

```
// FORBIDDEN
const tenantId = req.headers.get('x-verifier-org') ?? req.headers.get('x-tenant-id');
await prisma.employerReview.findFirst({ where: { tenantId, entityId } });
```

Headers are client-controlled. The handler must use the JWT-derived `requestingTenantId` only.

### Workflow transitions without ownership validation

```
// FORBIDDEN
const review = await prisma.employerReview.findUnique({ where: { entityId } });
if (review.reviewState === 'ready_for_acceptance') {        // step 5 fired — but step 4 skipped
  await prisma.employerAcceptance.create(...);
}
```

The workflow gate fires after ownership confirms. A correct workflow transition on an unowned resource is still a cross-tenant breach.

### RBAC-only mutation authorization

```
// FORBIDDEN
if (teamRole === 'admin') {
  await prisma.employerAcceptance.create(...);             // RBAC passed; ownership skipped
}
```

`team_role: 'admin'` for Org A grants admin actions on Org A's resources. It does NOT grant any access to Org B's resources, regardless of role. The handler must check the resource's `tenantId` against `requestingTenantId`.

### Partial mutation commits without audit writes

```
// FORBIDDEN — even within $transaction
await prisma.$transaction(async (tx) => {
  await tx.employerReview.update(...);
  // forgot the AuditEvent write — defect
});
```

Every state change emits exactly one `AuditEvent`. The transaction commits BOTH or neither.

### Type-asserted claim extraction

```
// FORBIDDEN
const claims = session.sessionClaims?.vitalcv as Record<string, unknown>;
const tenantId = (claims?.org_id as string) || '';
```

The `as` cast bypasses runtime validation. Per W2-PR1A: use `extractVerifierClaims(session.sessionClaims)` which performs full type-guarded extraction.

---

## Canonical failure behavior

### Fail closed

When any step's check is uncertain (DB read fails, parser error, claim malformed, transaction commit ambiguous), the response is the **most-restrictive honest code**:

- Auth resolution failure → 503 `clerk_unavailable` (per `FAIL_CLOSED_MATRIX.md` scenario 1).
- DB read failure → 503 `ownership_unresolvable`.
- Transaction commit failure → 500 with internal alert.
- Malformed URL parameter → 400 `malformed_resource_id`.

There is **no** path where uncertainty resolves to permission. The default is refusal.

### Enumeration-resistant denials

Cross-tenant denials return **404**, not 403. A 403 confirms the resource exists in another tenant; that is information leakage. The 404 wire response is identical to the response for "resource never existed at all," yielding maximum enumeration resistance.

| Scenario | Wire response |
|---|---|
| Resource does not exist anywhere | 404 |
| Resource exists in caller's tenant; permitted | 200 / 201 |
| Resource exists in caller's tenant; role denies | 403 (`readonly_blocks_mutation` etc.) |
| Resource exists in another tenant | **404** (NOT 403) |
| Resource exists; workflow gate refuses | 409 / 422 with structured detail |
| Auth missing | 401 / sign-in redirect (UI) or 403 (API) |
| Auth uncertain | 503 `clerk_unavailable` |

### Audit-attributable mutation rejection

Every denial at steps 2, 3, 4, 5 writes a denied-attempt audit row. The row carries `actorId = session.userId`, `tenantId = caller's JWT org_id`, `outcome: 'denied'`, `action: '<intended_action>.<reason>'`. Probing patterns are operationally visible — operators can see which actor / tenant is iterating across resource IDs.

Step 1 denials (no Clerk session) typically do NOT write audit rows because there is no `actorId` to attribute. This is the only exception.

### Deterministic authorization outcomes

Same inputs → same outputs. The sequence has no randomized fallback, no rate-limit-decision branching, no time-of-day variation. A request that would fail at step 4 today fails at step 4 tomorrow with the same response code, given the same JWT and the same DB state.

This is testable. The `apps/web/__tests__/employer-review-ownership.test.ts` test file (W2-PR2B implementation) locks the determinism — every gate is unit-tested with mocked Clerk and Prisma.

---

## How this sequence composes with the existing layers

| Layer (`AUTHORIZATION_LAYERS.md`) | Steps it covers |
|---|---|
| Layer 1 — Middleware | step 1 (for `/api/verifier/*`); steps 2 partial (the 3 RBAC gates of `checkVerifierPermission`) |
| Layer 2 — RBAC Helper | steps 1-2 deterministic decision (consumed by middleware AND route handler) |
| Layer 3 — Ownership | steps 3-4 (always at the route handler) |
| Layer 4 — Workflow | step 5 (domain modules called from the route handler) |
| Layer 5 — Audit | step 6 (atomic write inside a transaction) |

For routes outside `/api/verifier/*` (e.g., `/api/employer-review/*`), middleware does NOT run the RBAC gates. The route handler must run all six steps end-to-end. For `/api/verifier/*` routes (W2-PR4), middleware runs steps 1-2; the handler runs 3-6. The contract is the same; the layer assignment differs.

---

## How this sequence relates to subject-scoped routes

For subject-scoped resources (clinician's own `Passport`, `KnowledgeInboxItem`, `CredentialArtifact`):

- Step 2 (RBAC validate) checks the actor's `UserRole` (e.g., `CLINICIAN`).
- Step 3 (derive ownership) reads the resource's `subjectId` from the DB.
- Step 4 (validate ownership) compares `session.userId` (or the NPI binding from Clerk publicMetadata) against `resource.subjectId`.
- Steps 1, 5, 6 are identical.

Subject-scoped routes never use `requestingTenantId`. The compare is on `subjectId`. Per `RESOURCE_OWNERSHIP_DICTIONARY.md`, subject-scoped resources include `Passport`, `KnowledgeInboxItem`, `CredentialArtifact`, `ReadinessSnapshot`, `ApplicationBundle`, `ProofPack`.

---

## Per-PR mutation-gate compliance checklist

A reviewer applying this document at merge time verifies:

- [ ] Every mutating route handler runs all 6 steps in order
- [ ] Step 6 uses `prisma.$transaction` wrapping BOTH the resource update AND the audit write
- [ ] No client-supplied `tenantId` / `subjectId` is used as a persistence key
- [ ] No `as` cast on session claims; only `extractVerifierClaims` (or subject-equivalent helper)
- [ ] Cross-tenant returns 404, never 403
- [ ] `actorId` is `session.userId`, never defaulted
- [ ] Denied attempts at steps 2-5 write a denied-attempt audit row
- [ ] No mutation-before-audit code path exists (no separate `await`s outside the transaction)
- [ ] Workflow gate fires AFTER ownership check, never before
- [ ] Test file locks the sequence (per-step failure cases tested explicitly)
- [ ] Founder review obtained for HIGH_RISK auth-boundary changes (per `SECURITY_INVARIANTS.md` §7.1)

A PR that fails any item above is **not mergeable**, regardless of feature value or test coverage.

---

> Mutations are trusted only when identity, ownership, workflow legitimacy, and audit traceability succeed together.
