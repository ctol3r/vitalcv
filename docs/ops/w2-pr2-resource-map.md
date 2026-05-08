# W2-PR2 — Resource Ownership Map

**Wave:** Wave 2, PR 2 — planning only · **Date:** 2026-05-07 · **Status:** architecture; **NO product code in this artifact**

For every resource type touched by a mutating route in `apps/web`, this doc records: owner, tenant scope, mutation authority, readonly visibility, audit requirements, ownership derivation source, and ownership failure behavior.

Resources are grouped by tenant kind. Per-row classifications are normative — implementations must honor them; deviations require founder review.

---

## Table — full resource ownership map

| Resource | Owner | Tenant scope | Mutation authority | Readonly visibility | Audit requirement | Ownership derivation | Ownership failure |
|---|---|---|---|---|---|---|---|
| **EmployerReview** (`apps/api/backend/.../employer_review_*`) | Verifier org | `tenantId` = verifier org_id | `member`+ of owning org for `request-refresh` / `route-to-review` / `share-packet`; `admin`+ for `accept` / `confirm-start` | `readonly`+ within owning org; cross-org never | atomic AuditEvent on every action | `JWT.org_id` vs `EmployerReview.tenantId` | 404 cross-tenant; 503 on DB error |
| **EmployerAcceptance** | Verifier org | `tenantId` = accepting org's org_id | written by `accept` action in transaction with EmployerReview update; never updated post-write | `readonly`+ within owning org for own row; ADMIN role for cross-tenant audit | mandatory; row carries `actorId` + `tenantId` + receipt refs | derived from EmployerReview's tenantId at write time | 404 if not owned; immutable thereafter |
| **EmployerOrgConfig** (`employer/setup`, `employer/profile`) | Verifier org | `tenantId` = org_id | `admin`+ within owning org | `readonly`+ within owning org | mandatory on every config change | `JWT.org_id` vs config row's tenantId | 404 cross-tenant |
| **VerifierTeamMembership** | Verifier org | `tenantId` = org_id | `admin`+ for invite / remove; `owner`+ for role escalation | `member`+ within owning org for roster reads; cross-org never | mandatory on every membership change | derived from JWT (the actor) + the row (the subject) — both must share tenantId | 404 cross-tenant |
| **VerifierInvitation** (PR #248 if landed; otherwise pending) | Issuing verifier org | `tenantId` = inviting org_id (server-set at invitation creation) | `admin`+ of issuing org for create / revoke; the **invited user** for accept (one-time) | `admin`+ within issuing org; the invitee with the invitation code (out-of-band knowledge) | mandatory on create / revoke / accept | for create/revoke: JWT.org_id vs invitation.tenantId; for accept: code lookup + invitee userId | 404 cross-tenant; 410 expired/revoked; 409 already-accepted |
| **IssuerRequest** | Issuer org | `tenantId` = issuer org_id | issuer-org `admin`+ for state transitions; verifier org reads only via the link envelope | `admin`+ within issuing issuer-org; verifier orgs see only the response shape on accepted candidates | mandatory on every state transition | JWT.org_id vs IssuerRequest.tenantId | 404 cross-tenant |
| **ReceiptCandidate** | Issuer org (not the verifier) | `tenantId` = issuer-org id | only the policy-review action that promotes; updates fall under PolicyReviewDecision | issuer-org reviewers; the verifier seeing the wrapped response can read only the redacted shape | mandatory; `decisionGrade: false` (literal) preserved | derived from parent IssuerRequest.tenantId | 404 cross-tenant |
| **PolicyReviewDecision** | Issuer org | `tenantId` = issuer org_id | `policy_reviewer` / `credentialing_committee` / `compliance_officer` actor of issuing org; `automatedPolicyEngine: false` invariant | issuing org's audit role; verifier sees only the resulting receipt-candidate state | mandatory; row carries `reviewerActorId` (never empty) | JWT.org_id vs row's tenantId | 404 cross-tenant; 403 if `reviewerActorId` would be empty (per W1.1b literal) |
| **PSVReceiptCandidate** | Issuer org | `tenantId` = issuer org_id | only `accept_candidate` action by gate-passing actor | within issuing issuer-org; verifier sees the receipt envelope | mandatory; `proofTier: 'psv_receipt_candidate'` (literal) | parent PolicyReviewDecision.tenantId | 404 cross-tenant |
| **PSVReceipt** (promoted) | Issuer org | `tenantId` = issuer org_id; **scoped** by `PSVReceiptScope.sourceOrganizationName` | only `promotePsvReceiptCandidate` (gate-checked); never re-mutated | issuing org for full record; verifier orgs for the scoped/limited subset; clinician for an even-more-redacted public shape | mandatory; `globalCredentialTruth: false` (literal) preserved | parent PSVReceiptCandidate.tenantId | 404 cross-tenant |
| **PSVReceiptReuseDecision** | Reusing verifier org | `tenantId` = reusing-verifier org_id | `member`+ of reusing org with valid `crossTenantConsentReceiptId`; otherwise blocked at W6 layer | reusing verifier org full; issuing verifier org sees a notification record only | mandatory; `crossTenantConsentReceiptId` must be present for cross-org reuse | reusing-org JWT.org_id vs reuse decision row | 404 cross-tenant; 403 missing consent |
| **Recognition** (canonical-path artifact) | Clinician (subject) | not tenant-scoped (clinician is the subject) | issued by the trust-state engine; never mutated by users directly | clinician + their entitled verifiers | mandatory; immutable once issued | `Recognition.subjectId === clinicianId` | 404 if no recognition for that subject |
| **Acceptance** (canonical-path artifact) | Verifier org | `tenantId` = accepting verifier org_id | issued by `POST /api/employer-review/[entityId]/accept` action only; immutable thereafter | issuing verifier org; clinician sees the high-level acceptance | mandatory; atomic with EmployerAcceptance | derived at write time from JWT | 404 cross-tenant |
| **StartAttestation** (canonical-path artifact) | Verifier org | `tenantId` = attesting verifier org_id | only when CRS ≥ 80 AND a valid Acceptance referenced; `admin`+ to attest | issuing verifier org; clinician sees attestation status | mandatory; immutable once issued | derived from referenced Acceptance.tenantId | 404 cross-tenant; 409 if CRS < 80 (workflow gate) |
| **AuditEvent** | The actor's tenant | `tenantId` derived from acting JWT at write time | append-only — no UPDATE/DELETE; corrections via new `correctsEventId` row | `ADMIN` `UserRoleType` only — separate gate from any verifier team role | this IS the audit row | derived at write time from JWT; never set from request body | 404 cross-tenant on read; never deletable |
| **ApplicationBundle** (apply-with-vcv) | Clinician (the apply-er) | `subjectId` = clinician's userId; not tenant-scoped | clinician for create / withdraw; receiving employer-org for read | clinician owns; the employer-org named in the application target reads | mandatory on submit / withdraw / status change | `JWT.userId` vs `ApplicationBundle.subjectId` | 404 if not own / not target |
| **OpportunityApplication** | Verifier org (employer/staffer) — owner of the opportunity | `tenantId` = posting org_id | posting org `member`+ for state changes; clinician for create | posting org for received apps; clinician for own | mandatory | JWT.org_id (employer side) or JWT.userId (clinician side) vs row | 404 cross-tenant or non-clinician-of-record |
| **Passport** (clinician aggregate) | Clinician (subject) | `subjectId` = clinician's userId / NPI | system writes only (ingest/refresh); clinician views | clinician owns; verifier orgs see redacted shape per share | not directly mutated by users; mutations are tracked at the underlying source rows | `JWT.userId` ↔ Passport.subjectId via Clerk publicMetadata.npi binding | 404 if not own / no share entitlement |
| **KnowledgeInboxItem** | Clinician (subject) | `subjectId` = clinician's userId | clinician for create / classify / accept-into-profile | clinician only | mandatory on every state change (item is `recordedBy: 'demo'` literal until persistence wired) | JWT.userId vs item.subjectId | 404 if not own |
| **ProofPack** (exported subset) | Clinician (subject) | `subjectId` = clinician's userId | clinician for generate; the receiving employer-org for revoke (with notification) | clinician owns; the share recipient with the share token | mandatory on generate / revoke | JWT.userId or share-token validation vs ProofPack.subjectId | 404 if not own / no share token / token expired |

---

## Public surfaces — no ownership check (by design)

These surfaces are explicitly public per `apps/web/lib/auth/roles.ts:PUBLIC_ROUTE_PATTERNS`. They MAY be consumed without auth, but they MUST NOT emit ownership-sensitive data:

| Route | What's emitted | Why public |
|---|---|---|
| `GET /p/[slug]` | Redacted clinician profile share — no PHI, time-limited token | Clinician-controlled public share |
| `GET /verify/[npi]` | NPPES + OIG public posture | Public health information |
| `GET /api/trust-state/[npi]` | Cached trust-state from public sources only | NPPES is public; OIG is public |
| `GET /api/passport/npi/[npi]` | Passport aggregate (subject to share-token) | Foundation; current state per audit |
| `GET /api/health`, `/api/readyz` | Service health, no resource data | Infrastructure |
| `GET /api/.well-known/jwks.json` | Public OpenID Connect | Required public endpoint |

Per `OWNERSHIP_INVARIANTS.md` §1.5: even on public surfaces, the route handler must NOT trust client-supplied tenant/owner fields. Public reads are scoped to the subject (NPI / clinician); they do not honor a request's claim of "I'm from Org X."

---

## Cross-scope consent artifacts

These are the explicit authorization artifacts that allow a mutation to cross a tenant boundary. Every cross-tenant flow MUST reference one of these.

| Artifact | Carries | Used by | Status today |
|---|---|---|---|
| `crossTenantConsentReceiptId` | `requestingTenantId`, `issuingTenantId`, scope, expiry, signing-actor | `PSVReceiptReuseDecision`; future cross-org evidence sharing | foundation only (W6) |
| `clinicianConsentArtifact` | `subjectId`, scope, granted/revoked timestamp, releaseFormUrl | All issuer verification requests | shipped (`ConsentArtifact` in `apps/web/lib/issuer-verification/types.ts`) |
| `acceptanceShareToken` | `entityId`, accepting org, expires, scope (read-only) | Public review-share links (`/api/apply/share/[shareId]`) | partial — needs ownership-on-read enforcement |
| `crossTenantAdminAudit` | actor + reason + scope | `ADMIN`-role cross-tenant reads (audit-table sweeps, pilot-ops) | not yet wired; documented requirement |

**An ownership check at a route handler must verify the artifact is present, valid, unexpired, and scope-matches the requested action.** Missing artifact → ownership failure → 404 (cross-tenant) or 403 (missing-consent), per the failure matrix.

---

## What the W2-PR2 implementation PR will modify

Per the ownership-model doc:

- `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` — add ownership check before each mutating action; tighten `PUBLIC_MUTATION_ACTIONS` (currently includes `view` — review whether `view` should remain public or move to `AUTHENTICATED_READ_ACTIONS`)
- `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts` — add ownership check
- `apps/web/lib/auth/ownership.ts` (new) — shared helper `requireOwnedEmployerReview(...)` (or equivalent name); pure-function-friendly per `AUTHORIZATION_LAYERS.md` §3 constraints
- `apps/web/__tests__/employer-review-ownership.test.ts` (new) — exhaustive test cases per §3 of mutation-semantics doc

Approximately 4 files; HIGH_RISK domain (auth + ownership boundary). Verifier route handlers (`apps/web/app/api/verifier/*`) are explicitly W2-PR4 scope, NOT this PR.
