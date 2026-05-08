# W2-PR2 — Ownership Authorization Model

**Wave:** Wave 2, PR 2 — planning only · **Date:** 2026-05-07 · **Status:** architecture; **NO product code in this artifact** · **Depends on:** W2-PR1 (#280), W2-PR1A (#281). Subordinate to `OWNERSHIP_INVARIANTS.md` and `AUTHORIZATION_LAYERS.md`.

This document defines the ownership-authorization architecture for VitalCV. It is the design that subsequent PRs will implement. It is the contract route handlers must honor.

---

## 1. The four-layer model — restated

| Layer | Question answered | Where decided | Layer this PR scope |
|---|---|---|---|
| 1 — Authentication | Who is this caller? | Clerk (`auth()`); middleware | already wired (W2-PR1) |
| 2 — RBAC | What role / org claims do they hold? | `lib/auth/orgInvitations.ts`; middleware Step 0 | already wired (W2-PR1+W2-PR1A) |
| **3 — Ownership** | **Does the caller's tenant own the resource named by the URL?** | **Route handler with DB read** | **THIS WAVE** |
| 4 — Workflow | Is the requested transition legitimate given the resource's current state? | Domain modules (`lib/issuer-verification/`, `packages/domain-common/`) | partially wired (issuer chain); not enforced at route handlers yet |

A request that mutates a resource passes through all four layers. Each is necessary; none is sufficient.

**Authentication ≠ Ownership.** A signed-in Clerk session proves identity; it proves nothing about resource control.

**RBAC ≠ Ownership.** A `team_role: 'admin'` for Org A does not grant any access to Org B's resources. RBAC is *role-policy*; ownership is *resource-policy*.

**Ownership ≠ Workflow.** Owning a `ReceiptCandidate` does not mean the candidate can be promoted right now — promotion requires the candidate be in `ready_for_policy_review` state (Layer 4). Owning the resource is the precondition; workflow legitimacy is the second gate.

---

## 2. Ownership derivation — server authoritative

The owner of a resource is **the value persisted in the DB at write time**. It is not the value the request claims.

### 2.1 Inputs available to the handler

| Source | Trust level | Permitted use |
|---|---|---|
| Clerk JWT `sessionClaims.vitalcv.org_id` | TRUSTED (Clerk-signed, tamper-proof) | Use as `requestingOrgId` for the ownership compare |
| Clerk JWT `sessionClaims.userId` | TRUSTED | Use as `actorId` in audit writes |
| `x-verifier-org` request header | UNTRUSTED (client-controlled) | Validated by middleware against JWT (Layer 1). Discarded by route handler — not used as a persistence key. |
| Request body / query / URL parameters | UNTRUSTED | URL params name the **resource** to look up; body fields are only acceptable as resource fields the caller is authorized to set. |
| Cookies | UNTRUSTED | Never used for tenant identity. |

### 2.2 Ownership comparison shape

Every ownership check resolves to:

```
requestingTenantId  ←  JWT.sessionClaims.vitalcv.org_id  (server-derived)
resourceTenantId    ←  resourceRow.tenantId              (server-persisted)
```

- If `requestingTenantId` is null/missing → 403 `no_org_context` (already handled at middleware Layer 2 for `/api/verifier/*`; route handler must re-check for non-verifier-namespace mutating routes).
- If `resourceTenantId` is null on the row → 500 with internal alert (data-integrity defect; see `OWNERSHIP_INVARIANTS.md` §6.3).
- If `requestingTenantId !== resourceTenantId` → 404 (cross-tenant; per `OWNERSHIP_INVARIANTS.md` §6.2 — never 403).
- If equal → ownership confirmed; flow proceeds to workflow gate.

The compare uses simple string equality. **No timing-safe compare needed** (unlike Layer 2's org compare against `x-verifier-org`) because both values come from server-trusted sources; an attacker cannot probe timing.

---

## 3. Resource control matrix — by tenant kind

VitalCV has three primary tenant-kinds and one subject-kind. Each resource belongs to exactly one tenant or subject scope. Cross-scope mutation requires an explicit consent artifact.

### 3.1 Tenant kinds

| Tenant kind | Identity field | Examples |
|---|---|---|
| **Verifier org** | `org_id` (Clerk JWT) | An employer's review queue; team invitations; verifier-emitted decisions |
| **Issuer org** | issuer-app-side `org_id` (Clerk JWT) | Issuer requests; receipt candidates; policy review decisions |
| **Internal admin** | `UserRole.ADMIN` | Pilot-ops queue; internal funnel metrics; cross-tenant audit reads |

### 3.2 Subject kind

| Subject kind | Identity field | Examples |
|---|---|---|
| **Clinician (holder)** | `userId` (Clerk JWT) bound to NPI via Clerk publicMetadata | Their own passport; their knowledge-inbox; their proof-pack exports |

### 3.3 Cross-scope flows (must be explicit)

| Flow | Authorization artifact | Status |
|---|---|---|
| Verifier reads clinician's public passport | none — public surface, redacted shape | shipped |
| Verifier reads clinician's full passport for review | `EmployerReview.tenantId` matches verifier's `org_id` AND clinician consented to the review | partially shipped (review row exists; consent artifact wiring is partial) |
| Verifier reuses another verifier's PSV receipt | `crossTenantConsentReceiptId` from cross-tenant consent artifact | foundation only (W6) |
| Issuer's policy-review decision flows to verifier's evidence packet | issuer-side `acceptanceId` references issuer-org; verifier-side packet references the receipt-candidate-id with explicit ownership separation | not yet wired |
| Internal admin cross-tenant read | per-route ADMIN gate + per-row audit-event write | not yet wired |

---

## 4. Ownership failure semantics

### 4.1 Failure response matrix

| Failure | HTTP code | Body | Header |
|---|---|---|---|
| Auth missing entirely (handler-side check) | `401` | empty | — |
| Auth present, role denies (handler-level re-check beyond middleware) | `403` | `{ "error": "role_denies" }` | — |
| Auth present, JWT org_id missing | `403` | `{ "error": "no_org_context" }` | — |
| Auth present, role permits, **resource owned by another tenant** | **`404`** | empty | — |
| Auth present, ownership confirmed, **workflow gate refuses** | `409` or `422` | `{ "error": "<gate_name>", "detail": "..." }` | — |
| DB read fails / ownership unresolvable | `503` | empty | `x-rbac-fail-closed: ownership_unresolvable` |
| Resource row exists but `tenantId` is null (data-integrity bug) | `500` | empty | internal alert |
| URL parameter is malformed | `400` | `{ "error": "malformed_resource_id" }` | — |

### 4.2 Why 404 on cross-tenant (not 403)

Per `SECURITY_INVARIANTS.md` §5.5, cross-tenant access returns 404 to be enumeration-resistant. A `403` response confirms the resource exists in another tenant — that is information leakage. The 404 wire response is identical to the response for "resource never existed at all," yielding maximum enumeration resistance.

Mixing 403 and 404 inadvertently is the most common ownership-leak defect. **Lock the matrix.**

---

## 5. The standard ownership-check pattern

Every mutating route handler that operates on a tenant-scoped resource follows this exact sequence. (No code in this doc — see W2-PR2 implementation PR for the shared helper.)

```
1. const session = await auth()
   if (!session.userId) → 401 (or 403 if /api/* delegation contract)

2. const requestingTenantId = extractTenantFromSessionClaims(session.sessionClaims)
   if (!requestingTenantId) → 403 no_org_context

3. const role = parseTeamRole(session.sessionClaims?.vitalcv?.team_role)
   if (!roleAllowsAction(role, action)) → 403 role_denies

4. const resource = await loadResourceById(resourceIdFromUrlParam)
   if (!resource) → 404                                         (resource never existed)
   if (!resource.tenantId) → 500 (data-integrity)               (internal alert)
   if (resource.tenantId !== requestingTenantId) → 404         (cross-tenant; same wire shape)

5. const workflowDecision = checkWorkflowGate(resource, action, body)
   if (!workflowDecision.permitted) → 409 / 422 with structured error

6. // Atomic transaction:
   const result = await db.transaction((tx) => {
     const updated = await tx.resource.update(...)
     await tx.auditEvent.create({
       actorId: session.userId,
       tenantId: requestingTenantId,
       action: '<verb.subject>',
       subjectId: resource.id,
       decidedAt: nowIso(),
       payloadHash: sha256(redactedRequestBody),
       correlationId: requestCorrelationId,
       replaySafe: true,
     })
     return updated
   })

7. return 200/201 with the structured response shape
```

The shared helper introduced by W2-PR2 is conceptually:

```
async function requireOwnedResource<T>(args: {
  session, resourceLoader, idFromUrl, tenantField, expectedRole?
}): Promise<{ requestingTenantId, resource }> | NextResponse
```

The helper either returns the validated `(requestingTenantId, resource)` tuple OR returns a `NextResponse` with the appropriate failure response. Route handlers narrow on the result type. Implementation defers to the W2-PR2 implementation PR.

---

## 6. Atomic write rule

Every mutation is **atomic with its `AuditEvent` write**. They succeed together or neither does. The DB transaction is the boundary. Per `SECURITY_INVARIANTS.md` §4.1.

A handler that writes the resource row first and the audit row second (without a transaction) is a defect — a partial failure mode where the resource changes but the audit row is missing creates an unauditable mutation.

---

## 7. Out of scope for W2-PR2

Per the wave brief, W2-PR2 establishes the ownership pattern at the **employer-review** namespace specifically. It does NOT:

- Implement the verifier-namespace route handlers (W2-PR4)
- Add new RBAC roles or modify existing ones
- Change Prisma schema (uses existing `EmployerReview.tenantId` and equivalents; if a needed field is missing, that's a separate FOUNDER_REQUIRED PR)
- Modify the canonical-path domain (`packages/domain-common/`)
- Add invitation lifecycle (W2-PR4)
- Add cross-tenant consent artifacts (W6)
- Modify the audit table schema or persistence mode

**W2-PR2 modifies AT MOST:** `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`, `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts`, the new shared helper file, and the new test file. Approximately 4 files.
