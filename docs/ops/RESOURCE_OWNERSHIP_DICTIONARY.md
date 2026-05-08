# VitalCV Resource Ownership Dictionary

**Version:** 2026-05-07 · **Status:** constitutional · **Authority:** subordinate to `OWNERSHIP_INVARIANTS.md` and `AUTHORIZATION_LAYERS.md`; supersedes per-PR ownership claims that contradict the rows below.

This document is the **canonical ownership topology** for VitalCV resources. Every resource that participates in a multi-tenant or multi-subject flow must appear here with explicit ownership semantics. New resources are added by appending; existing rows are not deleted without founder approval.

This is the **authoritative** ownership map. When a route handler or service consults "who owns this resource?", it consults this dictionary.

---

## Defined per resource

For every row below, the following fields are explicit and load-bearing:

| Field | Definition |
|---|---|
| **Canonical owner** | The single party that is the row's authoritative owner. Singular — no joint ownership. |
| **Tenant scope** | Whether the resource is tenant-scoped (multi-tenant), subject-scoped (per-clinician), or system-scoped (no tenant). |
| **Visibility scope** | Who is permitted to read the resource. May be broader than the owner (e.g., share-token recipients). |
| **Mutation authority** | Who is permitted to mutate. Always a subset of (or equal to) the owner. |
| **Readonly visibility** | Whether `readonly` team-role members of the owning tenant may read. |
| **Audit sensitivity** | Whether reads / mutations require an `AuditEvent` record. |
| **Workflow coupling** | Which workflow domain the resource participates in (canonical path / issuer chain / invitation lifecycle / none). |
| **Ownership derivation source** | How the row's owner is established at write time. Must be server-derived. |
| **Ownership failure behavior** | The HTTP response when an ownership check fails. |

**Owner / Controller / Viewer / Mutator / Workflow authority** are the five role-types per resource:

- **Owner** — the persistent identity field on the row.
- **Controller** — the actor entitled to take actions ON the row (often == owner; may be delegated).
- **Viewer** — the actor entitled to read the row.
- **Mutator** — the actor entitled to write the row.
- **Workflow authority** — the actor whose decisions advance the row's state.

---

## Resource rows

### 1. EmployerReview

| Field | Value |
|---|---|
| **Canonical owner** | Verifier org (the employer organization that initiated the review) |
| **Owner** | `EmployerReview.tenantId` (= verifier-org's `org_id`) |
| **Controller** | `member`+ team-role within the owning org |
| **Viewer** | `readonly`+ team-role within the owning org; the clinician (subject) for own redacted shape; share-token recipient if a share artifact is generated |
| **Mutator** | Same as Controller for state changes; `admin`+ for finalization actions (accept / confirm-start) |
| **Workflow authority** | The owning org's verifier team — actions are bounded by review state and CRS gate |
| **Tenant scope** | Verifier-org tenant-scoped |
| **Visibility scope** | Within owning org + share-token-bearing clinician |
| **Audit sensitivity** | All mutations atomic with `AuditEvent`; reads minimum-info |
| **Workflow coupling** | Canonical path (Recognition → Acceptance → Start) — review precedes acceptance |
| **Ownership derivation** | `tenantId` set at row-creation from the requesting verifier-org's JWT claim |
| **Ownership failure** | 404 cross-tenant; 503 if DB unresolvable; 500 if `tenantId` is null on the row |
| **RBAC role** | `admin`+ for accept/confirm-start; `member`+ for routing/refresh; `readonly`+ for read |
| **Ownership** | tenant_id == JWT.org_id |
| **Workflow legitimacy** | Review state permits the requested action; CRS ≥ 80 for accept |

### 2. Invitation (VerifierInvitation)

| Field | Value |
|---|---|
| **Canonical owner** | Issuing verifier org |
| **Owner** | `VerifierInvitation.tenantId` (= issuing-org's `org_id`); set at invitation creation |
| **Controller** | `admin`+ of issuing org for create / revoke; the **invited user** for one-time accept |
| **Viewer** | `admin`+ within issuing org; the invitee with the invitation code (out-of-band knowledge) |
| **Mutator** | `admin`+ of issuing org for create / revoke; the invitee at accept-time (one-time) |
| **Workflow authority** | Invitation lifecycle (pending → accepted | revoked | expired) — terminal states are immutable |
| **Tenant scope** | Verifier-org tenant-scoped |
| **Visibility scope** | Within issuing org for state queries; the invitee for the accept token |
| **Audit sensitivity** | All mutations atomic with `AuditEvent`; create / revoke / accept all audited |
| **Workflow coupling** | Invitation lifecycle (separate from canonical path) |
| **Ownership derivation** | `tenantId` at row-creation = creating actor's JWT org; verified at accept by code → row lookup |
| **Ownership failure** | 404 cross-tenant; 410 expired/revoked; 409 already-accepted |
| **RBAC role** | `admin`+ for create / revoke; the invited userId for accept |
| **Ownership** | tenantId == JWT.org_id (for create / revoke); code → row → invitee email matches accepting userId (for accept) |
| **Workflow legitimacy** | Invitation in `pending` state permits accept; non-`pending` returns 410/409 |

### 3. VerifierAction

A `VerifierAction` row records a discrete action taken by a verifier org member against a review (accept / refresh-request / route-to-review / share-packet / confirm-start).

| Field | Value |
|---|---|
| **Canonical owner** | Verifier org of the acting team-member |
| **Owner** | `VerifierAction.tenantId` (= acting-org's `org_id`); set at row-creation |
| **Controller** | The action's `actorId` (the team-member who took the action) |
| **Viewer** | `readonly`+ within the owning org; ADMIN role for cross-tenant audit |
| **Mutator** | None — actions are immutable once recorded. Corrections are new rows referencing the original. |
| **Workflow authority** | Issued by the route handler; not mutated by users |
| **Tenant scope** | Verifier-org tenant-scoped |
| **Visibility scope** | Owning org's audit + the affected EmployerReview |
| **Audit sensitivity** | The action IS an audit-relevant record; itself paired with an `AuditEvent` row |
| **Workflow coupling** | Tied to the EmployerReview lifecycle |
| **Ownership derivation** | At row-creation, `tenantId = JWT.org_id` of the actor; reviewed at insert against the EmployerReview's tenantId (must match) |
| **Ownership failure** | 404 cross-tenant; the action cannot be recorded across tenants |
| **RBAC role** | varies by action (admin+ for accept; member+ for routing) |
| **Ownership** | actor's tenantId == EmployerReview.tenantId |
| **Workflow legitimacy** | Action is permitted in the review's current state |

### 4. AuditEvent

| Field | Value |
|---|---|
| **Canonical owner** | The acting tenant (the org or subject whose actor took the action) |
| **Owner** | `AuditEvent.tenantId` (= acting JWT's org_id) |
| **Controller** | None for content — append-only schema. `ADMIN` role for read access. |
| **Viewer** | `ADMIN` `UserRoleType` only; cross-tenant reads require explicit per-row authorization (out-of-scope today) |
| **Mutator** | None — `AuditEvent` is append-only. There is no `UPDATE`, no `DELETE`. Corrections via new rows with `correctsEventId`. |
| **Workflow authority** | The route handler that produced the event; the event itself does not transition |
| **Tenant scope** | The acting tenant; cross-tenant reads forbidden by default |
| **Visibility scope** | `ADMIN` role within the recorded tenant; nothing across tenants |
| **Audit sensitivity** | The row IS the audit. Read of audit is itself audited (recursive — but bounded by ADMIN gate). |
| **Workflow coupling** | None — audit is orthogonal to workflow |
| **Ownership derivation** | At row-creation, `tenantId = JWT.org_id` (or `subjectId = JWT.userId` for subject-scoped events); never set from request body |
| **Ownership failure** | 404 cross-tenant; never deletable |
| **RBAC role** | `ADMIN` for read; everyone for write (system writes from route handlers) |
| **Ownership** | row.tenantId == JWT.org_id (for tenant-scoped events) |
| **Workflow legitimacy** | n/a — append-only |

### 5. CredentialArtifact

A `CredentialArtifact` represents a single credential entry attached to a clinician (e.g., a state license, a board certification, an employment record).

| Field | Value |
|---|---|
| **Canonical owner** | Clinician (subject) |
| **Owner** | `CredentialArtifact.subjectId` (= clinician's `userId`) |
| **Controller** | The clinician for self-attested entries; the system for source-fetched entries |
| **Viewer** | The clinician (full); a verifier org with an active `EmployerReview` for that clinician (redacted per the review's scope); a public proof-pack share recipient (further redacted) |
| **Mutator** | The clinician for self-attested fields; the ingest system for source-fetched fields |
| **Workflow authority** | Trust-state engine derives state transitions; clinician for accept-into-profile actions on suggestions |
| **Tenant scope** | Subject-scoped (the clinician) |
| **Visibility scope** | Clinician + entitled verifier orgs + share-token recipients |
| **Audit sensitivity** | Mutations atomic with `AuditEvent` (subject-scoped) |
| **Workflow coupling** | Knowledge inbox + canonical path (credentials are the inputs to Recognition) |
| **Ownership derivation** | `subjectId` at write time from the clinician's JWT (for self-actions) or the ingest system's binding to NPI (for source-fetched) |
| **Ownership failure** | 404 if not own; verifier-org reads require an active EmployerReview tying the verifier's tenant to the clinician's subject |
| **RBAC role** | `CLINICIAN` for self-mutations; `VERIFIER` `member`+ for read-with-review |
| **Ownership** | subjectId == JWT.userId (clinician); OR EmployerReview links verifier-tenant to clinician-subject (verifier read) |
| **Workflow legitimacy** | State transitions per the trust-state engine; not user-arbitrated |

### 6. Passport

| Field | Value |
|---|---|
| **Canonical owner** | Clinician (subject) |
| **Owner** | `Passport.subjectId` / `Passport.npi` (= clinician's NPI binding via Clerk publicMetadata) |
| **Controller** | None for direct mutation — Passport is the aggregate; underlying credentials are mutated, Passport is read |
| **Viewer** | Clinician (full); verifier orgs (redacted via active EmployerReview); public share-token recipients (further redacted, e.g., `/p/[slug]`) |
| **Mutator** | None — Passport is computed from underlying CredentialArtifact + sourceCoverage rows. The aggregate itself is not directly written. |
| **Workflow authority** | Trust-state engine + readiness engine (computes the score / level / band) |
| **Tenant scope** | Subject-scoped |
| **Visibility scope** | Clinician + entitled verifier orgs + public-share token recipients |
| **Audit sensitivity** | Reads minimum-info; the Passport's *underlying* mutations are audited at the credential level |
| **Workflow coupling** | Canonical path (Recognition's input) + readiness engine |
| **Ownership derivation** | `subjectId` from underlying NPI binding |
| **Ownership failure** | 404 (cross-subject) for direct passport reads outside the public-share path; 404 (no entitlement) for verifier-side reads without an EmployerReview |
| **RBAC role** | `CLINICIAN` for own; `VERIFIER` `member`+ for review-bound |
| **Ownership** | subjectId == JWT.userId; OR active EmployerReview links verifier to subject |
| **Workflow legitimacy** | Computed from underlying inputs; not user-arbitrated |

### 7. VerificationBundle

A `VerificationBundle` is the structured output of a verifier-side review (e.g., the redacted-evidence packet shared with the clinician, or the export bundle generated for compliance).

| Field | Value |
|---|---|
| **Canonical owner** | Verifier org (the producing org) |
| **Owner** | `VerificationBundle.tenantId` (= producing verifier-org) |
| **Controller** | `admin`+ within the producing org |
| **Viewer** | Within producing org; the receiving subject (clinician) if explicitly shared; the receiving employer-org if the bundle is for a downstream verification |
| **Mutator** | The producing org (write at creation; updates only via revoke / supersede actions) |
| **Workflow authority** | Bundle lifecycle (active / revoked / superseded); revoke action is `admin`+ |
| **Tenant scope** | Verifier-org tenant-scoped |
| **Visibility scope** | Producing org + named recipients (subject and/or downstream tenant) |
| **Audit sensitivity** | All mutations + revocations atomic with `AuditEvent` |
| **Workflow coupling** | Tied to a parent EmployerReview or VerificationRequest |
| **Ownership derivation** | At creation, `tenantId = JWT.org_id` |
| **Ownership failure** | 404 cross-tenant for direct reads; 404 for non-recipient reads without a share-token |
| **RBAC role** | `admin`+ for create / revoke; `member`+ for read |
| **Ownership** | tenantId == JWT.org_id (producing-org reads); OR subjectId named in bundle == JWT.userId (subject reads); OR share-token validates (recipient reads) |
| **Workflow legitimacy** | Bundle in `active` state for emit; revoke transitions to `revoked` |

### 8. VerificationRequest (IssuerRequest)

| Field | Value |
|---|---|
| **Canonical owner** | Issuer org |
| **Owner** | `IssuerRequest.tenantId` (= issuer-org's id) |
| **Controller** | Issuer-org `admin`+ for state transitions |
| **Viewer** | Within issuing issuer-org; the verifier org reading the wrapped issuer response (redacted shape — sees the response status, not the issuer-internal state) |
| **Mutator** | Issuer-org `admin`+ |
| **Workflow authority** | Issuer-side workflow (`requested` → `responded` → various review states) |
| **Tenant scope** | Issuer-org tenant-scoped |
| **Visibility scope** | Issuing issuer-org + verifier-org wrapped-response read |
| **Audit sensitivity** | All state transitions atomic with `AuditEvent` |
| **Workflow coupling** | Issuer chain (request → response → policy review → receipt candidate → PSV receipt) |
| **Ownership derivation** | At creation, `tenantId = issuer-org's JWT org_id`; consent artifact links to subject |
| **Ownership failure** | 404 cross-tenant |
| **RBAC role** | issuer-org `admin`+ |
| **Ownership** | tenantId == JWT.org_id (issuer side); the response wrapping for verifier carries no ownership claim — it's a redacted view |
| **Workflow legitimacy** | State permits the requested transition; consent artifact present |

### 9. AcceptanceAction (EmployerAcceptance / Acceptance)

| Field | Value |
|---|---|
| **Canonical owner** | Verifier org (accepting-org) |
| **Owner** | `EmployerAcceptance.tenantId` (= accepting-org's `org_id`) |
| **Controller** | None post-creation — Acceptance is **immutable**. Corrections via revoke + new acceptance. |
| **Viewer** | Within accepting org; the accepted clinician (their own); ADMIN cross-tenant audit |
| **Mutator** | The route handler at `POST /api/employer-review/[entityId]/accept`; never updated |
| **Workflow authority** | The acceptance gate itself — no further state transitions |
| **Tenant scope** | Verifier-org tenant-scoped |
| **Visibility scope** | Accepting org + the clinician |
| **Audit sensitivity** | Mandatory — atomic with `AuditEvent`; the row is canonical-path load-bearing |
| **Workflow coupling** | Canonical path (Acceptance → StartAttestation) |
| **Ownership derivation** | At creation, `tenantId = accepting-org JWT.org_id`; references parent EmployerReview |
| **Ownership failure** | 404 cross-tenant; immutable thereafter |
| **RBAC role** | `admin`+ at creation |
| **Ownership** | tenantId == JWT.org_id at creation; cross-tenant reads return 404 |
| **Workflow legitimacy** | Parent EmployerReview state permits acceptance; CRS ≥ 80 |

### 10. PolicyReview (PolicyReviewDecision)

| Field | Value |
|---|---|
| **Canonical owner** | Issuer org |
| **Owner** | `PolicyReviewDecision.tenantId` (= issuer-org id; derived from parent ReceiptCandidate) |
| **Controller** | issuer-org `policy_reviewer` / `credentialing_committee` / `compliance_officer` actors |
| **Viewer** | Issuing issuer-org's audit role; verifier-org sees only the resulting receipt-candidate state (downstream) |
| **Mutator** | The route handler that records the decision; immutable thereafter |
| **Workflow authority** | The 5-gate flow in `policyReview.ts` (`accept_candidate` requires `ready_for_policy_review`; etc.) |
| **Tenant scope** | Issuer-org tenant-scoped |
| **Visibility scope** | Issuing issuer-org |
| **Audit sensitivity** | Mandatory; row carries `reviewerActorId` (never empty); `automatedPolicyEngine: false` literal |
| **Workflow coupling** | Issuer chain |
| **Ownership derivation** | Parent ReceiptCandidate's tenantId; reviewerActorId from JWT |
| **Ownership failure** | 404 cross-tenant; 403 if `reviewerActorId` would be empty |
| **RBAC role** | reviewer roles only |
| **Ownership** | parent tenantId == JWT.org_id |
| **Workflow legitimacy** | All 5 gates pass |

### 11. ReadinessSnapshot

A `ReadinessSnapshot` is a point-in-time computation of a clinician's CRS / readiness state.

| Field | Value |
|---|---|
| **Canonical owner** | Clinician (subject) |
| **Owner** | `ReadinessSnapshot.subjectId` (= clinician's NPI / userId) |
| **Controller** | None — snapshots are immutable, machine-generated |
| **Viewer** | Clinician (full); verifier orgs (via active EmployerReview); public share-token recipients (redacted — score and band only, no underlying gaps) |
| **Mutator** | The readiness engine; never user-modified |
| **Workflow authority** | The CRS engine + the licensure-cap layer (`packages/crs/CrsEngine.ts`) |
| **Tenant scope** | Subject-scoped |
| **Visibility scope** | Clinician + entitled verifier orgs |
| **Audit sensitivity** | Mutations atomic with subject-scoped `AuditEvent` (the readiness recomputation event) |
| **Workflow coupling** | Trust-state engine (input to canonical path's Recognition) |
| **Ownership derivation** | `subjectId` from the underlying NPI binding |
| **Ownership failure** | 404 cross-subject; 404 for verifier reads without an active EmployerReview |
| **RBAC role** | `CLINICIAN` for own; `VERIFIER` for review-bound |
| **Ownership** | subjectId == JWT.userId; OR active EmployerReview links verifier to subject |
| **Workflow legitimacy** | Computed deterministically; user actions cannot directly transition |

---

## RBAC role vs ownership vs workflow legitimacy — explicit distinction

These three are routinely conflated. Each row above carries all three. They are NOT the same:

- **RBAC role:** what role-tier the actor holds (`readonly` / `member` / `admin` / `owner` / `CLINICIAN` / `VERIFIER` / `ISSUER` / `ADMIN`). Decided from the JWT.
- **Ownership:** whether the actor's tenant or subject scope includes the resource. Decided from the persisted row's `tenantId` / `subjectId` compared against the JWT-derived value.
- **Workflow legitimacy:** whether the requested state transition is permitted given the resource's current state. Decided from the resource's persisted state and the requested action.

Skipping any one of these is a defect. They compose:

```
RBAC says you CAN take this kind of action in general.
Ownership says you CAN take this action ON THIS resource.
Workflow says THIS action ON THIS resource IS PERMITTED RIGHT NOW.
```

A handler that checks RBAC alone is exploitable across tenants.
A handler that checks ownership alone allows readonly users to mutate.
A handler that checks both but skips workflow allows out-of-order transitions.
A handler that checks all three but skips audit creates unattributable mutations.

---

## Forbidden patterns

These patterns are **prohibited** in any handler that operates on a resource defined here:

### Implicit ownership inheritance

A user with role X in Org A does NOT automatically own resources in Org A. Ownership is per-row, derived per-row. A handler that grants access on the basis of "the user has role X" without checking the row's owner is a defect.

### Client-declared ownership

The owner of a row is the value persisted on the row, NEVER the value the request claims. A handler that reads `body.tenantId` / `query.org` / `header['x-tenant-id']` and uses it as the persistence key is a defect.

### Request-header ownership derivation

Headers are client-controlled. `x-verifier-org`, `x-tenant-id`, `x-clerk-org`, custom headers — none of them establish ownership. Middleware MAY validate a header against the JWT (identity coherence — `x-verifier-org` per W2-PR1A), but the handler MUST use the JWT-derived value, NOT the header.

### Workflow authorization without ownership validation

A workflow gate is a state-transition check, not an authorization check. Running the 5-gate `policyReview` flow on a resource without first verifying the actor's tenant owns it is a defect. The 5-gate flow trusts that ownership has already been confirmed by the route handler; it does not re-validate.

---

## Per-row implementation contract

When a route handler operates on any resource above, it MUST:

1. Resolve the actor's identity from the JWT (`session.userId` + `session.sessionClaims.vitalcv.org_id` / `team_role`).
2. Load the resource by its URL parameter.
3. Compare the resource's owner field (per the row) against the JWT-derived value.
4. On mismatch → 404 (per `OWNERSHIP_INVARIANTS.md` §6.2).
5. Run the workflow gate per the row's "Workflow legitimacy" requirements.
6. On workflow refusal → 409 / 422 with structured error.
7. Atomic transaction: write the resource update + the `AuditEvent` row.
8. Return the structured response shape.

A route handler that deviates from this sequence — for any reason, including "performance" or "consistency" — is a defect.

---

## Adding a new resource to this dictionary

When a new mutating route is added, the corresponding resource MUST be appended here BEFORE the route handler ships. The PR that introduces the resource:

- Appends the row.
- Defines all 11 required fields explicitly.
- Confirms RBAC / ownership / workflow are distinct.
- Documents the ownership failure behavior.

A route handler that operates on a resource not in this dictionary is a defect, regardless of how its tests pass.

---

> Ownership must be explicit, server-derived, and independently verifiable.
