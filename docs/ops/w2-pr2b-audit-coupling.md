# W2-PR2B — Audit Coupling

**Wave:** Wave 2, PR 2B — audit-coupling scaffolding · **Date:** 2026-05-08 · **Status:** scaffolding only; **NO product code in this artifact** · **Authority:** subordinate to `OWNERSHIP_INVARIANTS.md` §6, `MUTATION_GATE_SEQUENCE.md` §4, `w2-pr2b-implementation-lock.md` §5, and `w2-pr2-mutation-semantics.md` §3.

This doc defines, for each employer-review mutating action, **the exact `AuditEvent` row that must be written and the exact transactional coupling between the mutation row and the audit row**. It is the per-action audit contract for Step 6 of the canonical mutation gate sequence.

The wave's second-largest invariant comes from this doc: **every mutation produces exactly one audit row, written in the same Prisma transaction as the mutation, and every denied attempt also produces an audit row** (so probing patterns are visible to forensics). A mutation without a paired audit row, or an audit row without its paired mutation, is a defect.

---

## 1. Audit-coupling principles

Three principles, each non-negotiable:

### 1.1 Atomicity

Every mutation row and its paired audit row are written in the **same `prisma.$transaction((tx) => ...)` block**. Failure of either rolls back both. There is no out-of-band audit publisher, no async audit queue, no fire-and-forget audit emit. The audit row commits only if the mutation row commits, and vice versa.

### 1.2 Probe visibility

Every denied attempt that reached at least Step 2 of the gate sequence (i.e., the caller is authenticated) writes a denied audit row with `outcome: 'denied'` and an `action` literal that names the denial reason. This is required so a SOC analyst can cluster probes by actor, by tenant, by reason, by time. Denials at Step 1 (no auth) do NOT write audit rows because there is no `actorId` to record.

### 1.3 No audit silence

A successful mutation MUST produce an audit row. A handler that returns `200`/`201` without an audit row in the same transaction is a defect. A handler that writes the audit row outside the transaction "for safety" is a defect. A handler that writes the audit row before the workflow gate on the success path is a defect (it would persist an audit for a mutation that hasn't been validated).

The principles together: **audit rows are atomic, ubiquitous-on-decision, and never disjoint**.

---

## 2. The audit-row schema (frozen by W2-PR1 + W2-PR2A; W2-PR2B does NOT redefine)

The `AuditEvent` model exists in the existing Prisma schema. W2-PR2B writes rows to it; it does NOT add columns or alter the schema. The fields W2-PR2B populates are listed below.

| Column | Type | Population rule for W2-PR2B |
|---|---|---|
| `id` | UUID (DB-generated) | from Prisma default |
| `actorId` | string (NOT NULL) | `session.userId` from Clerk JWT; never `''`, `'system'`, `'unknown'`, or any synthetic |
| `tenantId` | string (NOT NULL) | the **caller's** JWT-derived `org_id` (NOT the resource's `tenantId` — see §3.2) |
| `action` | string enum-validated | one of the literals listed in §4 |
| `subjectId` | string (NOT NULL for these mutations) | the URL parameter (`entityId` or, for sibling route, `npi`) |
| `decidedAt` | ISO-8601 timestamp | `new Date().toISOString()` server clock |
| `payloadHash` | hex SHA-256 | of the redacted request body (see §6); empty string is **not** acceptable |
| `correlationId` | UUID | request-scoped — `req.headers.get('x-correlation-id')` if present + valid UUID, else generated |
| `replaySafe` | boolean | `false` for all mutations in this PR (literal — these are state-changing actions) |
| `outcome` | string `'permitted' \| 'denied'` | `'permitted'` on success-path commit; `'denied'` on rejection-path emission |
| `reason` (if column exists) | string | `null` for permitted; `<denial_reason_literal>` for denied |
| `metadata` (JSON, if column exists) | JSON | small, redacted; e.g., `{ priorState, newState }` for state transitions; never raw PII |

If `AuditEvent` lacks a `reason` or `metadata` column, the denial reason is encoded into the `action` literal itself (e.g., `'employer_review.accept.cross_tenant'`). The schema-as-it-exists is the constraint; W2-PR2B does NOT introduce new columns.

---

## 3. Where each audit field comes from

### 3.1 `actorId`

`session.userId` from Clerk JWT, at Step 1 of the gate sequence. Never optional, never null on a request that reaches Step 2 or beyond. If `userId` is null at Step 1 the request returns 401/403 with NO audit row (there is no actor).

### 3.2 `tenantId` — the caller's tenant, NOT the resource's

For both **permitted** and **denied** rows, the audit-row `tenantId` is the **caller's** JWT-derived `org_id`. This is intentional and load-bearing:

- On the permitted path, caller and resource are equal (Step 4 enforced). Either source produces the same value.
- On the denied path (especially cross-tenant), `EmployerReview.tenantId !== requestingTenantId`. The audit row's `tenantId` is the **caller's** tenant. This clusters probing by who is probing, not by who they are probing. A SOC analyst querying "all denied audit rows for tenant X" sees X's actors' attempts (including their cross-tenant probes), which is the actionable view.

A defect that records the **resource's** tenant on a cross-tenant denial would scatter probe records into target tenants, hiding the attacker pattern.

### 3.3 `action`

A string literal from the allowlist below. Free-form values are forbidden.

| Path | Permitted-row literal | Denied-row literals |
|---|---|---|
| `accept` | `'employer_review.accept'` | `'employer_review.accept.no_org_context'`, `'employer_review.accept.role_denied'`, `'employer_review.accept.cross_tenant'`, `'employer_review.accept.entity_not_found'`, `'employer_review.accept.crs_below_threshold'`, `'employer_review.accept.wrong_review_state'`, `'employer_review.accept.data_integrity'`, `'employer_review.accept.malformed_resource_id'` |
| `confirm-start` | `'employer_review.confirm_start'` | `'.no_org_context'`, `'.role_denied'`, `'.cross_tenant'`, `'.entity_not_found'`, `'.no_prior_acceptance'`, `'.wrong_review_state'`, `'.data_integrity'`, `'.malformed_resource_id'` (each prefixed by `'employer_review.confirm_start'`) |
| `request-refresh` | `'employer_review.request_refresh'` | `'.no_org_context'`, `'.role_denied'`, `'.cross_tenant'`, `'.entity_not_found'`, `'.duplicate_refresh_request'`, `'.archived_review'`, `'.data_integrity'`, `'.malformed_resource_id'` |
| `route-to-review` | `'employer_review.route_to_review'` | `'.no_org_context'`, `'.role_denied'`, `'.cross_tenant'`, `'.entity_not_found'`, `'.wrong_review_state'`, `'.data_integrity'`, `'.malformed_resource_id'` |
| `share-packet` | `'employer_review.share_packet'` | `'.no_org_context'`, `'.role_denied'`, `'.cross_tenant'`, `'.entity_not_found'`, `'.archived_review'`, `'.data_integrity'`, `'.malformed_resource_id'` |
| sibling refresh-requests | `'employer_review.refresh_requests.read'` (if read is audited; deferred — see §7) | `'.cross_tenant'`, `'.entity_not_found'`, `'.role_denied'`, `'.no_org_context'` (each prefixed) |

The verb part of the literal is `snake_case` (matching existing convention). The `'<base>.<reason>'` suffix is the only non-fixed segment.

### 3.4 `subjectId`

For mutating actions in W2-PR2B, the `subjectId` is the URL parameter (`entityId` or `npi`). It is recorded **even on denied attempts** so probing of nonexistent or cross-tenant resources is captured. The combination `(actorId, tenantId, action_base, subjectId, decidedAt)` is the forensics primary signal.

### 3.5 `payloadHash`

SHA-256 hex of the redacted request body. Redaction rules:

| Field class | Redaction |
|---|---|
| Free-form text (notes, comments, justifications) | hashed as-is |
| PII-bearing fields (NPI, SSN, name, DOB) | hashed as-is (the hash is one-way; reversibility is not a concern) |
| Forbidden ownership fields (`tenantId`, `orgId`, `org_id`, etc.) | discarded **before** hashing — they were ignored by the handler, and including them in the hash would couple the audit row to a value the handler never used |
| Empty body (no fields submitted) | hash of the empty string `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The hash is computed once per request at Step 5 (after workflow validation) for permitted-path emissions, or at Step 4 for denied-path emissions. Either way the hash represents what the caller actually submitted.

### 3.6 `correlationId`

If the request carries a valid UUID in the `x-correlation-id` header, that value is reused. Otherwise the handler generates a fresh UUID. The correlation ID is included in the response header `x-correlation-id` so the caller can correlate their request to logs.

`correlationId` uniqueness is enforced over a 24h window per actor — duplicate `(actorId, correlationId)` within 24h returns 409 `duplicate_request` and writes NO audit row (the prior row already exists for that correlation).

### 3.7 `replaySafe`

Always `false` for the W2-PR2B mutations. These actions transition state and produce side-effect rows; replays are not safe. The literal is hard-coded.

### 3.8 `outcome`

`'permitted'` only on the success path within the transaction. `'denied'` on every audit-emitting denial path. There is no third value.

### 3.9 `metadata` (if column exists)

Small JSON. Per-action specifics:

| Action | Metadata fields |
|---|---|
| `accept` | `{ priorReviewState }` |
| `confirm-start` | `{ priorAcceptanceId }` |
| `request-refresh` | `{ priorRefreshRequestId? }` (null if first within window) |
| `route-to-review` | `{ priorReviewState, newReviewState }` |
| `share-packet` | `{ tokenRef }` (NEVER the secret token) |

If the schema lacks `metadata`, these are dropped — the `payloadHash` + `action` literal carry the necessary forensic signal. W2-PR2B does NOT add the column.

---

## 4. Per-action audit contract

The five mutating actions, each producing exactly one paired audit row.

### 4.1 `accept`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** (recap) | A (`JWT.org_id`) === B (`EmployerReview.tenantId`) |
| **Workflow legitimacy requirement** (recap) | `reviewState ∈ {recognized, ready_for_acceptance}` AND `clinician.crs ≥ 80` |
| **Audit requirement** | One `AuditEvent` row inside `prisma.$transaction`, paired with the `EmployerAcceptance` insert. `action: 'employer_review.accept'`; `subjectId: entityId`; `outcome: 'permitted'`. |
| **Denial semantics** | All denial reasons emit a denied audit row with the `'employer_review.accept.<reason>'` literal. The wire codes are 401/403/404/409/422/500 per the matrix in `w2-pr2b-mutation-flow.md` §7. |
| **Readonly behavior** | Readonly POST → 403 + denied audit row (`'employer_review.accept.role_denied'`). Readonly users do not produce permitted accepts. |
| **Tenant-boundary guarantee** | The audit row's `tenantId` and the `EmployerAcceptance.tenantId` are BOTH populated from `requestingTenantId` (JWT-derived). Step 4 has already verified `EmployerReview.tenantId === requestingTenantId`. |

### 4.2 `confirm-start`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** (recap) | A === B; AND prior `EmployerAcceptance.tenantId === requestingTenantId` (Step 5) |
| **Workflow legitimacy requirement** (recap) | Prior acceptance exists for `entityId`; `acceptance.tenantId === requestingTenantId`; `reviewState ∈ {accepted, ready_for_start}` |
| **Audit requirement** | One audit row paired with `StartAttestation` insert. `action: 'employer_review.confirm_start'`; `subjectId: entityId`; `metadata.priorAcceptanceId` set. The audit row references the prior acceptance for the canonical-path forensics chain. |
| **Denial semantics** | Cross-tenant prior acceptance → 404 + `'employer_review.confirm_start.cross_tenant'` (NOT `'no_prior_acceptance'`, even though the visible-to-this-tenant set is empty — the wire/audit literal correctly reflects that the row exists in another tenant). Same wire (404), distinct audit literal. |
| **Readonly behavior** | Readonly POST → 403 + denied audit. |
| **Tenant-boundary guarantee** | `StartAttestation.tenantId` AND audit row's `tenantId` both = `requestingTenantId`. Cross-row tenant equality on the prior acceptance is enforced at Step 5 with cross-tenant returning 404. |

### 4.3 `request-refresh`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** (recap) | A === B |
| **Workflow legitimacy requirement** (recap) | `reviewState !== 'archived'`; no open `RefreshRequest` for entity within 24h |
| **Audit requirement** | One audit row paired with `RefreshRequest` insert. `action: 'employer_review.request_refresh'`; `subjectId: entityId`. |
| **Denial semantics** | `duplicate_refresh_request` → 409 + denied audit (`.duplicate_refresh_request`). Archived review → 422 + denied audit (`.archived_review`). Readonly POST → 403 + denied audit (`.role_denied`). |
| **Readonly behavior** | Readonly POST → 403 + denied audit. Readonly users may still GET the resource after read reclassification — that is not within this audit contract. |
| **Tenant-boundary guarantee** | `RefreshRequest.tenantId` AND audit row's `tenantId` both = `requestingTenantId`. |

### 4.4 `route-to-review`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** (recap) | A === B |
| **Workflow legitimacy requirement** (recap) | `reviewState ∈ allowed-routable-states` per `employmentGuards.ts` |
| **Audit requirement** | One audit row paired with `EmployerReview.reviewState` update. `action: 'employer_review.route_to_review'`; `subjectId: entityId`; `metadata.priorReviewState` and `metadata.newReviewState` set (if `metadata` column exists). |
| **Denial semantics** | Wrong state → 422 + denied audit (`.wrong_review_state`). Cross-tenant → 404 + denied audit (`.cross_tenant`). Readonly POST → 403 + denied audit. |
| **Readonly behavior** | Readonly POST → 403 + denied audit. |
| **Tenant-boundary guarantee** | The handler does NOT update `EmployerReview.tenantId`. Only the `reviewState` field changes. The audit row's `tenantId` reflects the caller's tenant (= the resource's tenant on the success path). |

### 4.5 `share-packet`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** (recap) | A === B |
| **Workflow legitimacy requirement** (recap) | `reviewState !== 'archived'`; token entropy ≥ 128 bits; token bound to single `entityId`; token has expiry |
| **Audit requirement** | One audit row paired with share-artifact (e.g., `ApplyShare`) insert. `action: 'employer_review.share_packet'`; `subjectId: entityId`; `metadata.tokenRef` records the **token reference** (e.g., `tokenId` or `tokenHash`), NEVER the secret. |
| **Denial semantics** | Archived → 422 + denied audit. Readonly POST → 403 + denied audit. |
| **Readonly behavior** | Readonly POST → 403 + denied audit. |
| **Tenant-boundary guarantee** | Share artifact's `tenantId` AND audit row's `tenantId` both = `requestingTenantId`. The token itself is bound to (`entityId`, `tenantId`); downstream public read is a separate flow that does NOT bypass tenant boundaries (out of W2-PR2B scope). |

---

## 5. The atomic-write helper (proposed conceptual signature)

Per `w2-pr2-mutation-semantics.md` §6 (and as referenced from the lock §5), the implementation MAY introduce a thin internal helper:

```
async function atomicMutateWithAudit<T>(args: {
  prisma: PrismaClient;
  resource: { update: (tx: TransactionClient) => Promise<T> };
  auditEvent: AuditEventInput;
}): Promise<T>;
```

It opens a single `prisma.$transaction((tx) => ...)`, calls `resource.update(tx)`, then `tx.auditEvent.create({ data: auditEvent })`. Either failure rolls back both. The success returns the resource.

This helper is **internal to the route file or co-located with `requireOwnedEmployerReview`**, NOT exported as a generic utility. It is consumed by exactly the five mutating actions in W2-PR2B. A future PR may extract it once a second domain has a similar shape; W2-PR2B does not.

If the implementer prefers inline `prisma.$transaction((tx) => { ... })` blocks at each action, that is also acceptable. The helper is a convenience, not a contract — the contract is "atomic mutation+audit." Either form satisfies it.

---

## 6. Redacted-payload-hash construction

The `payloadHash` is computed from the request body with these steps:

```
1. Read body as JSON; if not JSON or empty, treat as `{}`.
2. Strip forbidden ownership fields: tenantId, orgId, org_id, tenant_id, org, org_slug, verifier_org, tenant, tenant_slug.
3. Canonicalize JSON: sorted keys, no insignificant whitespace.
4. Compute SHA-256 of the canonical bytes.
5. Hex-encode the digest.
```

The hash is computed once per request. It is included in the audit row. It is NOT included in the response.

For Edge runtime compatibility (per `CLAUDE.md` gotchas + W2-PR1A's TextEncoder pattern), the hash uses `crypto.subtle.digest('SHA-256', ...)` — Web Crypto, available in Edge. NOT `node:crypto`.

---

## 7. Read-action audit posture (deferred)

The lock §3 reclassifies four read actions (`view`, `acceptance-history`, `packet`, `status`). Per `OWNERSHIP_INVARIANTS.md` §6.1's "minimum-information record" caveat, audit-on-read is intended but **deferred** in W2-PR2B's scope. Reads are reclassified and ownership-checked, but they do NOT write audit rows in this wave.

Rationale: the cost of writing an audit row per read is real (DB write per GET), and the forensic value is lower than for mutations. A separate PR (W2-PR3 or W2-PR-AUDIT-READ) addresses read-audit. Until then, reads benefit from cross-tenant 404 enforcement without audit-row backing.

A future-defect to flag if implementer is tempted: **do NOT add read-audit "while we're here."** It is out of scope for W2-PR2B.

---

## 8. Failure-mode coupling matrix

For every step's failure, the audit row's existence and shape:

| Step | Failure | Wire | Audit row? | `outcome` | `action` literal pattern |
|---|---|---|---|---|---|
| 1 | No auth (browser) | 401 (redirect) | NO | — | — |
| 1 | No auth (API) | 403 | NO | — | — |
| 2 | JWT `org_id` missing | 403 + header | YES | `denied` | `'<base>.no_org_context'` |
| 2 | Role insufficient (e.g., readonly POST) | 403 | YES | `denied` | `'<base>.role_denied'` |
| 3 | DB read raised (DB unreachable) | 503 + header | best-effort log | — | — (no audit if DB is down) |
| 4 | Resource missing | 404 | YES | `denied` | `'<base>.entity_not_found'` |
| 4 | Resource cross-tenant | 404 | YES | `denied` | `'<base>.cross_tenant'` |
| 4 | Resource `tenantId` null | 500 + alert | YES | `denied` | `'<base>.data_integrity'` |
| 5 | Workflow refusal — wrong state | 422 | YES | `denied` | `'<base>.wrong_review_state'` |
| 5 | Workflow refusal — CRS<80 (accept) | 409 | YES | `denied` | `'employer_review.accept.crs_below_threshold'` |
| 5 | Workflow refusal — no prior accept (confirm-start) | 409 | YES | `denied` | `'employer_review.confirm_start.no_prior_acceptance'` |
| 5 | Workflow refusal — duplicate refresh | 409 | YES | `denied` | `'employer_review.request_refresh.duplicate_refresh_request'` |
| 5 | Workflow refusal — archived (refresh / share) | 422 | YES | `denied` | `'<base>.archived_review'` |
| 6 | Transaction failure (mutation OR audit insert fails) | 500 + alert | NO (rolled back by definition) | — | — |
| Pre-1 | Malformed `entityId` | 400 | YES | `denied` | `'<base>.malformed_resource_id'` |
| Pre-1 | Duplicate `correlationId` < 24h | 409 | NO (prior row exists) | — | — |

A handler that violates this matrix (e.g., emits an audit row on transaction failure, or fails to emit one on cross-tenant 404) is rejected at review.

---

## 9. Test coverage of audit coupling

The regression file (`employer-review-ownership.test.ts`) per `w2-pr2b-implementation-lock.md` §7 exercises:

| Test class | Cases | What is asserted about audit |
|---|---|---|
| 7.1 — Per-action ownership (5 × 4 = 20) | 20 | each success writes one permitted audit row inside the tx; each cross-tenant writes one denied audit row with `.cross_tenant` literal; each readonly POST writes one denied audit row with `.role_denied`; each no-auth case writes NO audit row |
| 7.2 — Atomicity (3) | 3 | success writes one audit row in the tx; resource-update failure rolls back the audit row; audit-write failure rolls back the resource update |
| 7.3 — Header-injection defense (3) | 3 | each forged ownership input → 404 + denied audit with `.cross_tenant` literal — the audit row's `tenantId` is the caller's, NOT the forged value |
| 7.4 — Probe resistance (2) | 2 | random `entityId` (no row) → 404 + denied audit (`.entity_not_found`); valid `entityId` cross-tenant → 404 + denied audit (`.cross_tenant`); audit literals differ even though wires match |
| 7.5 — Edge cases (5) | 5 | empty `entityId` → 400 + denied audit (`.malformed_resource_id`); overly long `entityId` → 400 + denied audit; null DB `tenantId` → 500 + alerted audit (`.data_integrity`); empty DB `tenantId` → 500 + alerted; empty JWT `org_id` → 403 + denied audit (`.no_org_context`) |
| 7.6 — Replay resistance (1) | 1 | duplicate `correlationId` within 24h → 409 + NO new audit row (prior row stands) |

The mock surface for these tests is the Prisma client and Clerk's `auth()`. Audit rows are asserted by inspecting calls on `tx.auditEvent.create`. Sub-second total runtime; deterministic.

---

## 10. Operational consequences

The audit coupling has direct ops consequences worth scoping:

- Every API response on a denied path adds a DB write (the denied audit row). Probing a tenant under load amplifies write traffic. Mitigation: rate-limiting at Layer 1 (middleware) is OUT OF SCOPE for W2-PR2B but flagged for W2-PR4. The implementer does not add rate-limiting in this wave.
- The `correlationId` UNIQUE constraint per `(actorId, 24h)` prevents duplicate audit rows but introduces a 409 path. Clients that retry without rotating the correlation ID see 409s. The implementer documents this in `w2-pr2b-implementation-summary.md`.
- The audit-row growth rate is now coupled to denied attempts. SOC alerting on denial volume becomes possible (W2-PR2B does NOT wire alerting, but the data lands in the table).

These are noted, not addressed by W2-PR2B.

---

## 11. Closing principle

Audit coupling in W2-PR2B is a single rule: **every decision the gate sequence makes — permit or deny, success or rollback — leaves a `tenantId`-stamped audit row attributable to a specific actor.** The only exceptions are pre-authentication failures (no actor exists) and rolled-back transactions (the partial state must not exist). The audit table is the wave's permanent forensic surface; nothing the route handler does is invisible to it.

**Mutations are trustable when they are atomic with their audit row. Denials are debuggable when they leave a denied audit row. Probes are visible when they emit denied rows attributed to the prober. W2-PR2B writes none of these properties from scratch — it makes them load-bearing on every employer-review mutation.**
