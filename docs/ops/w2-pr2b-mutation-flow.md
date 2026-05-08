# W2-PR2B — Mutation Flow

**Wave:** Wave 2, PR 2B — mutation-flow scaffolding · **Date:** 2026-05-08 · **Status:** scaffolding only; **NO product code in this artifact** · **Authority:** subordinate to `MUTATION_GATE_SEQUENCE.md`, `OWNERSHIP_INVARIANTS.md`, and `w2-pr2b-implementation-lock.md`.

This doc reifies the canonical 6-step mutation gate sequence into the **request-lifecycle skeleton** that every employer-review mutating action must follow. It is shape-only; it does not contain product code. It is paired with `w2-pr2b-ownership-derivation.md` (per-action source rules) and `w2-pr2b-audit-coupling.md` (per-action audit contract).

The flow is identical for all five mutations. Differences are isolated to:

- The role threshold (step 2).
- The workflow rule (step 5).
- The mutation row shape and audit `action` literal (step 6).

---

## 1. The shape

```
Request lands at /api/employer-review/[entityId]/[action]
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Step 1 — Authenticate                              │
│   auth() → session                                 │
│   no userId → 401/403 (no audit row possible)      │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Step 2 — Validate RBAC                             │
│   extractVerifierClaims(session)                   │
│   missing org_id → 403 + audit-deny                │
│   role < required → 403 + audit-deny               │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Step 3 — Derive ownership (server-side only)       │
│   requestingTenantId = JWT.org_id                  │
│   load EmployerReview by entityId                  │
│   any client-supplied tenantId is DISCARDED        │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Step 4 — Validate ownership                        │
│   row missing → 404 + audit-deny (probe)           │
│   row.tenantId !== requestingTenantId → 404 + audit│
│   row.tenantId null/non-string → 500 + alert + aud │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Step 5 — Validate workflow legitimacy              │
│   (per-action; see §5)                             │
│   refusal → 409 or 422 + audit-deny                │
└───────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Step 6 — Atomic write + audit                      │
│   prisma.$transaction((tx) => {                    │
│     write the action's mutation row                │
│     write paired AuditEvent row                    │
│   })                                               │
│   transaction failure → 500 + rollback both        │
└───────────────────────────────────────────────────┘
        │
        ▼
   200 / 201 success response
```

Steps 1–5 are pre-conditions. Step 6 is the only step that produces persistent state. There is no path that produces a mutation row without a paired audit row, and no path that writes either row outside the transaction.

---

## 2. Step responsibilities

### 2.1 Step 1 — Authenticate

| Aspect | Rule |
|---|---|
| Source | Clerk `auth()` only |
| Output on success | `session = { userId, sessionClaims }` |
| Output on failure | `401` for browser navigation, `403` for `application/json` API calls — never both |
| Audit | None — there is no `actorId` to record |
| Tenant boundary | None established yet |

This step does not consult ownership or role. Failure here is purely "no caller identity." A request that fails this step never sees the database.

### 2.2 Step 2 — Validate RBAC

| Aspect | Rule |
|---|---|
| Source | `extractVerifierClaims(session.sessionClaims)` from W2-PR1A |
| Output on success | `{ orgId, teamRole }` (both runtime-validated, no `as` casts) |
| Output on failure | `403` + audit-deny with `outcome: 'denied'` |
| Required role per action | `accept`, `confirm-start` → `admin`+ ; `request-refresh`, `route-to-review`, `share-packet` → `member`+ |
| Audit row `action` field | `'<base_action>.no_org_context'` or `'<base_action>.role_denied'` |
| Tenant boundary | `requestingTenantId` is now known but resource is not yet loaded |

A request that lacks `org_id` cannot proceed even if the role would otherwise permit. Readonly-role POST attempts are explicitly denied here (W2-PR1 already enforces; W2-PR2B preserves the contract).

### 2.3 Step 3 — Derive ownership

| Aspect | Rule |
|---|---|
| Sources | `requestingTenantId = sessionClaims.vitalcv.org_id` ; `resource = await prisma.employerReview.findUnique({ where: { entityId } })` |
| Forbidden inputs | `x-verifier-org` header; request body `tenantId` / `orgId` / `org_id` / `org_slug` / `verifier_org` ; query string `?tenantId=` ; cookies |
| Discard policy | If a forbidden field is present, log it; do NOT use it as a key |
| Trusted JWT | `sessionClaims.vitalcv.org_id` (Clerk-signed) |
| Trusted DB | `EmployerReview.tenantId` (server-persisted at recognition time, NOT writable by the caller) |
| Audit emission | None — derivation is internal; the next step decides outcome |

Derivation is **always** server-side. The client cannot influence which tenant owns a resource by attaching headers, body fields, or query parameters. This is the wave's single largest invariant.

### 2.4 Step 4 — Validate ownership

| Failure | Wire | Header | Audit `action` |
|---|---|---|---|
| Row missing in DB | 404 | — | `'<base_action>.entity_not_found'` |
| Row owned by different tenant | 404 | — | `'<base_action>.cross_tenant'` |
| `row.tenantId` null or non-string | 500 | internal alert | `'<base_action>.data_integrity'` |
| DB read fails | 503 | `x-rbac-fail-closed: ownership_unresolvable` | best-effort log if no DB |

Cross-tenant and entity-not-found return the **same wire** (404 + empty body). This is enumeration resistance per `OWNERSHIP_INVARIANTS.md` §6.2. A client cannot distinguish "no such entity" from "entity exists but is owned by another tenant."

The audit row, however, distinguishes them with separate `action` literals so SOC analysts can cluster probes.

### 2.5 Step 5 — Validate workflow legitimacy

Workflow rules per action (read from existing domain code; W2-PR2B does NOT redefine them):

| Action | Workflow rule | Source of truth |
|---|---|---|
| `accept` | `reviewState ∈ {recognized, ready_for_acceptance}` AND `clinician.crs ≥ 80` | `packages/domain-common/employmentGuards.ts` (CRS gate) + existing review-state machine |
| `confirm-start` | prior `EmployerAcceptance` exists for entity AND `acceptance.tenantId === requestingTenantId` AND `reviewState ∈ {accepted, ready_for_start}` | `packages/domain-common/employmentGuards.ts` (canonical-path Recognition → Acceptance → Start) |
| `request-refresh` | `reviewState !== 'archived'` AND no open `RefreshRequest` for entity within 24h | existing `RefreshRequest` model + state machine |
| `route-to-review` | `reviewState ∈ allowed-routable-states` per `employmentGuards.ts` | existing state machine |
| `share-packet` | `reviewState !== 'archived'` AND share-token entropy ≥ 128 bits AND token bound to single `entityId` | existing share artifact model |

| Failure | Wire | Audit `action` |
|---|---|---|
| Wrong review state | 422 | `'<base_action>.wrong_review_state'` |
| CRS < 80 (accept only) | 409 | `'employer_review.accept.crs_below_threshold'` |
| No prior acceptance (confirm-start only) | 409 | `'employer_review.confirm_start.no_prior_acceptance'` |
| Open refresh within 24h (request-refresh only) | 409 | `'employer_review.request_refresh.duplicate'` |
| Other domain refusal | 422 | `'<base_action>.<gate_name>'` |

The handler does NOT introduce new workflow rules. If a rule isn't already in `employmentGuards.ts` or the existing state machine, it cannot be enforced here.

### 2.6 Step 6 — Atomic write + audit

| Aspect | Rule |
|---|---|
| Boundary | `prisma.$transaction(async (tx) => { ... })` |
| Order within tx | mutation row → audit row (or audit-then-mutation; either is acceptable as long as both fall on the same `tx` and a failure rolls back both) |
| Mutation row | per-action shape, unchanged from existing schema |
| Audit row | `AuditEvent` per `w2-pr2b-audit-coupling.md` §3 |
| `outcome` field | `'permitted'` for the success path |
| Failure | 500 + both rows roll back; no audit emitted (the partial state must not exist) |

A common implementer mistake: writing the audit row OUTSIDE the transaction "for safety" or "for observability." This is **forbidden** — see `MUTATION_GATE_SEQUENCE.md` §5. Audit-write disjointness produces "ghost mutations" with no audit trail and "ghost audits" referencing rolled-back state. Both are defects.

---

## 3. The atomic mutation+audit semantics

Two failure modes the transaction is required to defeat:

### 3.1 Mutation succeeds, audit fails → both must roll back

If the audit insert fails (e.g., `correlationId` UNIQUE constraint, `tenantId` mismatch, downstream DB hiccup), the transaction aborts and the mutation row never persists. The handler returns 500. The caller sees no success.

This is non-negotiable. A persisted mutation without an audit trail is a constitutional violation per `OWNERSHIP_INVARIANTS.md` §6.1.

### 3.2 Audit succeeds, mutation fails → both must roll back

If the mutation insert fails (constraint violation, race, etc.), the transaction aborts and the audit row never persists. Otherwise the database accumulates "denied-but-not-really" audit rows that confuse forensics.

Test 7.2 in the regression file (`employer-review-ownership.test.ts` §7.2) explicitly verifies both directions.

### 3.3 The transaction must not leak across HTTP boundaries

If the route handler spawns any concurrent work (background fetches, queue dispatches, downstream HTTP calls), that work happens **outside** the transaction or **after** it commits. The transaction does not wait on external systems. External system failure must not block the audit write.

### 3.4 Idempotency keys

Per `MUTATION_GATE_SEQUENCE.md` §3.6:

| Action | Idempotency anchor |
|---|---|
| `accept` | UNIQUE(`entityId`) on `EmployerAcceptance` (one acceptance per entity) — or UNIQUE(`entityId, tenantId`) if multi-org acceptance is meaningful (decision pinned in W2-PR2B implementation summary) |
| `confirm-start` | references prior `EmployerAcceptance.id`; UNIQUE(`acceptanceId`) on `StartAttestation` |
| `request-refresh` | "no open `RefreshRequest` within 24h" guard (workflow gate); also UNIQUE(`entityId, decidedAt`) for paranoia |
| `route-to-review` | state machine enforces idempotency (the transition itself is the anchor) |
| `share-packet` | UNIQUE(`entityId, tenantId`) on `ApplyShare` per active token; old tokens superseded, not duplicated |

Replay-resistance also enforced at the audit layer via `correlationId` uniqueness within 24h per actor (audit-coupling §4).

---

## 4. Per-action HTTP contract recap

The 6-step shape with per-action thresholds:

### 4.1 `accept`

```
Step 1: auth()
Step 2: role ≥ admin
Step 3: requestingTenantId = JWT.org_id; load EmployerReview by entityId
Step 4: review.tenantId === requestingTenantId
Step 5: review.state ∈ {recognized, ready_for_acceptance}; clinician.crs ≥ 80
Step 6: tx { insert EmployerAcceptance + insert AuditEvent('employer_review.accept') }
Response: 201 { id, decidedAt }
```

### 4.2 `confirm-start`

```
Step 1: auth()
Step 2: role ≥ admin
Step 3: requestingTenantId = JWT.org_id; load EmployerReview by entityId
Step 4: review.tenantId === requestingTenantId
Step 5: prior EmployerAcceptance exists; acceptance.tenantId === requestingTenantId; review.state ∈ {accepted, ready_for_start}
Step 6: tx { insert StartAttestation(referencing acceptance.id) + insert AuditEvent('employer_review.confirm_start') }
Response: 201 { id, startedAt }
```

### 4.3 `request-refresh`

```
Step 1: auth()
Step 2: role ≥ member
Step 3: requestingTenantId = JWT.org_id; load EmployerReview by entityId
Step 4: review.tenantId === requestingTenantId
Step 5: review.state !== 'archived'; no open RefreshRequest for entity within 24h
Step 6: tx { insert RefreshRequest + insert AuditEvent('employer_review.request_refresh') }
Response: 201 { id, requestedAt }
```

### 4.4 `route-to-review`

```
Step 1: auth()
Step 2: role ≥ member
Step 3: requestingTenantId = JWT.org_id; load EmployerReview by entityId
Step 4: review.tenantId === requestingTenantId
Step 5: review.state ∈ allowed-routable-states (per employmentGuards.ts)
Step 6: tx { update EmployerReview.reviewState + insert AuditEvent('employer_review.route_to_review') }
Response: 200 { entityId, newState }
```

### 4.5 `share-packet`

```
Step 1: auth()
Step 2: role ≥ member
Step 3: requestingTenantId = JWT.org_id; load EmployerReview by entityId
Step 4: review.tenantId === requestingTenantId
Step 5: review.state !== 'archived'; entropy ≥ 128 bits; token bound to single entityId
Step 6: tx { insert ApplyShare(entityId, tenantId, tokenRef) + insert AuditEvent('employer_review.share_packet', records tokenRef NOT secret) }
Response: 201 { tokenRef, expiresAt } (the secret is delivered out-of-band per existing share-link UX; W2-PR2B does NOT change that)
```

---

## 5. Workflow-failure behavior (per `MUTATION_GATE_SEQUENCE.md` §3.5 + §3.6)

A workflow refusal is NOT a security failure — the caller is authenticated, RBAC-permitted, and ownership-confirmed. The refusal is "this request is well-formed, but the resource is in a state that does not permit this verb."

| Aspect | Rule |
|---|---|
| HTTP code | 409 (state conflict) or 422 (semantic refusal); never 403 (which would mis-signal an authorization failure) |
| Body | `{ "error": "<gate_name>", "detail": "..." }` — informative; the caller is permitted to know what the workflow gate said |
| Audit | YES — `'<base_action>.<gate_name>'` with `outcome: 'denied'`. Workflow-denied rows accumulate on the resource's audit timeline so future reviewers can see the rejected attempts |
| Side effects | None — the mutation row is not written; only the denied-attempt audit row |

This is intentionally distinct from cross-tenant 404 (which leaks NO information) because workflow refusals are a UX feature, not a security probe.

---

## 6. Read-action reclassification (out-of-band from the mutation flow)

The lock §3 also reclassifies four read actions. Their flow is shorter — only steps 1, 3, 4 apply (no role gate beyond authenticated, no workflow, no atomic write):

```
GET /api/employer-review/[entityId]/{view, acceptance-history, packet, status}

Step 1: auth()
Step 3: requestingTenantId = JWT.org_id; load EmployerReview by entityId
Step 4: review.tenantId === requestingTenantId  → 404 if not
Respond with the read shape
```

Reads do NOT write audit rows in W2-PR2B (audit-on-read is deferred to a later wave per `OWNERSHIP_INVARIANTS.md` §6.1's "minimum-information record" caveat — implementation deferred). Reads still respect the cross-tenant 404 rule.

The share-token public-read variant (if implemented) is a separate flow:

```
GET /api/employer-review/[entityId]/view?shareToken=...

Step 0: validate token (entropy, expiry, single-entity binding)
Respond with the public-share shape (NO authenticated reads, NO ownership comparison)
```

W2-PR2B does not introduce the public-share path. If the existing handler has both paths conflated, the implementer documents which path is active and defers the split to a future PR.

---

## 7. Denial wire summary (the matrix the regression test locks)

| Failure (in step order) | Wire | Body | Header | Audit row written? |
|---|---|---|---|---|
| (1) No Clerk session — browser | 401 (sign-in redirect) | — | — | NO |
| (1) No Clerk session — API | 403 | empty | — | NO |
| (2) JWT org_id missing | 403 | empty | `x-rbac-fail-closed: no_org_context` | YES (denied) |
| (2) Role insufficient (e.g., readonly POST) | 403 | empty | — | YES (denied) |
| (3+4) Resource missing in DB | 404 | empty | — | YES (denied — `entity_not_found`) |
| (4) Resource owned by other tenant | 404 | empty | — | YES (denied — `cross_tenant`) |
| (4) Resource `tenantId` null | 500 | empty | internal alert | YES (alerted) |
| (4) DB read fails | 503 | empty | `x-rbac-fail-closed: ownership_unresolvable` | best-effort |
| (5) Workflow refuses (e.g., wrong state) | 422 | `{ "error": "<gate_name>" }` | — | YES (denied) |
| (5) CRS < 80 (accept) | 409 | `{ "error": "crs_below_threshold" }` | — | YES (denied) |
| (5) No prior acceptance (confirm-start) | 409 | `{ "error": "no_prior_acceptance" }` | — | YES (denied) |
| (5) Open refresh < 24h (request-refresh) | 409 | `{ "error": "duplicate_refresh_request" }` | — | YES (denied) |
| (6) Atomic transaction fails | 500 | empty | internal alert | NO (must roll back) |
| Malformed `entityId` | 400 | `{ "error": "malformed_resource_id" }` | — | YES (denied) |
| Duplicate `correlationId` within 24h | 409 | `{ "error": "duplicate_request" }` | — | NO (prior row already exists) |

**Lock the wire codes.** A 403 emitted on cross-tenant is a defect (leaks tenant existence). A 200 emitted with no audit row is a defect (lost trail). A 500 with a persisted mutation row is a defect (broken atomicity).

---

## 8. Implementer's runtime checklist (the per-handler spine)

For each of the five mutating action branches, the handler body is shaped exactly:

1. Call the helper: `const result = await requireOwnedEmployerReview(req, entityId, { requireRole: <action's role> });`
2. Narrow on `result.ok`: if false, return `result.response`.
3. Compute the workflow check inline (or via existing domain helper). On refusal, write the denied audit row and return the workflow wire.
4. Build the redacted payload-hash + correlation ID.
5. Open `prisma.$transaction(async (tx) => { ... })`:
   - Insert the mutation row.
   - Insert the audit row (`outcome: 'permitted'`).
6. Return the success wire.
7. Handler-level catch on `Error`: respond 500 with internal alert; transaction rolled back.

A handler that follows this spine for all five actions, with only the per-action variations described in §4, is the W2-PR2B implementation.

---

## 9. Closing principle

The mutation flow is the canonical 6-step gate sequence applied to the employer-review domain. It admits no shortcut. It admits no client-supplied tenant identity. It admits no audit-disjoint mutation. It admits no 403-for-cross-tenant.

**Every employer-review mutation is exactly six steps in exactly this order.** Differences across the five actions are isolated to the role threshold, the workflow rule, and the row shape — never to the gate sequence itself.
