# W2-PR2b — Ownership Architecture Adversarial Review

**Wave:** Wave 2, PR 2b — adversarial review of W2-PR2 architecture (planning only) · **Date:** 2026-05-08 · **Status:** review; **NO implementation in this artifact** · **Reviewer roles:** ownership adversary; tenant-boundary attacker; workflow-mutation adversary; audit-legitimacy reviewer.

**Documents reviewed (extracted from commit `8f91ff2d` on `docs/state-map-pr-triage-2026-05-07`, plus `241b770b` and `bb923d4f`):**
- `docs/ops/w2-pr2-ownership-model.md`
- `docs/ops/w2-pr2-resource-map.md`
- `docs/ops/w2-pr2-ownership-threat-model.md`
- `docs/ops/w2-pr2-mutation-semantics.md`
- `docs/ops/w2-pr2-route-ownership-matrix.md`
- `docs/ops/RESOURCE_OWNERSHIP_DICTIONARY.md`
- `docs/ops/OWNERSHIP_INVARIANTS.md`
- `docs/ops/SECURITY_INVARIANTS.md`

**Adversary assumption:** valid Clerk JWT for some org (insider attacker), full control over headers / body / URL parameters, ability to replay captured requests, ability to probe the URL parameter space. JWT signature forgery and DB-level access are out of scope (per the threat model's adversary capabilities section).

**Code grounding (`origin/wave-10a/docs-status` HEAD):** `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` performs **no** tenant / ownership check today; the handler reads `auth().userId` only and forwards to the backend with `x-clerk-user-id`. `PUBLIC_MUTATION_ACTIONS = ['view']` and `PUBLIC_READ_ACTIONS = ['acceptance-history']` are still in force. This is the surface W2-PR2 must close.

---

## 1. Executive verdict — IMPLEMENT_BLOCKED

The architecture is **conceptually correct in shape** — server-authoritative tenant derivation, four-layer model, atomic-write rule, 404-not-403 enumeration resistance, and the standard ownership-check pattern are all sound. However, the doc set as written contains **6 P0/P1 specification gaps** within the W2-PR2 scope (`/api/employer-review/*`) that, if left to implementer discretion, will produce exploitable defects. Three additional P0/P1 gaps lie just outside W2-PR2 scope but compromise the architecture's downstream extension to W2-PR3 / W2-PR4.

The architecture is the right shape. The implementation contract is incomplete. Resolve the gaps in §3 below before writing implementation code.

---

## 2. Explicit-question determinations

### Q1 — Is ownership derivation fully server-authoritative?

**Mostly yes, with one specification gap and one trust-anchor caveat.**

- **Tenant-scoped resources:** ✅ JWT `sessionClaims.vitalcv.org_id` is the single source. `OWNERSHIP_INVARIANTS.md §1.4` and `§2.4` are explicit. Resource row's persisted `tenantId` is the compare target. No client-controlled channel can rewrite either side. Compare uses simple string equality (no timing-safe needed because both sides are server-derived; this is correct — `ownership-model §2.2`).
- **Subject-scoped resources (clinician):** ⚠️ The chain is `JWT.userId → Clerk publicMetadata.npi → resource.subjectId`. The architecture treats `JWT.userId` as the trust anchor, but `Clerk publicMetadata.npi` is a **mutable claim** on the user's Clerk profile. The docs do not state that `publicMetadata.npi` is locked after onboarding. If a clinician can edit their own `publicMetadata.npi`, they can rewrite their subject identity and inherit another clinician's resources. **GAP** — see §3.G1.
- **The Clerk-claim path itself:** `OWNERSHIP_INVARIANTS.md §1.5` names `sessionClaims.vitalcv.org_id` and `ownership-model §2.1` repeats it. The actual claim path is configured in Clerk's session-token customization. **The docs do not pin which claim path the implementer must read.** A future Clerk config change could move the claim and silently break ownership extraction. **GAP** — see §3.G6.

### Q2 — Can request-body tenant identifiers influence ownership?

**No, per spec — but spec coverage is incomplete.**

- `OWNERSHIP_INVARIANTS.md §1.4`, `§1.5`, `RESOURCE_OWNERSHIP_DICTIONARY.md "Forbidden patterns"`, and `mutation-semantics.md §7.3` all explicitly forbid client-supplied tenant identifiers as the persistence key. The handler uses JWT only.
- `T-1` (forged body tenantId) and `T-3` (header injection) are tracked and the threat model says the helper discards both. This is correct.
- **GAP:** the test plan (`mutation-semantics.md §7.3`) tests body-tenantId / header-tenantId / query-tenantId injection only on the **5 mutating actions**. It does not test these vectors on `view` or `acceptance-history` after their reclassification, nor on the read actions (`packet`, `status`). A handler with the same defect on a read endpoint is exploitable for cross-tenant info-leak. See §3.G2.

### Q3 — Are workflow transitions ownership-bound?

**Partially. The most dangerous gap in the doc set.**

- The pseudocode in `ownership-model §5` runs Layer 3 (ownership) at step 4 and Layer 4 (workflow) at step 5. The 5-gate flow in `policyReview.ts` trusts that ownership has been confirmed (`OWNERSHIP_INVARIANTS.md §3.3`). For **single-resource mutations**, this is correct.
- **For mutations that reference a parent resource, ownership is not transitively bound.** `confirm-start` references `EmployerAcceptance` (per `mutation-semantics.md §4.6` and route matrix §A). The resource map says StartAttestation derives its tenantId "from referenced Acceptance.tenantId". But the docs do **not** require that the referenced `EmployerAcceptance.tenantId === requestingTenantId` at the workflow gate. If the workflow looks up the Acceptance by NPI / clinician (rather than by `(entityId, tenantId)` tuple), Org B can `confirm-start` referencing Org A's Acceptance and emit a StartAttestation that **pretends** to chain off Org A's acceptance.
- See **§3.A1** for full exploit path. This is the highest-severity finding in the review.

### Q4 — Can acceptance occur without ownership proof?

**No under the spec; yes under one race scenario the spec doesn't address.**

- `OWNERSHIP_INVARIANTS.md §4.1` and `mutation-semantics.md §4.2` require ownership before mutation. The `requireOwnedEmployerReview` helper in `mutation-semantics.md §5` enforces it. ✅
- **Race window (TOCTOU):** Step 4 of the standard pattern loads the resource; step 5 runs the workflow gate against the loaded snapshot; step 6 begins the transaction. Between the snapshot read and the transaction commit, a concurrent mutation in the same tenant could change the resource's state — both requests see "ready_for_acceptance" at step 5; both proceed to step 6; both write `EmployerAcceptance` rows. The architecture relies on a DB-level unique constraint as the last line of defense, but `T-6` admits the constraint may not exist on the schema and is deferred to a separate FOUNDER_REQUIRED PR.
- **Net effect:** within a single tenant, dual-acceptance is possible until the schema constraint lands. Cross-tenant acceptance is closed by the spec. See §3.A4.

### Q5 — Are denied mutations audit-attributable?

**Yes for mutations, with caveats; partial for reads, with one schema-blocking gap.**

- ✅ `mutation-semantics.md §3` requires `outcome: 'denied'` rows on every denied mutation, with `tenantId` = caller's tenant and `subjectId` = the URL-targeted resource. The pattern is correct for tenant-scoped mutations.
- ⚠️ `view`, `packet`, `status`, `acceptance-history` — **read-route audit policy is "minimum-info" or "optional"** in the route matrix. "Optional" is not a security policy. A route handler interpreting "optional" as "no audit row" leaves cross-tenant probe attempts invisible (defeating §6.1 of `OWNERSHIP_INVARIANTS.md`). See §3.B1.
- 🛑 **Schema-blocking gap:** for subject-scoped resources (clinician self-mutations on `KnowledgeInboxItem`, `CredentialArtifact`, `ProofPack`), the actor's JWT carries `userId` but typically NO `org_id`. `mutation-semantics.md §3` mandates `tenantId` non-empty on every audit row; `OWNERSHIP_INVARIANTS.md §3.4` says the same. The architecture has no place to put a clinician-self audit row. Either `tenantId` must be nullable (with the invariant amended), or there must be a parallel `subjectId` field that carries the clinician identity (and is required-when-tenantId-is-null). The doc set is silent. See §3.A2 — this gap **does not affect W2-PR2 scope today** but will block the subject-scoped sweep wave entirely.

### Q6 — Can readonly indirectly alter workflow state?

**Spec says no, but the spec leaves "soft mutations" undefined.**

- ✅ Layer 2 (RBAC) blocks readonly-method-mismatch at middleware. `OWNERSHIP_INVARIANTS.md §3.1` requires the route handler to also block readonly on logically-mutating GETs.
- **Undefined surface:** the architecture lists `view`, `packet`, `status`, `acceptance-history` as reads — but does not enumerate **side effects** any of these may carry. `lastViewedAt` bumps, view-counter increments, background-workflow triggers, cache warmups — any of these are "soft mutations" and `SECURITY_INVARIANTS.md §2.2` only bans them across tenants, not within a tenant by readonly. If `/api/employer-review/[entityId]/view` updates `lastViewedAt` on the EmployerReview row, a readonly user is silently mutating state they should not be touching. The architecture does not require an audit of side effects on "read" routes.
- See §3.B2.

---

## 3. Findings

Each finding records: scenario, exploit path, severity, missing invariant, safest enforcement layer.

### §3.A — In-scope architecture gaps (W2-PR2 must address before implementation)

#### A1 — Transitive ownership: `confirm-start` does not bind referenced `EmployerAcceptance.tenantId` to the requesting tenant

**Severity:** **P0** — privilege escalation across tenant boundary; canonical-path corruption.

**Scenario:**
- Clinician X applies to both Org A and Org B (two distinct `ApplicationBundle`s, two distinct `EmployerReview` rows: review_A in Org A, review_B in Org B).
- Org A executes `accept` — writes `EmployerAcceptance(tenantId=org_a, entityId=review_A_entity, clinicianNpi=X.npi)`.
- Org B's verifier (admin) calls `POST /api/employer-review/review_B_entity/confirm-start`.
- Layer 3 ownership on `review_B_entity` passes — Org B owns review_B.
- Layer 4 workflow gate runs `checkConfirmStartGate(review_B, body)`. The gate must verify "an `EmployerAcceptance` exists for this clinician/entity". **If the gate looks up by `(npi, clinician)` rather than `(entityId, tenantId)`**, it finds Org A's Acceptance and returns "permitted".
- Org B writes `StartAttestation(tenantId=org_b, references=Org_A_acceptanceId)`.

**Why this is exploitable:** the docs explicitly state "StartAttestation tenantId derived from referenced Acceptance.tenantId" (`resource-map` row 14). If implementation reads the parent's tenantId rather than overriding with the JWT-derived value, Org B emits a StartAttestation **with `tenantId=org_a`** — a cross-tenant write directly to Org A's audit-relevant chain. If implementation overrides to JWT (Org B), Org B has emitted a StartAttestation chained off Org A's acceptance — corrupting the canonical-path Recognition→Acceptance→Start sequence.

Either branch is broken. The architecture does not commit to one or the other.

**Missing invariant:** **transitive ownership on parent-referenced workflow gates.** When a workflow gate references a parent resource (`EmployerAcceptance` for `confirm-start`; `PolicyReviewDecision` for `accept_candidate`; etc.), the parent's `tenantId` MUST equal the requesting tenantId. This is a separate compare from the immediate Layer 3 check.

**Best enforcement layer:** the workflow-gate helper. The `confirm-start` gate must accept a `requireSameTenantParent: true` flag (or simply make it default behavior). The shared ownership helper should expose a `requireOwnedReferencedResource(parentLoader, parentTenantField)` companion. Test coverage: a cross-tenant parent-acceptance test must exist for `confirm-start`.

**Doc fix:** add §3.5 to `OWNERSHIP_INVARIANTS.md`: "Transitive ownership — when a workflow transition references a parent resource by ID, the parent's tenantId MUST equal the requesting tenantId. The reference fails closed (404) if the parent is cross-tenant."

#### A2 — Subject-scoped audit rows have undefined `tenantId` semantics — schema-blocking gap

**Severity:** **P0** for the subject-scoped sweep wave; **P2** for W2-PR2 scope (no subject-scoped routes are in scope here, but the spec gap is in the constitutional docs).

**Scenario:** clinician U mutates their own `KnowledgeInboxItem` (subject-scoped resource per resource-map row). Clinician U's JWT carries `userId=U` but no `org_id` (clinicians are not verifier-org members). The handler must write an audit row.

**Per `OWNERSHIP_INVARIANTS.md §3.4`:** `tenantId` is "the JWT-derived `requestingOrgId`". For clinician U, this is null/undefined.

**Per `mutation-semantics.md §3`:** `tenantId` "non-empty; matches the resource's tenantId". For subject-scoped resources, the resource has `subjectId`, not `tenantId`.

**Per `RESOURCE_OWNERSHIP_DICTIONARY.md §AuditEvent`:** "tenantId derived from acting JWT at write time". Same gap.

**Implementer-forced choice:** (a) leave `tenantId` null and break the non-empty invariant; (b) overload `tenantId` to carry `subjectId` (conflating tenant and subject — banned by `RESOURCE_OWNERSHIP_DICTIONARY.md` "implicit ownership inheritance"); (c) introduce a sentinel `tenantId='<clinician-self>'`, breaking enum-validated action / tenant joins.

All three are bad. The constitutional docs need to **define a `subjectId`-paired audit row** with explicit cardinality: tenant-scoped events have `tenantId` non-null and `subjectId` may be the resource id; subject-scoped events have `subjectId` non-null and `tenantId` null. Then `tenantId NOT NULL` becomes a per-event-type constraint, not a column-level one.

**Missing invariant:** explicit dual-scope audit row schema. `OWNERSHIP_INVARIANTS.md §3.4` must distinguish tenant-scoped and subject-scoped events.

**Best enforcement layer:** schema (audit table column nullability + check constraint: `(tenantId IS NOT NULL) OR (subjectId IS NOT NULL)`); helper API (`atomicMutateWithAudit` accepts either `tenantId` or `subjectId` per event class); CI test that asserts every action/tenant/subject combo is well-formed.

**Doc fix:** add §3.5 to `OWNERSHIP_INVARIANTS.md`: subject-scoped audit row carries `subjectId` non-empty + `tenantId` null; tenant-scoped audit row carries `tenantId` non-empty + `subjectId` may be the resource. CHECK constraint at schema level.

#### A3 — TOCTOU between workflow-gate snapshot and atomic-write transaction

**Severity:** **P1** — race-condition; bounded by tenancy (no cross-tenant breach), but produces unauditable double-state.

**Scenario:** Two `admin` users in Org A call `POST /api/employer-review/entity-1/accept` simultaneously. Both pass auth, RBAC, and ownership (steps 1–4). Both call `checkWorkflowGate` against the snapshot — both see `reviewState = ready_for_acceptance` (step 5). Both begin a transaction (step 6). Both attempt to write `EmployerAcceptance`.

**Without a unique constraint:** two acceptance rows persist; downstream `confirm-start` may pick either; canonical-path is non-deterministic. **With a unique constraint:** the second write fails with a constraint violation; the route handler returns 409 — but the audit row for the failed second attempt is not written (the transaction rolled back, including the audit write).

**Per the architecture:** `T-6` admits the schema constraint may be missing and is deferred to a separate FOUNDER_REQUIRED PR. `mutation-semantics.md §6` uses callback-style `prisma.$transaction((tx) => ...)`, which is ReadCommitted by default — no row-level lock.

**Missing invariant:** the workflow gate must be **re-evaluated inside the transaction** with the resource row locked (`SELECT ... FOR UPDATE`), OR the transaction must be Serializable, OR the schema must have a unique constraint AND the failed-second-attempt audit row must be written outside the failed transaction (best-effort post-rollback audit).

**Best enforcement layer:** the shared `requireOwnedEmployerReview` helper accepts a `lockForUpdate: boolean` flag. The mutation-semantics doc must specify which actions require row-level lock. `accept` and `confirm-start` definitely need it; `request-refresh` may not.

**Doc fix:** `mutation-semantics.md §2` step 5 must explicitly say "workflow gate re-evaluated inside transaction with row-level lock for finalization actions (accept, confirm-start)".

#### A4 — `payloadHash` redaction policy is undefined (broken cross-reference)

**Severity:** **P1** — PII-exposure-via-rainbow-table risk on small payload domains.

**Scenario:** `mutation-semantics.md §3` requires `payloadHash` = "SHA-256 of the redacted request body" with the constraint "always present; empty string is **not** acceptable." `OWNERSHIP_INVARIANTS.md §3.4` says `payloadHash` is "SHA-256 of the request payload (with PII redaction per `SECURITY_INVARIANTS.md §7.3`)". `SECURITY_INVARIANTS.md §7.3` is "No merge without Codex SAFE" — **the cross-reference is broken**. There is no §7.3 PII-redaction rule.

**Why this matters:** `payloadHash` ends up in the audit table. The audit table is read by `ADMIN` `UserRoleType` (eventually). If the request body has small enumerable structure (`{ confirmStart: true, npi: "1234567890" }`), the hash domain is small enough to rainbow-table — recovering the NPI from the hash. NPI is PHI for HIPAA purposes. The hash itself is one-way, but the **domain** is the leak vector.

**Missing invariant:** explicit redaction list. NPIs, clinician names, share-token secrets, signature blobs MUST be replaced with placeholders or omitted before hashing. The redacted shape is what gets hashed.

**Best enforcement layer:** the `atomicMutateWithAudit` helper accepts a `redactPayload(body) → redactedBody` callback. The redaction list is a constitutional appendix to `SECURITY_INVARIANTS.md`.

**Doc fix:** add `SECURITY_INVARIANTS.md §7.5` (or reuse §4.1) defining the redaction list. Fix the broken cross-reference in `OWNERSHIP_INVARIANTS.md §3.4`.

#### A5 — `view` reclassification is undecided — doc set permits two paths

**Severity:** **P1** — info-leak risk depending on which path implementation picks; ambiguity itself is an architectural defect.

**Scenario:** `route-ownership-matrix §A` and `mutation-semantics §4.1` say `view` "needs reclassification — currently `PUBLIC_MUTATION_ACTIONS`" with the target "auth+ownership **OR** documented share-token-protected public read". The OR is unbounded — implementer picks one.

**Path 1 (auth+ownership):** correct, low ambiguity. The token model still exists in `share-packet`'s output but `view` no longer accepts tokens. **What happens to existing share-tokens in flight?** Doc is silent.

**Path 2 (share-token-protected public):** the handler must split paths based on whether `?shareToken=` is present. But `mutation-semantics §4.1` does not specify the precedence: if BOTH `auth()` returns a session AND `?shareToken=...` is present, which path runs? If shareToken is honored, an authenticated cross-tenant attacker can use a captured Org A token to read Org A data **while logged in as Org B** — the audit row attributes to Org B (the actor's session) but the data emitted is Org A's. Audit attribution corruption.

**Missing invariant:** when both auth-path and share-token-path could match, the **share-token path must run only for unauthenticated callers**. An authenticated session must always run through the auth+ownership path.

**Best enforcement layer:** route handler explicit branching: `if (auth().userId) { run auth+ownership } else if (request.query.shareToken) { run share-token-public } else { 401 }`. Never mix.

**Doc fix:** `mutation-semantics §4.1` must commit to a path or explicitly specify the auth-precedes-token rule.

#### A6 — `correlationId` replay-defense key is wrong

**Severity:** **P1** — replay defense is ineffective as specified.

**Scenario:** `mutation-semantics §3` defines `correlationId` as "request-scoped UUID (e.g., from `x-correlation-id` header or generated)" and uses `(actorId + correlationId + 24h)` as the dedup key. But:
- If `correlationId` comes from the request header, the attacker controls it. Each replay can carry a fresh UUID. Dedup never fires.
- If `correlationId` is server-generated, every request gets a fresh one. Dedup never fires (same as above).

**Why the spec is wrong:** the correct dedup key is `(actorId, payloadHash, time-window)` — `payloadHash` is server-derived from the (redacted) request body and is identical across true replays. `correlationId` is metadata, not the dedup primary.

**Missing invariant:** dedup key is `(actorId, payloadHash, configurable-window)`, not `(actorId, correlationId)`. `correlationId` survives as auxiliary metadata for tracing, not as the replay-defense primary.

**Best enforcement layer:** the atomic-write helper. Before INSERT, check `SELECT 1 FROM auditEvent WHERE actorId=$1 AND payloadHash=$2 AND decidedAt > now() - '24h'`. On hit, return 409 `duplicate_request`.

**Doc fix:** `mutation-semantics §3` and `OWNERSHIP_INVARIANTS.md §3.4` must rename the dedup key.

### §3.B — In-scope correctness / completeness gaps

#### B1 — Read-route audit policy uses the word "optional"

**Severity:** **P1** — silent cross-tenant probing on read routes if implementer chooses no-audit.

**Scenario:** `route-ownership-matrix §A` lists `packet`, `status`, `acceptance-history`, `view` audit as "minimum-info" or "optional". `OWNERSHIP_INVARIANTS.md §6.1` says "every ownership refusal at the route handler MUST log a structured observability event" — but says nothing about successful reads. An implementer reading "optional audit" on a read route may emit no audit row at all. Cross-tenant probe attempts are then invisible to operators.

**Missing invariant:** every Layer-3 denial (read or mutation) writes a denied-attempt audit row. Successful reads emit a minimum-info audit row only when the resource is sensitivity-class A or B (clinician PHI, acceptance, decision). Read-only public-share-token consumption emits an audit row attributed to the token-bearer's identity.

**Best enforcement layer:** the shared ownership helper writes the denied-attempt audit row before returning the 404 response. Successful-read audit is a per-action policy, not "optional".

**Doc fix:** `route-ownership-matrix` "minimum-info" cells must reference an explicit definition. Add `mutation-semantics §3.5` defining the minimum-info row shape.

#### B2 — "Soft mutations" on read routes are not addressed

**Severity:** **P1** — readonly users may silently mutate via GET routes that update timestamps/counters; cross-tenant soft-mutation enabled if backend honors a `lastViewedAt` bump.

**Scenario:** `GET /api/employer-review/[entityId]/view` may update `lastViewedAt` on the EmployerReview row (a "soft mutation"). The architecture does not enumerate which read routes carry side effects. `SECURITY_INVARIANTS.md §2.2` bans cross-tenant soft mutations but is silent on within-tenant readonly soft mutations.

**Missing invariant:** every GET route that has side effects MUST be reclassified as a mutation under the four-layer model. Readonly users blocked. Audit row required. There is no "GET that quietly mutates" exception.

**Best enforcement layer:** `route-ownership-matrix` should include a "side-effects?" column. Any route with side effects ≠ true read; route handler enforces readonly-blocks.

**Doc fix:** add a column to the route ownership matrix; require every GET to declare side-effect-free or migrate to POST.

#### B3 — `share-packet` token validation contract is underspecified

**Severity:** **P1** — token misuse if validation skips any of the four required checks.

**Scenario:** `mutation-semantics §4.5` lists token requirements: ≥128 bits entropy, expiry, single-resource-bound, never replayed across resources. But the **consumption-side validation** is not specified anywhere. The consumer route (presumably `/api/apply/share/[shareId]`) must validate:
1. Token is well-formed and verifies cryptographically (HMAC or equivalent).
2. Token has not expired.
3. Token's `entityId` field equals the URL-supplied resource id.
4. Token's `scope` field permits the requested action.
5. Token has not been revoked (implies a revocation-check table or revocation list).

If any check is skipped, the token grants more than intended. The architecture does not specify which side (issuance or consumption) enforces which check.

**Missing invariant:** explicit four-check contract on token consumption + revocation surface (which is itself a route that needs ownership semantics — see §3.C2).

**Best enforcement layer:** consumption-route helper `validateShareToken(token, expectedEntityId, requestedScope) → result`. The helper is the only place tokens are accepted.

**Doc fix:** add `mutation-semantics §4.5.1` "token consumption contract" and `route-ownership-matrix §G` "share-token-consumption row" with the four required checks.

#### B4 — `extractTenantFromSessionClaims` is unspecified — wrong claim path silently breaks ownership

**Severity:** **P1** — single point of failure in the helper; bug class.

**Scenario:** `ownership-model §5` step 2 calls `extractTenantFromSessionClaims(session.sessionClaims)`. The claim path varies by Clerk configuration: it could be `vitalcv.org_id`, `org_id`, `activeOrganizationId`, `o.id`, etc. If implementation reads the wrong path, every ownership check returns 403 (no_org_context) — a noisy denial of service that may be papered over with a fallback (worse: a fallback that reads a different, attacker-influenceable claim).

**Missing invariant:** explicit Clerk claim-path constants in `OWNERSHIP_INVARIANTS.md`. The path is checked at server start (fast-fail if Clerk's claim shape ever changes) and centralized in one helper.

**Best enforcement layer:** a single `CLERK_CLAIMS = { TENANT_ID_PATH: 'vitalcv.org_id', USER_ID_PATH: 'sub', ... }` exported constant; the helper reads via this constant; tests assert the constant matches what Clerk emits in a smoke-test JWT.

**Doc fix:** `OWNERSHIP_INVARIANTS.md §1.5` must pin the claim-path values, not just name them.

### §3.C — Out-of-scope-but-architecturally-coupled gaps

#### C1 — Per-tenant-kind extraction is conflated under one model

**Severity:** **P1** — when issuer-tenant routes ship in W2-PR3, the architecture has no ready answer.

**Scenario:** `resource-map §3.1` enumerates **three tenant kinds**: verifier org, issuer org, internal admin. They share the JWT `org_id` claim path but have **different role enums** (`team_role` for verifier; `policy_reviewer/credentialing_committee/compliance_officer` for issuer; `UserRoleType.ADMIN` for internal). A handler that imports `extractVerifierClaims` (per W2-PR1A) and applies it to an issuer-tenant route either (a) returns null because issuer JWTs don't carry verifier `team_role` — false denial, or (b) accepts the issuer's `org_id` as if it were a verifier `org_id` — **cross-tenant-kind confusion**. An issuer-org admin acting on a verifier route (or vice versa) is not anywhere in the threat model.

**Missing invariant:** explicit per-tenant-kind extractor. `extractTenantContext(session, expectedKind: 'verifier'|'issuer'|'admin') → {kind, tenantId, actorId, role}`. Mismatched-kind routes return 403.

**Best enforcement layer:** a single kind-aware extractor; route handlers state their expected tenant kind.

**Doc fix:** `OWNERSHIP_INVARIANTS.md` must add §3.6 "tenant-kind discrimination" with explicit handling.

#### C2 — Share-token revocation route is unspecified

**Severity:** **P2** — deferred risk; revocation is a future cross-tenant write surface.

**Scenario:** `share-packet` creates a token. The verifier may want to revoke it (clinician changed their mind, share went to wrong org, etc.). The architecture does not specify the revocation route. When implemented later, what's the ownership check? If revocation is keyed by `tokenId`, can Org B revoke Org A's tokens (cross-tenant write)? If implemented as `POST /api/employer-review/[entityId]/share-packet/revoke`, the entityId-based ownership check applies — but the docs don't specify this route's existence.

**Missing invariant:** revocation-route specification with explicit ownership check.

**Best enforcement layer:** revocation route at `/api/employer-review/[entityId]/share-packet/[tokenId]/revoke`; ownership keyed on `entityId`.

**Doc fix:** add a row in `route-ownership-matrix §A`.

#### C3 — Multi-org users — the "active org" assumption

**Severity:** **P2** — current scope unaffected; future user-experience defect.

**Scenario:** A user belongs to Org A (admin) and Org B (admin) — multi-org accepted invitations are explicitly supported via `VerifierInvitation`. Their JWT carries one `org_id` claim representing the **active org**. Switching active orgs requires a new JWT (or Clerk session refresh). During the active-org switch window, the user's mutation against the "other" org returns 404 (cross-tenant) — a confusing UX issue but not a security breach.

**Missing invariant:** documentation of the active-org model; UI guidance to refresh after switch.

**Best enforcement layer:** out of W2-PR2 scope; track for the multi-org UX wave.

**Doc fix:** add a paragraph in `ownership-model §2.1` explaining the single-active-org-per-JWT model and its UX implication.

### §3.D — Ambiguity / spec hygiene

#### D1 — `EmployerAcceptance` derivation duplicated with two contradictory sources

**Severity:** **P3** — spec inconsistency; risk of implementer choosing the lax path.

**Scenario:** `resource-map` row 2 says `EmployerAcceptance.tenantId` "derived from EmployerReview's tenantId at write time". `RESOURCE_OWNERSHIP_DICTIONARY §9` says the same row's ownership is "derived at write time from JWT".

If implementation reads the JWT at write time AND the parent's tenantId, and they disagree, what happens? (They should never disagree because Layer 3 already verified the EmployerReview belongs to the JWT's tenant — but if Layer 3 was skipped or buggy, the disagreement surfaces here.) The architecture should specify: "derive from JWT; assert parent.tenantId === JWT.tenantId; on mismatch, 500 with internal alert."

**Missing invariant:** explicit tie-break rule.

**Best enforcement layer:** the helper that creates the Acceptance row.

**Doc fix:** consolidate `resource-map` and `RESOURCE_OWNERSHIP_DICTIONARY` derivation language.

#### D2 — "Minimum-info" audit row is undefined

**Severity:** **P3** — see B1; may collapse to "no audit" without a definition.

**Doc fix:** define minimum-info row in `mutation-semantics §3.5`.

#### D3 — `entityId` / `npi` namespaces share path; URL parameter validation unspecified

**Severity:** **P3** — input-validation, not auth.

**Scenario:** `entityId` should be UUID-shaped; `npi` should be 10-digit-numeric. If validation isn't strict, a caller passing a string that resembles both could trigger the wrong lookup path.

**Best enforcement layer:** strict URL-parameter validation in route handlers; reject malformed params with 400.

**Doc fix:** add a "parameter validation" sub-section to `ownership-model §5`.

### §3.E — Verified-correct (no finding)

The following were checked and found to be correctly specified:

- 404-not-403 enumeration resistance (cross-tenant) — locked by `OWNERSHIP_INVARIANTS.md §6.2` and `SECURITY_INVARIANTS.md §5.5`. Test plan (§7.4) covers it.
- Header-injection (`x-verifier-org`) on `/api/employer-review/*` — handler explicitly forbidden from reading the header (T-3); test plan covers it.
- Body-tenantId rejection on the 5 mutating actions — explicit rule + test (T-1, §7.3).
- Atomic-write rule (resource update + audit row in one transaction) — `mutation-semantics §6` and the `atomicMutateWithAudit` helper. Test plan (§7.2) covers transaction rollback semantics. *Subject to A3 (TOCTOU).*
- 503 on DB read failure with `x-rbac-fail-closed: ownership_unresolvable` header — explicit in failure matrix.
- 500-internal-alert on null `tenantId` in row — `OWNERSHIP_INVARIANTS.md §6.3`, test plan (§7.5).
- Pure-function discipline on auth helpers — `SECURITY_INVARIANTS.md §6.4`.
- Append-only audit table — `OWNERSHIP_INVARIANTS.md §3.4` + `SECURITY_INVARIANTS.md §4.3`.
- `actorId` non-empty (no `'system'` / `'unknown'` defaults) — `OWNERSHIP_INVARIANTS.md §3.4` + `SECURITY_INVARIANTS.md §4.2`.
- W2-PR2 scope is correctly limited to `/api/employer-review/*` (≈4 files) — `ownership-model §7`.

### §3.F — Severity rollup

| Severity | Count | Findings |
|---|---|---|
| P0 | 2 | A1 (transitive ownership), A2 (subject-scoped audit) |
| P1 | 8 | A3, A4, A5, A6, B1, B2, B3, B4 |
| P2 | 3 | C1, C2, C3 |
| P3 | 3 | D1, D2, D3 |

In-scope (W2-PR2): A1, A2 (architecturally), A3, A4, A5, A6, B1, B2, B3, B4. **2 P0 + 6 P1 within scope.**

### §3.G — Trust-anchor caveats (informational)

#### G1 — `Clerk publicMetadata.npi` mutability

If `publicMetadata.npi` is editable by the user post-onboarding, a clinician can rewrite their subject identity. The architecture treats this binding as durable, but Clerk's `publicMetadata` is by default user-mutable.

**Mitigation:** lock `publicMetadata.npi` via Clerk webhook on onboarding-complete; subsequent updates require admin (out of band).

**Doc fix:** add to `OWNERSHIP_INVARIANTS.md §1.5` — the NPI-binding source of truth and its mutability constraints.

#### G6 — Clerk claim-path drift

Clerk's session-token customization allows the operator to rename / reshape claims. If the path moves from `vitalcv.org_id` to `org_id`, the helper silently breaks. Smoke-test on app boot would catch it.

**Mitigation:** see B4.

---

## 4. Required spec deltas before implementation begins

To unblock implementation, the following constitutional / architecture-doc changes must land first (a separate planning-only PR, no code):

1. **`OWNERSHIP_INVARIANTS.md §3.5` (new):** transitive ownership for parent-referenced workflow gates. Closes A1.
2. **`OWNERSHIP_INVARIANTS.md §3.4` (revised):** subject-scoped audit rows carry `subjectId` non-null + `tenantId` null; tenant-scoped audit rows carry `tenantId` non-null. CHECK constraint at schema. Closes A2.
3. **`OWNERSHIP_INVARIANTS.md §1.5` (revised):** pin Clerk claim-path constants; document NPI-binding mutability constraints. Closes B4 + G1.
4. **`OWNERSHIP_INVARIANTS.md §3.6` (new):** per-tenant-kind extractor specification. Closes C1.
5. **`SECURITY_INVARIANTS.md §7.5` (new):** PII redaction list for `payloadHash`. Closes A4.
6. **`mutation-semantics.md §2 step 5` (revised):** workflow-gate re-evaluation inside transaction with row-level lock for finalization actions. Closes A3.
7. **`mutation-semantics.md §3` (revised):** dedup key is `(actorId, payloadHash, window)`, not `(actorId, correlationId)`. Closes A6.
8. **`mutation-semantics.md §3.5` (new):** minimum-info audit row shape; explicit successful-read audit policy. Closes B1, D2.
9. **`mutation-semantics.md §4.1` (revised):** commit `view` to either auth+ownership XOR share-token-public; specify auth-precedes-token rule. Closes A5.
10. **`mutation-semantics.md §4.5.1` (new):** token consumption four-check contract. Closes B3.
11. **`route-ownership-matrix` (revised):** add "side-effects?" column; reclassify any side-effect-bearing GET as a mutation. Closes B2.
12. **`route-ownership-matrix §A` (extended):** add share-token-revocation row. Closes C2.

These are all doc-only changes. They unblock the W2-PR2 implementation PR without producing product code.

---

## 5. Conditional pathway to IMPLEMENT_SAFE

W2-PR2 implementation may begin once:

1. The 12 spec deltas above land (single planning-only PR, founder-approved, no merge gate beyond docs review).
2. The `confirm-start` test plan (`mutation-semantics §7.1`) is amended to include a **cross-tenant parent-acceptance test case** for the transitive-ownership defense (closes A1's test coverage).
3. The schema audit (`T-6`, `T-8`) is committed-to: either the unique constraint on `EmployerAcceptance(entityId)` lands as a precondition FOUNDER_REQUIRED PR, or the implementation explicitly adopts row-level locking with documented rollback-audit semantics.
4. A smoke-test asserting Clerk's claim path matches the pinned constant is added to the boot sequence (closes B4 in CI).

With these in place, the W2-PR2 implementation PR (≈4 files: helper + 2 route handlers + tests) is well-scoped and the architecture answers the implementer's security-critical questions before they're asked.

---

## 6. Verdict

# **IMPLEMENT_BLOCKED**

The architecture is the right shape. Server-authoritative ownership derivation, four-layer separation, atomic-write rule, 404 enumeration resistance, and the standard ownership-check pattern are all correctly specified. The threat model (12 threats) is comprehensive and the test plan (≈31 test cases) is rigorous.

But within the W2-PR2 scope (`/api/employer-review/*`), the doc set has **2 P0 architectural gaps and 6 P1 specification gaps** that, left unresolved, would force the implementer to make security-critical decisions silently. Two of these (A1 transitive ownership; A6 wrong replay-defense key) would produce **directly exploitable defects** if implemented per the docs as written. Two more (A2 subject-scoped audit; A3 TOCTOU) would produce defects that pass the test plan but fail at the next layer of analysis.

The architecture does not need a redesign. It needs **12 doc-only deltas** (§4) before the implementation PR begins. These are all in the spirit of what the docs already establish; they close ambiguities and make implicit decisions explicit. None requires a schema change in the doc-delta PR itself (one references a separate FOUNDER_REQUIRED schema PR for the unique constraint).

**Do not begin W2-PR2 implementation until §4 deltas land.** Once they do, this verdict flips to IMPLEMENT_SAFE.

---

> Identity establishes who is acting.
> Ownership establishes what they may control.
> The spec must establish what the implementer may not silently decide.
