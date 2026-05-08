# W2-PR2B — Ownership Derivation

**Wave:** Wave 2, PR 2B — ownership-derivation scaffolding · **Date:** 2026-05-08 · **Status:** scaffolding only; **NO product code in this artifact** · **Authority:** subordinate to `OWNERSHIP_INVARIANTS.md`, `RESOURCE_OWNERSHIP_DICTIONARY.md`, `MUTATION_GATE_SEQUENCE.md` §3.3, and `w2-pr2b-implementation-lock.md` §4.

This doc defines, for each employer-review mutating action, **exactly which inputs may be used to derive ownership and which inputs must be discarded**. It is the per-action source-rule contract for Step 3 of the canonical mutation gate sequence.

The wave's largest invariant comes from this doc: **the caller cannot influence which tenant owns a resource**. Any pathway that would let a request body, header, query parameter, or cookie alter the ownership decision is a defect.

---

## 1. The two and only two inputs to the ownership decision

Per `OWNERSHIP_INVARIANTS.md` §1.4–§1.5 and the lock §4:

| Input | Trust class | Source | Used for |
|---|---|---|---|
| **A. JWT `org_id`** | TRUSTED — Clerk-signed, runtime-validated by `extractVerifierClaims` | `session.sessionClaims.vitalcv.org_id` | the **requesting** tenant (Layer 3 left-hand side) |
| **B. DB `EmployerReview.tenantId`** | TRUSTED — server-persisted at recognition time, never client-writable | `prisma.employerReview.findUnique({ where: { entityId } }).tenantId` | the **resource** tenant (Layer 3 right-hand side) |

Layer 3 (ownership) compares **A === B**. Equal → owned; not-equal → cross-tenant 404.

No other input may participate in this decision. The implementer reading this doc should treat any deviation from these two sources as a finding.

---

## 2. Forbidden ownership inputs

These inputs may NOT be consulted for ownership derivation:

| Input | Why forbidden |
|---|---|
| Request header `x-verifier-org` | Validated at Layer 1 (middleware) for a different concern (route admission); Layer 3 does NOT re-read it. The handler treats it as if absent. |
| Request body field `tenantId`, `orgId`, `org_id`, `tenant_id`, `org`, `org_slug`, `verifier_org`, `tenant`, `tenant_slug` | Client-controlled; could be forged. Discarded; logged if present. |
| Query string `?tenantId=...`, `?orgId=...` | Client-controlled. Discarded. |
| Cookies (other than the Clerk session cookie) | Client-controlled. Discarded. |
| Referer / Origin headers | Browser-controlled. Discarded. |
| URL path segment `[entityId]` | Used as the **lookup key only**, never as the owner. The owner is `EmployerReview.tenantId` after the lookup completes. |
| URL path segment `[action]` | Matched against the action allowlist, never used as ownership context. |
| Any field reflecting "the org the user is currently viewing" derived from client state | Client state is by definition untrusted; the only trusted org is `JWT.org_id`. |

If a request **contains** any of the forbidden body/query fields, the handler MUST:

1. Discard the field for ownership purposes.
2. Continue to use `JWT.org_id` and `EmployerReview.tenantId` as the only ownership sources.
3. Optionally record the discard in the request-scoped log (NOT as an audit-event row — this is operational telemetry, not a security event unless the discarded field would have changed the decision).

The handler MUST NOT:

- 400 the request because a forbidden field is present (would let a probe distinguish "field-name accepted" from "field-name rejected").
- Treat the field as a hint, alias, or override.
- Echo the field back in the response.

---

## 3. The derivation pipeline

For every mutating action, ownership is derived in the same three sub-steps inside Step 3:

```
3a. requestingTenantId = sessionClaims.vitalcv.org_id     // from JWT, validated at runtime
3b. resource           = await prisma.employerReview      // single DB lookup keyed by entityId
                              .findUnique({ where: { entityId } })
3c. resourceTenantId   = resource?.tenantId               // null-checked at Step 4
```

Sub-step 3a is identical for all five actions (and for the read reclassifications). Sub-step 3b is identical for the four entity-keyed actions; the sibling refresh-requests route substitutes `npi` lookup. Sub-step 3c is identical.

The derivation pipeline does NOT:

- Cache `resource` across requests (each request re-derives).
- Trust an in-memory tenant-resolver that reads `req.headers`.
- Read any user-table beyond the JWT's claims.
- Make a second DB lookup to "verify" the JWT's org_id (the JWT is already trusted).

---

## 4. Per-action derivation table

For each action, the derivation source rule is identical (Section 3). Differences appear in **what additional ownership relationships must be enforced** at Step 5 (workflow), **not** at Step 3 itself.

### 4.1 `accept`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** | A (`JWT.org_id`) === B (`EmployerReview.tenantId` via `entityId` lookup) |
| **Workflow legitimacy requirement** | `review.reviewState ∈ {recognized, ready_for_acceptance}` AND `clinician.crs ≥ 80` (CRS gate from `packages/domain-common/employmentGuards.ts`) |
| **Audit requirement** | Atomic with `EmployerAcceptance` insert; `action: 'employer_review.accept'`; `subjectId: entityId`; `payloadHash` SHA-256 of redacted body; `outcome: 'permitted'` on success, `'<reason>'` on denial |
| **Denial semantics** | 401/403 (no auth); 403 (`no_org_context` or readonly POST or member-not-admin); 404 (cross-tenant or entity not found); 409 (`crs_below_threshold`); 422 (`wrong_review_state`); 500 (`tenantId` null/non-string or transaction failure) |
| **Readonly behavior** | Readonly role POST returns 403 + denied audit row at Step 2; never reaches Steps 3–6 |
| **Tenant-boundary guarantee** | The created `EmployerAcceptance.tenantId` MUST be the JWT-derived `requestingTenantId`. The handler does NOT accept a `tenantId` field in the request body. The DB column is populated from `requestingTenantId`, never from `EmployerReview.tenantId` (they MUST already be equal at this point per Step 4, but persistence reads the JWT-derived value as the canonical source). |

### 4.2 `confirm-start`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** | A (`JWT.org_id`) === B (`EmployerReview.tenantId`) — AND additionally the prior `EmployerAcceptance.tenantId` must equal `requestingTenantId` (Step 5 cross-row check) |
| **Workflow legitimacy requirement** | Prior `EmployerAcceptance` exists for `entityId`; `acceptance.tenantId === requestingTenantId`; `review.reviewState ∈ {accepted, ready_for_start}` |
| **Audit requirement** | Atomic with `StartAttestation` insert; `action: 'employer_review.confirm_start'`; references prior `EmployerAcceptance.id`; `subjectId: entityId`; `payloadHash` SHA-256 of redacted body |
| **Denial semantics** | 401/403; 403 (role / no_org_context); 404 (cross-tenant or entity not found); 409 (`no_prior_acceptance` — never produced by a probe trying to "start without acceptance"); 422 (`wrong_review_state`) |
| **Readonly behavior** | Readonly POST → 403 at Step 2 |
| **Tenant-boundary guarantee** | The created `StartAttestation.tenantId` AND the referenced `EmployerAcceptance.tenantId` MUST both equal `requestingTenantId`. Cross-tenant referencing of an acceptance row owned by another org returns 404 (NOT 409 — that would leak that the acceptance row exists in a different tenant). |

**Cross-row enforcement note:** confirm-start is the only action that consults two ownership rows. The check appears at Step 5 (workflow legitimacy), not Step 3 (which only loads the primary `EmployerReview`). If the prior `EmployerAcceptance` is owned by another tenant, the handler returns 404 with `action: 'employer_review.confirm_start.cross_tenant'` — same wire as the primary cross-tenant denial, distinct audit literal for forensics.

### 4.3 `request-refresh`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** | A (`JWT.org_id`) === B (`EmployerReview.tenantId`) |
| **Workflow legitimacy requirement** | `review.reviewState !== 'archived'`; no open `RefreshRequest` row for `entityId` within the prior 24h (idempotency + rate-limit) |
| **Audit requirement** | Atomic with `RefreshRequest` insert; `action: 'employer_review.request_refresh'`; `subjectId: entityId`; `payloadHash`; `outcome: 'permitted'` |
| **Denial semantics** | 401/403; 403 (role / no_org_context); 404 (cross-tenant or entity not found); 409 (`duplicate_refresh_request`); 422 (`archived_review`) |
| **Readonly behavior** | Readonly POST → 403 at Step 2; readonly users may STILL successfully GET the resource after the read reclassification (no degradation of read access) |
| **Tenant-boundary guarantee** | `RefreshRequest.tenantId` MUST equal JWT-derived `requestingTenantId`. The downstream refresh dispatcher (separate concern; out of W2-PR2B scope) consumes `RefreshRequest.tenantId` as authoritative. |

### 4.4 `route-to-review`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** | A (`JWT.org_id`) === B (`EmployerReview.tenantId`) |
| **Workflow legitimacy requirement** | `review.reviewState ∈ allowed-routable-states` per `packages/domain-common/employmentGuards.ts` (existing state machine — W2-PR2B does NOT redefine the allowed-routable set) |
| **Audit requirement** | Atomic with `EmployerReview.reviewState` update; `action: 'employer_review.route_to_review'`; `subjectId: entityId`; the audit row records both the prior state and the new state in `payloadHash`-redacted form |
| **Denial semantics** | 401/403; 403 (role / no_org_context); 404 (cross-tenant or entity not found); 422 (`wrong_review_state`) |
| **Readonly behavior** | Readonly POST → 403 at Step 2 |
| **Tenant-boundary guarantee** | Only `EmployerReview` rows with `tenantId === JWT.org_id` may transition state. The handler does NOT update `EmployerReview.tenantId` itself — that field is set at recognition time and is immutable from this code path. |

### 4.5 `share-packet`

| Aspect | Rule |
|---|---|
| **Ownership derivation source** | A (`JWT.org_id`) === B (`EmployerReview.tenantId`) |
| **Workflow legitimacy requirement** | `review.reviewState !== 'archived'`; share token has ≥ 128 bits entropy; token is bound to a single `entityId` (no replay across resources); token has an expiry |
| **Audit requirement** | Atomic with share-artifact (e.g., `ApplyShare`) insert; `action: 'employer_review.share_packet'`; the audit row records the **token reference** (e.g., `tokenId` or `tokenHash`), NOT the secret token itself |
| **Denial semantics** | 401/403; 403 (role / no_org_context); 404 (cross-tenant or entity not found); 422 (`archived_review`) |
| **Readonly behavior** | Readonly POST → 403 at Step 2 |
| **Tenant-boundary guarantee** | The created share artifact's `tenantId` MUST equal `requestingTenantId`. Downstream public reads of the share token (when the token holder is unauthenticated) are scoped to the single `entityId` and do NOT re-derive ownership through this code path — they take a separate token-validation flow (see `w2-pr2b-mutation-flow.md` §6) which is out of W2-PR2B scope but is not weakened by this wave |

**Threat T-2 caveat:** the share-token cryptographic shape is NOT modified by W2-PR2B. If the existing token is weak (entropy below 128 bits, no expiry, replayable across resources), the handler still must enforce the workflow gate above — but a separate PR is required to harden the token itself. W2-PR2B inherits whatever shape the existing handler already produces.

---

## 5. Sibling route — `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts`

Same derivation rules with two substitutions:

| Substitution | Rule |
|---|---|
| Lookup key | `npi` (10-digit string from path) instead of `entityId` |
| Lookup query | `prisma.employerReview.findFirst({ where: { npi, tenantId: requestingTenantId } })` — cross-tenant rows return 404 the same as `[entityId]` lookup |
| Forbidden inputs | identical (no `tenantId` in body, no `?tenantId=`, no `x-verifier-org` re-read) |

The sibling route reads `RefreshRequest` history scoped to (`npi`, `requestingTenantId`). It does NOT join across tenants. Cross-tenant probes of a known NPI return 404 with `action: 'employer_review.refresh_requests.cross_tenant'`.

---

## 6. Mutation tenant-stamp invariant

For every mutation row created by W2-PR2B (`EmployerAcceptance`, `StartAttestation`, `RefreshRequest`, share-artifact), the row's `tenantId` column is populated from the **JWT-derived** `requestingTenantId`, NOT copied from `EmployerReview.tenantId`. They MUST be equal at this point (enforced by Step 4), but the canonical source is the JWT.

Why: if a future schema migration ever introduces drift between "the review's tenant" and "the acceptance's tenant," the JWT-derived stamp captures the actor's tenant unambiguously. The audit row's `tenantId` is also JWT-derived (audit-coupling §3.2), giving a single authoritative tenant per actor-action pair.

A defect that copies `EmployerReview.tenantId` into the mutation row instead of using `requestingTenantId` is rejected at review.

---

## 7. The "no client-supplied tenant" test posture

The regression file (`employer-review-ownership.test.ts` §7.3 — the header-injection defense suite) explicitly probes:

| Test | Setup | Expected |
|---|---|---|
| `x-verifier-org: <attacker org>` header set | actor in Org A; resource owned by Org B; header forged to "Org B" | 404 (handler ignores header, derives ownership from JWT.org_id = Org A) |
| `tenantId: '<resource org>'` field in body | actor in Org A; body claims to act for Org B | 404 (handler discards body field, uses JWT.org_id = Org A) |
| `?tenantId=<resource org>` query string | actor in Org A; query claims Org B | 404 (handler ignores query string) |

The tests assert the wire is 404 (not 400, not 403). If any test produces 200 or 201, the wave has a critical defect.

---

## 8. Failure semantics for ownership

Per `MUTATION_GATE_SEQUENCE.md` §3.4 + §6.2:

| Ownership-step failure | Wire | Audit |
|---|---|---|
| Resource lookup returned `null` | 404 | denied — `'<base_action>.entity_not_found'` |
| Resource lookup returned a row whose `tenantId !== requestingTenantId` | 404 | denied — `'<base_action>.cross_tenant'` |
| Resource lookup returned a row with `tenantId == null` or non-string | 500 + alert | alerted — `'<base_action>.data_integrity'` |
| Resource lookup raised an exception (DB unreachable) | 503 | best-effort log; `x-rbac-fail-closed: ownership_unresolvable` |

**Cross-tenant and entity-not-found return the same wire.** The audit literal is the only place they differ. This is non-negotiable per `OWNERSHIP_INVARIANTS.md` §6.2.

---

## 9. Ownership decision is request-scoped, deterministic, and side-effect-free

The ownership decision (Steps 3 + 4) MUST:

- Be computed fresh from `req` and the database for every request. No cached "user X owns resource Y" memoization.
- Be deterministic given (`session.userId`, `session.sessionClaims`, `entityId`, current DB state). Same inputs → same outcome.
- Be free of side effects. No "warm the cache" writes, no analytics emissions, no telemetry that varies the wire.

A handler that fails any of these properties is rejected at review.

---

## 10. Closing principle

Ownership derivation in W2-PR2B has exactly two trusted inputs: the JWT-derived `org_id` and the DB-loaded `EmployerReview.tenantId`. Every other input is discarded for ownership purposes. The five mutating actions and the sibling refresh-requests route all converge on this single derivation pipeline.

**The caller cannot tell the server which tenant they belong to. The caller cannot tell the server which tenant a resource belongs to. Both facts are derived server-side from cryptographically-trusted sources, every request, with no caching and no shortcuts.**
