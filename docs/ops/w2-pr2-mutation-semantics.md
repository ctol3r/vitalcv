# W2-PR2 — Mutation Semantics

**Wave:** Wave 2, PR 2 — planning only · **Date:** 2026-05-07 · **Status:** architecture; **NO product code in this artifact**

This doc defines the rules every mutating route handler in `apps/web` must follow when implementing ownership authorization (Layer 3) and the atomic-write contract with `AuditEvent`.

It is a contract, not pseudocode. The W2-PR2 implementation PR will translate these rules to code; this doc is what reviewers gate against at merge time.

---

## 1. Mutation classification

Every mutation falls into one of five classes. The class determines which gates fire.

| Class | Example | Gates that fire |
|---|---|---|
| **Tenant-scoped self-mutation** | Verifier in Org A modifies Org A's review row | Auth → RBAC → Ownership → Workflow → Audit |
| **Tenant-scoped cross-tenant** | Verifier in Org A modifies Org B's review row | Auth → RBAC → Ownership FAILS → 404 |
| **Subject-scoped self-mutation** | Clinician modifies their own KnowledgeInboxItem | Auth → Subject-ownership → Workflow → Audit |
| **Subject-scoped cross-subject** | Clinician modifies another clinician's data | Auth → Subject-ownership FAILS → 404 |
| **Cross-scope mutation with consent** | Verifier acts on a clinician's data with `ConsentArtifact` | Auth → RBAC → Consent-validation → Workflow → Audit |

A mutation that does not fit one of these classes is **not allowed**. The reviewer must refuse the PR until the class is established.

---

## 2. Mutation legitimacy gate sequence (immutable)

Every mutating route handler runs the following sequence. **Order is load-bearing — do not reorder.**

```
1. Identity coherence (Layer 1 — middleware-level)
   - auth() resolves; userId is non-empty.
   - For /api/verifier/*: middleware Step 0 has already validated.

2. Role authorization (Layer 2 — middleware-level for /api/verifier/*; handler-level elsewhere)
   - JWT.team_role permits the requested HTTP method.
   - For non-verifier-namespace routes (e.g., employer-review),
     the handler re-checks the role.

3. Ownership authorization (Layer 3 — THIS LAYER)
   - Load the resource by URL parameter.
   - Compare requestingTenantId (from JWT) to row.tenantId.
   - On mismatch or unresolvable: stop. 404 (cross-tenant) or 503 (DB error).

4. Workflow authorization (Layer 4)
   - Check the resource's current state allows the requested transition.
   - For issuer-verification mutations, the 5-gate flow in policyReview.ts.

5. Atomic write (Audit — Layer 5)
   - Open a DB transaction.
   - Write the resource update.
   - Write the AuditEvent row.
   - Commit; both rows succeed or neither does.

6. Response
   - 200/201 with the structured response shape.
```

**Skipping any step is a defect.** Reordering them is a defect. A handler that writes the resource before checking ownership is exploitable.

---

## 3. Required `AuditEvent` shape

Every mutation produces exactly one `AuditEvent` row in the same transaction. The row carries:

| Field | Source | Constraint |
|---|---|---|
| `id` | DB-generated UUID | unique |
| `actorId` | `session.userId` (JWT) | non-empty; never `'system'` / `'unknown'` / `''` |
| `tenantId` | JWT-derived `requestingTenantId` | non-empty; matches the resource's tenantId |
| `action` | `'<verb>.<subject>'` (e.g., `'employer_review.accept'`, `'verifier.invitation.create'`) | enum-validated; new actions require schema review |
| `subjectId` | The resource being mutated (URL param) | non-empty |
| `decidedAt` | server timestamp (ISO 8601) | always now-server-clock |
| `payloadHash` | SHA-256 of the redacted request body | always present; empty string is **not** acceptable |
| `correlationId` | request-scoped UUID (e.g., from `x-correlation-id` header or generated) | unique within `(actorId, 24h)` window for replay-detection |
| `replaySafe` | `boolean` | `true` for idempotent reads; `false` for state-changing writes that should not be replayed |
| `outcome` | `'permitted' \| 'denied'` | record both — denied attempts are also auditable |

**Denied attempts MUST also write an audit row.** A user trying to access cross-tenant data is operationally informative; the audit log is where operators see probing patterns.

For denied-attempt rows:
- `outcome: 'denied'`
- `action: '<verb>.<subject>.<reason>'` (e.g., `'employer_review.accept.cross_tenant'`)
- `subjectId`: the URL parameter the caller attempted (so probing patterns are clustered)
- `tenantId`: the **caller's** tenantId (so we can see what Org A is probing for)

---

## 4. Per-action contract — `/api/employer-review/[entityId]/[action]`

W2-PR2 implements ownership for these specific actions:

### 4.1 `view` (currently public — needs reclassification)

**Class:** Tenant-scoped read.
**Method:** `GET` (or `POST` if used as an idempotent action).
**Required gates:** Auth (because it returns tenant-scoped data; reclassify from `PUBLIC_MUTATION_ACTIONS`) → Ownership → respond.
**Audit:** **Yes** — even reads are audited (per `OWNERSHIP_INVARIANTS.md` §6.1; minimum-information record).
**Failure:** 404 cross-tenant; 401/403 if no auth.

**Caveat:** if `view` is intended as a public share-token-protected read (e.g., `?shareToken=abc`), the handler must split into two paths:
- Token-protected public read (validate token, scope to single resource, never trust headers/body for tenantId).
- Auth-required tenant read (run the full 4-gate sequence).

The PR must document which path is used; current code has both classes mixed under one action name.

### 4.2 `accept` (employer accepts a clinician)

**Class:** Tenant-scoped self-mutation.
**Method:** POST.
**Required gates:** Auth → RBAC (`admin`+) → Ownership (entityId's review.tenantId === JWT.org_id) → Workflow (review state permits acceptance; clinician's CRS ≥ 80) → Atomic write of `EmployerAcceptance` + `AuditEvent`.
**Failure:** 403 if role insufficient; 404 cross-tenant; 409 if CRS < 80 or workflow gate refuses; 500 if DB transaction fails.
**Idempotency:** the same `(entityId, accepting org, decidedAt)` MUST NOT produce two rows. Use unique constraint on `EmployerAcceptance(entityId)` if it accepts only one org per entity, or `(entityId, tenantId)` if multi-org acceptance is meaningful.
**Audit row:** `action: 'employer_review.accept'`; `subjectId: entityId`; `payloadHash` of the accept-request body.

### 4.3 `request-refresh` (verifier asks for a refreshed credential)

**Class:** Tenant-scoped self-mutation.
**Method:** POST.
**Required gates:** Auth → RBAC (`member`+) → Ownership → Workflow (review state permits refresh request) → Atomic write of `RefreshRequest` row + `AuditEvent`.
**Failure:** 403 / 404 / 409 per the matrix.
**Audit row:** `action: 'employer_review.request_refresh'`.

### 4.4 `route-to-review` (sends to human reviewer)

**Class:** Tenant-scoped self-mutation.
**Method:** POST.
**Required gates:** Auth → RBAC (`member`+) → Ownership → Workflow → Atomic update of `EmployerReview.reviewState` + `AuditEvent`.
**Audit row:** `action: 'employer_review.route_to_review'`.

### 4.5 `share-packet` (generates an evidence-share link)

**Class:** Tenant-scoped self-mutation that creates a cross-scope artifact (the share token).
**Method:** POST.
**Required gates:** Auth → RBAC (`member`+) → Ownership → Workflow → Atomic write of `ApplyShare` (or equivalent) + `AuditEvent`.
**Audit row:** `action: 'employer_review.share_packet'`; the audit row records the generated `shareToken` ID (not the secret) so revocation is traceable.
**Caveat:** the resulting share token is itself an authorization artifact for downstream public reads. The token must:
- Be cryptographically random (≥ 128 bits of entropy).
- Carry an expiry.
- Be bound to a single `entityId`.
- Never be replayed across resources.

### 4.6 `confirm-start` (verifier confirms the clinician started)

**Class:** Tenant-scoped self-mutation.
**Method:** POST.
**Required gates:** Auth → RBAC (`admin`+) → Ownership → Workflow (existing `EmployerAcceptance` referenced) → Atomic write of `StartAttestation` + `AuditEvent`.
**Audit row:** `action: 'employer_review.confirm_start'`; references the prior `EmployerAcceptance.id`.
**Caveat:** the canonical-path `Start` step is downstream of `confirm-start` per `MASTER_PROMPT.md` §3. The route handler enforces ownership and workflow at the same time; the canonical-path domain in `packages/domain-common/employmentGuards.ts` enforces the broader sequence (Recognition → Acceptance → Start).

### 4.7 `acceptance-history` (currently public read)

**Class:** Tenant-scoped read.
**Method:** GET.
**Required gates:** Auth → Ownership → respond.
**Audit row:** optional (read-only access; record at minimum-information shape).
**Failure:** 404 cross-tenant; 403 missing auth.

**Caveat:** currently in `PUBLIC_READ_ACTIONS`. **Reclassify** unless there's a documented public-share semantics. If a public share is intended, require a `shareToken` parameter and scope to a single entity.

### 4.8 `packet`, `status` (currently authenticated reads)

**Class:** Tenant-scoped read.
**Method:** GET.
**Required gates:** Auth → Ownership → respond.
**Audit row:** optional / minimum-information.
**Failure:** 404 cross-tenant.

These are already in `AUTHENTICATED_READ_ACTIONS` — the missing piece is the ownership check at the handler. W2-PR2 adds it.

---

## 5. The shared ownership helper (proposed signature)

The W2-PR2 implementation introduces a single helper that all employer-review handlers consume. Pure-function-ish (DB-aware but server-only-imported).

Conceptual signature (NOT the implementation):

```
type OwnershipResult<T> =
  | { ok: true; requestingTenantId: string; actorId: string; resource: T }
  | { ok: false; response: NextResponse };  // pre-built failure response

async function requireOwnedEmployerReview(
  request: NextRequest,
  entityId: string,
  options?: { requireRole?: VerifierTeamRole }
): Promise<OwnershipResult<EmployerReviewRow>>;
```

The helper:

1. Resolves `auth()`.
2. Returns `{ok: false, response: 403/401}` if no userId.
3. Extracts JWT-derived tenantId via the existing `extractVerifierClaims` helper.
4. Returns `{ok: false, response: 403 no_org_context}` if missing.
5. (Optional) checks role against `requireRole`; returns 403 if insufficient.
6. Loads `EmployerReview` by entityId.
7. Returns `{ok: false, response: 404}` if row is missing OR `row.tenantId !== requestingTenantId`.
8. Returns `{ok: false, response: 500 with internal alert}` if `row.tenantId` is null / non-string.
9. Returns `{ok: true, requestingTenantId, actorId: session.userId, resource: row}` on success.

Route handlers narrow on the result type:

```
const result = await requireOwnedEmployerReview(req, entityId, { requireRole: 'admin' });
if (!result.ok) return result.response;
const { requestingTenantId, actorId, resource } = result;
// proceed with workflow gate + atomic write
```

This pattern is mandated for every mutating handler in `/api/employer-review/*`. Tests verify the pattern is honored on every action.

---

## 6. Atomic-write helper (also proposed)

A second helper enforces that the resource update + audit row are wrapped in a transaction.

Conceptual signature:

```
async function atomicMutateWithAudit<T>(args: {
  prisma: PrismaClient;
  resource: { update: (tx: TransactionClient) => Promise<T> };
  auditEvent: {
    actorId: string;
    tenantId: string;
    action: string;
    subjectId: string;
    payloadHash: string;
    correlationId: string;
    replaySafe: boolean;
    outcome: 'permitted' | 'denied';
  };
}): Promise<T>;
```

Internally uses `prisma.$transaction((tx) => ...)`. Tests verify both writes occur within the transaction.

This helper is reused by every mutation in the wave's scope. Prevents the disjoint-write anti-pattern (T-10).

---

## 7. Test-plan shape (handed to W2-PR2 implementation PR)

The test file `apps/web/__tests__/employer-review-ownership.test.ts` (new) MUST cover:

### 7.1 Per-action ownership tests (5 mutating actions × 4 scenarios)

For each of `accept`, `request-refresh`, `route-to-review`, `share-packet`, `confirm-start`:

- ✅ owner-within-org + permitted role → 200/201
- ❌ cross-tenant (Org A actor, Org B resource) → 404
- ❌ owner-within-org + readonly role → 403
- ❌ no auth (no Clerk session) → 403/401

### 7.2 Audit-event atomicity tests (5 actions)

- ✅ each successful mutation writes exactly one `AuditEvent` row in the same transaction
- ❌ if the resource update fails, NO audit row is written (transaction rollback)
- ❌ if the audit write fails, the resource update is NOT committed (transaction rollback)

### 7.3 Header-injection tests (3)

- `x-verifier-org` set to attacker's org while JWT carries victim's org → 404 (handler discards header)
- request body `tenantId` set to attacker's org → 404 (handler discards body field)
- query string `?tenantId=...` → 404 (handler ignores query)

### 7.4 Probe-resistance tests (2)

- random `entityId` (no row exists) → 404
- valid `entityId` but cross-tenant → 404 (same wire response as "not found")

### 7.5 Edge-case tests (5)

- `entityId` is empty string → 400 malformed_resource_id
- `entityId` is overly long → 400 (regex / length validation in helper)
- `EmployerReview.tenantId` is null in DB (data-integrity bug) → 500 with internal alert
- `EmployerReview.tenantId` is empty string → 500
- `requestingTenantId` from JWT is empty string → 403 no_org_context

### 7.6 Replay-resistance test (1)

- duplicate `(actorId, correlationId)` within 24h → 409 duplicate_request

Total: ≈ 31 test cases across the file. All mocks (Prisma, Clerk auth) — no real DB or network calls.

---

## 8. Documented deferrals

The following are explicit **non-goals** for W2-PR2; planned for follow-ups:

- Force JWT refresh on org-membership change (T-4) — Clerk admin API integration; separate wave.
- Schema NOT-NULL drift detection (T-8) — extend `migration-shape` test (PR #251).
- Cross-scope consent artifacts beyond `ConsentArtifact` already in the codebase — see W6 for the full cross-tenant design.
- Audit endpoint `ADMIN`-role gate (T-12) — W2-PR3 scope.
- Verifier-namespace route handlers (`/api/verifier/*`) — W2-PR4 scope.
- DB-level unique constraint on `EmployerAcceptance` (T-6) — separate FOUNDER_REQUIRED schema PR.

The W2-PR2 implementation PR will list these deferrals in its PR body. Each is tracked.
