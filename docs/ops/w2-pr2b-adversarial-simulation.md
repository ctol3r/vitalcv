# W2-PR2B — Adversarial Mutation Simulation

**Wave:** Wave 2, PR 2B — adversarial mutation simulation · **Date:** 2026-05-08 · **Status:** simulation only; **NO product code; NO merges in this artifact** · **Branch at time of simulation:** `wave-10a/docs-status` (HEAD `5d530f13`) · **Reviewer perspective:** five-hat adversary (malicious verifier; tenant-boundary attacker; workflow-state attacker; ownership-confusion adversary; audit-legitimacy attacker)

This document attempts to violate tenant boundaries and mutate employer-review state illegitimately against the W2-PR2B "ownership scaffolding." It is the merge gate before any W2-PR2B implementation PR. The simulation does not implement and does not merge.

---

## 0. Pre-flight — the named scaffolding does not exist on the merge target

Before any exploit can be evaluated, the eight documents named in the simulation brief were checked for existence on this branch (`5d530f13`):

| Document | On `wave-10a/docs-status` (this branch) | Available elsewhere | Notes |
|---|---|---|---|
| `docs/ops/w2-pr2b-scaffolding-plan.md` | **missing** | not in any branch | the named source-of-truth doesn't exist |
| `docs/ops/w2-pr2b-mutation-flow.md` | **missing** | not in any branch | |
| `docs/ops/w2-pr2b-ownership-derivation.md` | **missing** | not in any branch | |
| `docs/ops/w2-pr2b-audit-coupling.md` | **missing** | not in any branch | |
| `docs/ops/MUTATION_GATE_SEQUENCE.md` | **missing** | exists on commit `db0502ba` | implementation-lock branch only |
| `docs/ops/RESOURCE_OWNERSHIP_DICTIONARY.md` | **missing** | exists on commits `8f91ff2d`, `db0502ba` | planning branches only |
| `docs/ops/OWNERSHIP_INVARIANTS.md` | **missing** | exists on commits `241b770b`, `db0502ba` | planning branches only |
| `docs/ops/w2-pr2-route-ownership-matrix.md` | **missing** | exists on commit `8f91ff2d` | planning branch only |

Four of the eight documents (the four `w2-pr2b-*` siblings) **do not exist anywhere in the repository under those names**. The closest extant artifact is `w2-pr2b-implementation-lock.md` on commit `db0502ba`, which fills the role of "scaffolding plan" but explicitly defers `mutation-flow`, `ownership-derivation`, and `audit-coupling` to follow-up planning work. The remaining four documents live on planning branches that have not been merged into the trunk this PR targets.

**Consequence:** the implementation contract for W2-PR2B exists only as a scattered set of branch artifacts, none of which a reviewer can read on the merge target. The simulation continues against the **implicit specification recovered from the planning-branch artifacts** (`MUTATION_GATE_SEQUENCE.md`, `OWNERSHIP_INVARIANTS.md`, `RESOURCE_OWNERSHIP_DICTIONARY.md`, `w2-pr2-route-ownership-matrix.md`, `w2-pr2-mutation-semantics.md`, `w2-pr2-ownership-threat-model.md`, `w2-pr2-ownership-model.md`, `w2-pr2b-implementation-lock.md`) plus the on-disk code at HEAD `5d530f13`.

This pre-flight finding is itself dispositive of the verdict (see §5), but the ten exploit attempts proceed against the recovered implicit spec.

---

## 1. Ground truth — the code surface under attack (`5d530f13`)

The simulation attacks the union of two surfaces — the Next.js proxy and the Express backend — because the scaffolding (when it lands) must close gaps in both.

### 1.1 Proxy: [apps/web/app/api/employer-review/[entityId]/[action]/route.ts](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts)

Observed at HEAD:

| Concern | Line | State |
|---|---|---|
| Auth check | [route.ts:362-365](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:362) | `userId` presence only; **no JWT org_id extraction** |
| RBAC check | — | **none** — `team_role` never read |
| Ownership check | — | **none** — proxy never loads the resource |
| Body field allow-list (accept) | [route.ts:118-127](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:118) | `organizationContextId` **and** `bundleId` are explicitly allowed through |
| `view` action | [route.ts:20](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:20) | in `PUBLIC_MUTATION_ACTIONS` — **anonymous POST permitted** |
| `acceptance-history` action | [route.ts:21](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:21) | in `PUBLIC_READ_ACTIONS` — **anonymous GET permitted** |
| Forwarded headers | [route.ts:386, 458](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:386) | only `x-clerk-user-id: userId`; **no org claim, no role, no signature of intent** |

### 1.2 Proxy: [apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts](apps/web/app/api/employer-review/npi/%5Bnpi%5D/refresh-requests/route.ts)

| Concern | Line | State |
|---|---|---|
| Auth check | — | **none** — `auth()` is never called; anonymous reads succeed |
| Tenant scoping | — | **none** — the URL's `npi` is the only filter; cross-tenant NPI iteration is unimpeded |
| Backend call | [route.ts:17-20](apps/web/app/api/employer-review/npi/%5Bnpi%5D/refresh-requests/route.ts:17) | no identity headers forwarded |

### 1.3 Backend: [apps/api/backend/src/routes/employerActions.ts](apps/api/backend/src/routes/employerActions.ts)

| Concern | Line | State |
|---|---|---|
| `requireClerkUserId` | [employerActions.ts:55-58](apps/api/backend/src/routes/employerActions.ts:55) | reads `x-clerk-user-id` from header — trust transitive on the proxy |
| `employerId = requireClerkUserId(req)` | [employerActions.ts:166](apps/api/backend/src/routes/employerActions.ts:166) | **structural conflation: actor === tenant.** No separate org identifier. |
| Acceptance dedup | [employerActions.ts:175-176](apps/api/backend/src/routes/employerActions.ts:175) | `(employerId, clinicianNpi)` — a different verifier in same tenant trivially circumvents |
| `confirm-start` acceptance lookup | [employerActions.ts:830-839](apps/api/backend/src/routes/employerActions.ts:830) | `findFirst({employerId, clinicianNpi})` — **not bound to URL `entityId`**; clinician-wide, not entity-wide |
| `confirm-start` transaction | [employerActions.ts:863](apps/api/backend/src/routes/employerActions.ts:863) | `prisma.$transaction(...)` is correctly used — atomic for this action |
| `accept` audit boundary | [employerReviewActions.ts:730](apps/api/backend/src/services/entity/employerReviewActions.ts:730) | `prisma.$transaction(...)` wraps acceptance + outbox + audit |
| `accept` org attribution | [employerReviewActions.ts:716-720](apps/api/backend/src/services/entity/employerReviewActions.ts:716) | `acceptedByOrgId = attribution.organizationId ?? null` where `attribution` is **derived from the request body's `organizationContextId`** |
| Audit row tenant scoping | — | `AuditEvent.organizationId` is nullable; not enforced from JWT claim |

### 1.4 Backend tenant guard: [apps/api/backend/src/middleware/tenantGuard.ts](apps/api/backend/src/middleware/tenantGuard.ts)

| Concern | Line | State |
|---|---|---|
| `shouldSkipTenantContext` | [tenantGuard.ts:74](apps/api/backend/src/middleware/tenantGuard.ts:74) | `/api/employer-review/` **explicitly skipped** from tenant validation |
| `parseRequestRole` | [tenantGuard.ts:144-150](apps/api/backend/src/middleware/tenantGuard.ts:144) | reads `x-user-role` / `x-verifier-role` / `x-role` from headers — **client-controlled** |
| `isSuperAdmin` | [tenantGuard.ts:152-158](apps/api/backend/src/middleware/tenantGuard.ts:152) | **returns true on any `x-*-role: super-admin` header** — no JWT proof |
| `enforceOrganizationMatch` failure code | [tenantGuard.ts:188](apps/api/backend/src/middleware/tenantGuard.ts:188) | **403 not 404** — leaks tenant existence; violates `OWNERSHIP_INVARIANTS.md §6.2` |

### 1.5 Backend organization context: [apps/api/backend/src/middleware/organizationContext.ts](apps/api/backend/src/middleware/organizationContext.ts)

| Concern | Line | State |
|---|---|---|
| `getRequestOrganizationId` fallback | [organizationContext.ts:70-82](apps/api/backend/src/middleware/organizationContext.ts:70) | attached → JWT (verified) → **`?organizationId=` query** → **`x-org-id` header** |

The query and header fallbacks are the textbook "Forbidden patterns — Client-declared ownership" antipattern from `RESOURCE_OWNERSHIP_DICTIONARY.md`.

### 1.6 Schema and helpers — what does NOT exist

- `EmployerReview` Prisma model: **does not exist.** What the architecture docs call "the review row" is derived from `VcvEntity` + side tables.
- `EmployerAcceptance.tenantId` foreign key: **does not exist.** The model carries `organization String` (free-text); there is no typed tenant FK.
- `EmployerAcceptance` `@@unique([entityId, tenantId])` constraint: **does not exist.**
- `AuditEvent.organizationId NOT NULL`: **not enforced.** Column is nullable.
- `AuditEvent.actorId` / `correlationId`: **do not exist as required columns.** Actor attribution depends on `metadata` JSON discipline.
- `extractVerifierClaims` helper (W2-PR1A dependency): **does not exist on this branch.** Only `clerkConfig.ts` and `roles.ts` are in `apps/web/lib/auth/`.
- `requireOwnedEmployerReview` shared helper (proposed in `w2-pr2-mutation-semantics.md §5`): **does not exist.**
- `atomicMutateWithAudit` helper: **does not exist.**

The W2-PR2 architecture references prior-wave foundations that have not landed on this branch.

---

## 2. Ten exploit attempts

Each exploit assumes an authenticated attacker holding a valid Clerk session for **Org A**, attempting to mutate an `EmployerReview` belonging to **Org B**, unless otherwise stated. Severity follows W2-PR2 ownership threat-model conventions.

### Exploit 1 — Cross-tenant review acceptance via direct URL

**Attack path.** Attacker (Org A admin) sends:

```
POST /api/employer-review/<entity-id-belonging-to-org-B>/accept
Cookie: __session=<valid Clerk session JWT for Org A>
Content-Type: application/json

{ "acceptanceScope": "full" }
```

**Outcome today: SUCCEEDS.**

1. Proxy [route.ts:362-365](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:362) checks `userId` present — passes.
2. Proxy never extracts `sessionClaims.vitalcv.org_id` — there is no org identity to compare against.
3. Proxy sanitizes the body (allows the empty/minimal shape) and forwards to the backend with `x-clerk-user-id`.
4. Backend `requireClerkUserId` accepts the proxy header at [employerActions.ts:166](apps/api/backend/src/routes/employerActions.ts:166) and **uses it as `employerId`** — the actor's userId becomes the tenant identifier.
5. `tenantGuard.shouldSkipTenantContext('/api/employer-review/...')` returns `true` at [tenantGuard.ts:74](apps/api/backend/src/middleware/tenantGuard.ts:74).
6. `recordEmployerReviewAcceptance` creates an `EmployerAcceptance(employerId=<Org-A-userId>, clinicianNpi=<Org-B's clinician>)`. The row enters the canonical-path audit stream **as if Org A had recognized Org B's clinician**.

**Why succeeds.** `OWNERSHIP_INVARIANTS.md §1.3` ("all mutations require ownership validation") and `MUTATION_GATE_SEQUENCE.md` step 4 ("validate ownership") are unimplemented. There is no server-side compare of `JWT.org_id` against a persisted `EmployerReview.tenantId` because (a) the JWT org claim is never extracted on the proxy, and (b) there is no `tenantId` column on the schema to compare against.

**Missing invariant.** `EmployerReview.tenantId === requestingOrgId` (`MUTATION_GATE_SEQUENCE.md` step 4).

**Missing ownership proof.** Server-derived `requestingTenantId` from `sessionClaims.vitalcv.org_id`; persisted `tenantId` column on the parent row.

**Safest enforcement layer.** **Next.js route handler.** It is the only point that holds Clerk-validated JWT claims; pushing the check downstream re-introduces the header-trust antipattern that fails (1.5). Backend defense-in-depth is required but secondary; the proxy is authoritative.

---

### Exploit 2 — Forged ownership via request-body `organizationContextId`

**Attack path.** Attacker (Org A admin) posts to an Org-B entity:

```
POST /api/employer-review/<org-B-entity>/accept
Cookie: __session=<Org A admin JWT>
Content-Type: application/json

{ "acceptanceScope": "full", "organizationContextId": "<Org-A-uuid>" }
```

**Outcome today: SUCCEEDS at the metadata level.**

1. Proxy validates `organizationContextId` is in the allow-list ([route.ts:118-127](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:118)) — passes.
2. Body is forwarded verbatim to the backend.
3. `recordEmployerReviewAcceptance` calls `resolveEmployerReviewAttribution({ organizationContextId: input.organizationContextId, … })` ([employerReviewActions.ts:709-714](apps/api/backend/src/services/entity/employerReviewActions.ts:709)).
4. The resulting `attribution.organizationId` (sourced **from the request body**) is written to `acceptance.acceptedByOrgId` ([employerReviewActions.ts:716-720](apps/api/backend/src/services/entity/employerReviewActions.ts:716)), and propagated into the audit metadata.

The acceptance row exists; downstream consumers (KPI dashboard, distribution layer, share-token namespace) see the acceptance attributed to a body-supplied org. This is **forged ownership at the attribution surface**: the row attributes to whichever org-id the attacker types into the body.

**Why succeeds.** `RESOURCE_OWNERSHIP_DICTIONARY.md` "Forbidden patterns — Client-declared ownership": the owner of a row must come from server-validated identity, not the request body. Today the body field passes validation, the attribution resolver consumes it, and there is no compare against the entity's owning org because no such column exists.

**Missing invariant.** Mutating handlers must discard body fields named `tenantId` / `organizationContextId` / `bundleId` for **ownership** purposes. Advisory linkage is permissible only after server-side compare confirms the body-supplied id matches the JWT-derived tenant.

**Missing ownership proof.** Server-derived ownership written at persistence time; rejection of body-supplied owners by the helper before they reach the audit metadata.

**Safest enforcement layer.** The proposed `requireOwnedEmployerReview` helper must return a **scrubbed body** to route handlers. Route handlers must not see raw body fields named `*organizationContextId*` / `*bundleId*` / `*tenantId*`. The scrubbing is at the helper boundary, not at the resolver — by the time `attribution.organizationId` is computed, the body has already lied.

---

### Exploit 3 — Forged `x-org-id` header via direct backend call

**Attack path.** Attacker discovers the backend's URL (or routes via SSRF, or via a misconfigured ingress that admits non-proxy traffic) and sends:

```
POST <backend-url>/api/employer-review/<org-B-entity>/accept
x-clerk-user-id: <Org-A-userId>
x-org-id: <Org-B-orgid>
Content-Type: application/json

{ "acceptanceScope": "full" }
```

**Outcome today: SUCCEEDS against backend directly.**

The route is in the tenant-guard skip-list at [tenantGuard.ts:74](apps/api/backend/src/middleware/tenantGuard.ts:74), so `enforceOrganizationMatch` does not run on this path. But `getRequestOrganizationId` ([organizationContext.ts:70-82](apps/api/backend/src/middleware/organizationContext.ts:70)) honors the `x-org-id` header. Audit metadata that consults `getRequestOrganizationId(req)` records the **forged** org as the actor's tenant — the audit row attributes the acceptance to whatever org-id the attacker writes into the header.

**Why succeeds.** `OWNERSHIP_INVARIANTS.md §1.5` — "headers never establish ownership" — is structurally violated by `parseOrganizationFromHeader` and `parseOrganizationFromQuery` in [organizationContext.ts:65-69](apps/api/backend/src/middleware/organizationContext.ts:65). Both fallback paths must be deleted.

**Missing invariant.** Server-authoritative tenant derivation from JWT only. Any header/query fallback is a defect.

**Missing ownership proof.** The Clerk-validated JWT must be the **only** source of `requestingTenantId`.

**Safest enforcement layer.** Delete the header/query fallback in `getRequestOrganizationId`. The fallback is a global capability — no single route handler can repair it. A patch to the route handler is theatre while the primitive remains permissive.

---

### Exploit 4 — `x-user-role: super-admin` global cross-tenant bypass

**Attack path.** Attacker sends any backend mutation with:

```
x-user-role: super-admin
```

(or `x-verifier-role: super-admin`, or `x-role: super-admin`.)

**Outcome today: SUCCEEDS against any route that calls `enforceOrganizationMatch`.**

`parseRequestRole` ([tenantGuard.ts:144-150](apps/api/backend/src/middleware/tenantGuard.ts:144)) accepts any of three header names; `isSuperAdmin` ([tenantGuard.ts:152-158](apps/api/backend/src/middleware/tenantGuard.ts:152)) returns true on the case-folded literal `super-admin`. `enforceOrganizationMatch` then short-circuits with no JWT consultation. **The attacker has assumed a global cross-tenant administrator role by typing eleven characters into a header.**

**Why succeeds.** Role is not derived from the JWT. `parseRequestRole` is a textbook header-trust pattern. There is no Clerk validation, no signature, no allow-list. `OWNERSHIP_INVARIANTS.md §2.3` ("no global admin role bypasses tenant boundaries; ADMIN may operate cross-tenant only on routes explicitly designed for it, with audit-event writes per row") is fundamentally violated.

**Missing invariant.** RBAC role must be server-derived from `sessionClaims.vitalcv.role` (or `team_role`); cross-tenant admin requires per-route opt-in plus an audit row on every cross-tenant access.

**Missing ownership proof.** Signed JWT-bound role; per-row audit attribution.

**Safest enforcement layer.** **Delete `parseRequestRole` and `isSuperAdmin`** from the backend. Replace with a Clerk-validated middleware that reads `sessionClaims` only. Until that lands, the super-admin bypass is a P0 in production today, **independent of W2-PR2B**, and any W2-PR2B ownership check is bypassable via two extra HTTP headers.

---

### Exploit 5 — Stale review ownership via post-revocation JWT replay

**Attack path.** Attacker was admin of Org A. They captured `entityId = X` (an Org A review) and a fresh JWT. They are removed from Org A. Within Clerk JWT TTL (~60s), they replay:

```
POST /api/employer-review/X/accept
Cookie: __session=<JWT issued before revocation>
```

**Outcome today: SUCCEEDS within TTL.**

The JWT signature is valid; Clerk has not yet expired the session; the proxy reads `userId`; the backend reads the proxy header and writes the acceptance.

**Why succeeds.** Clerk JWT TTL is the only enforcement. There is no Clerk webhook that invalidates JWTs on org-membership change, and there is no DB read that re-confirms active membership at mutation time. `OWNERSHIP_INVARIANTS.md §3.4` ("`actorId` never defaulted") addresses the audit row but not the access decision.

**Missing invariant.** Mutation-time re-confirmation that the actor still has `team_role` ≥ required for the requesting org. This is more than the JWT — it is a DB read against an `OrganizationMembership` (or equivalent) table with `revokedAt IS NULL`.

**Missing ownership proof.** **Active** membership of the actor in the row's owning org; not a stale JWT.

**Safest enforcement layer.** Route handler — read `OrganizationMembership` for `(actorId, requestingOrgId)` and confirm `revokedAt IS NULL` before mutation. One DB read per mutation; tractable. Documenting it as deferred (per `w2-pr2-ownership-threat-model.md` T-4) without the route-handler DB check leaves a 60-second window of post-revocation mutation in which a removed admin can still write canonical-path rows.

---

### Exploit 6 — Readonly user mutates via `view` action

**Attack path.** A `readonly` member of Org A (or an anonymous caller) sends:

```
POST /api/employer-review/<entity>/view
```

**Outcome today: SUCCEEDS.**

`view` is in `PUBLIC_MUTATION_ACTIONS` at [route.ts:20](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:20). The proxy's `requiresAuth` check at [route.ts:361](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:361) is `false` for `view`. **Anonymous POST is permitted.** Whether the action causes a state change depends on the backend handler's `view` semantics — but the very classification ("public mutation action") is the worst-of-both-worlds antipattern: it admits the developer expected side effects while explicitly waiving auth.

**Why succeeds.** `view` is misclassified. If `view` is a read, it should be GET in `AUTHENTICATED_READ_ACTIONS`. If `view` is a write, it must run the canonical 6-step mutation gate. The current state — POST-classified-as-public — is the exact pattern `OWNERSHIP_INVARIANTS.md §3.1` forbids ("a 'mutating' POST route that should be readable must still gate readonly per its actual semantics").

**Missing invariant.** Action-level RBAC matrix that, for each action, declares whether it is read-only, mutating, role-gated, public-share-token-eligible, or authenticated-only. `view` is in no such matrix on this branch.

**Missing ownership proof.** For `view`-as-write: the canonical 6-step gate. For `view`-as-read: tenant-scoped read with no body fields trusted.

**Safest enforcement layer.** Reclassify `view` per `w2-pr2-route-ownership-matrix.md §A`: split into an `auth+ownership` path and a `share-token-public` path. Today the split is silent. Even after the split, the path-precedence rule must be explicit: **if both an auth session AND a share-token are present, the auth path runs.** Otherwise an authenticated cross-tenant attacker can use a captured Org-A token to read Org-A data while logged in as Org B (audit attributes to Org B; data emitted is Org A).

---

### Exploit 7 — Audit-write detachment via post-commit fault

**Attack path.** Attacker sends a legitimate `accept` request to an Org-A entity as an Org-A admin. The mutation succeeds; an environmental fault (DB connection drop, transaction commit timeout) interrupts the handler **after** the resource write but before the audit-event write — IF the handler's two writes are sequential awaits rather than wrapped in a single transaction.

**Outcome today: BLOCKED for `accept` and `confirm-start`** — both wrap their writes in `prisma.$transaction`. (`accept` at [employerReviewActions.ts:730](apps/api/backend/src/services/entity/employerReviewActions.ts:730); `confirm-start` at [employerActions.ts:863](apps/api/backend/src/routes/employerActions.ts:863).)

**But succeeds for actions whose handlers are not yet inspected.** `request-refresh`, `route-to-review`, `share-packet` — each writes an audit row separately ([employerActions.ts:611, 699](apps/api/backend/src/routes/employerActions.ts:611)) and these calls are NOT visibly inside `$transaction` blocks at those line ranges. (Verification §15 follow-up — the §3.B contract requires every mutating action to wrap.) For any action whose audit write is sequential, the post-commit-fault scenario produces a mutation-without-audit row.

**Why succeeds where it succeeds.** `OWNERSHIP_INVARIANTS.md §3.4 + §4.3` (atomic write) requires `prisma.$transaction((tx) => { resourceUpdate; auditWrite; })`. A handler that opens two awaits sequentially will, on failure between them, persist the mutation without the audit row. Mixed coverage (some actions wrapped, some not) is the worst case: review confidence is high for `accept` but the contract is silently broken on `share-packet` / `request-refresh`.

**Missing invariant.** Every mutation MUST be wrapped in `prisma.$transaction` with both the resource update and the audit write inside the same callback. The contract is uniform across all 5 mutating actions.

**Missing ownership proof.** **The audit row IS the ownership proof for after-the-fact accountability.** Without it, "who did this?" returns null.

**Safest enforcement layer.** The proposed `atomicMutateWithAudit` helper. The helper must be the **only** way mutating route handlers touch the DB. Tests must mock Prisma's `$transaction` and assert both writes occur within a single callback. PR2B scaffolding must require all mutating routes to call this helper or fail static lint.

---

### Exploit 8 — Mutation-before-audit race: 200 returned before audit commit

**Attack path.** A more aggressive variant of #7: the handler writes the resource, returns 200 to the caller, then writes the audit row asynchronously (`void prisma.auditEvent.create(...)` or a deferred queue). The audit row never lands; the caller has confirmation of success.

**Outcome today: indeterminate — depends on per-action implementation.** None of the inspected handlers exhibit fire-and-forget audit writes today, but the contract is not enforced structurally — a future change can introduce the pattern silently.

**Why succeeds when it does.** The atomic-write rule applies to the response too. By the time the caller has a 2xx, both writes are committed. `OWNERSHIP_INVARIANTS.md §3.4` implies this; the missing W2-PR2B `audit-coupling.md` would have made it explicit.

**Missing invariant.** "No 2xx response before audit-write commit." Required wording in the scaffolding plan; absent today.

**Missing ownership proof.** Post-commit acknowledgement to the caller is the operational ground truth. If audit lags, breach-indicator queries see a hole.

**Safest enforcement layer.** Structural — the helper returns the result only after `await tx.commit()`; the route handler returns 2xx only on the helper's resolved value. Static-typing the helper's return as `Promise<{ persisted: T; auditEventId: string }>` makes "no audit row" a type error at handler boundary.

---

### Exploit 9 — Workflow bypass via `(employerId, clinicianNpi)` fallback in `confirm-start`

**Attack path.** Attacker (Org A admin) has previously accepted clinician X for entity `E1` (a legitimate Org-A entity). Now attacker sends:

```
POST /api/employer-review/<entity-E2-belonging-to-clinician-X-but-different>/confirm-start
{ "startedAt": "...", "role": "...", "facility": "..." }
```

The body's `acceptanceId` is omitted, forcing the fallback path.

**Outcome today: SUCCEEDS — entity-scope drift.**

At [employerActions.ts:830-839](apps/api/backend/src/routes/employerActions.ts:830), the handler runs:

```
prisma.employerAcceptance.findFirst({
  where:   { employerId, clinicianNpi: subject.clinicianNpi, status: 'ACCEPTED' },
  orderBy: { acceptedAt: 'desc' },
})
```

**The lookup is keyed by `(employerId, clinicianNpi)` only — NOT by the URL's `entityId`.** It picks up the most-recent acceptance for this employer-clinician pair across ALL entities. The attacker's prior acceptance for `E1` satisfies the gate; the handler then writes a `StartAttestation` referencing that acceptance but with `entityId = E2` from the URL.

The result is a `StartAttestation` row that asserts "the start at E2 chains off the acceptance at E1." Canonical-path Recognition→Acceptance→Start is corrupted at the binding.

**Why succeeds.** The fallback search broadens scope: workflow legitimacy is verified ("there is some acceptance for this clinician by this employer"), but **the acceptance is not bound to the URL `entityId`**. `OWNERSHIP_INVARIANTS.md §3.3` ("workflow legitimacy is not ownership; a correct workflow transition on an unowned scope is still forbidden") is structurally violated — though here the *tenant* boundary is intact (same employer, same Org A), the *entity* boundary is not.

**Missing invariant.** The `confirm-start` handler must require:

1. `acceptance.entityId === URL.entityId` (entity-binding); and
2. `acceptance.tenantId === requestingTenantId` (tenant-binding); and
3. `acceptance.status === 'ACCEPTED'` (workflow state); and
4. `acceptance.revokedAt IS NULL` (revocation).

All four conditions, all required, all evaluated inside the transaction with row lock.

**Missing ownership proof.** Acceptance → start binding by entity, not by NPI fallback.

**Safest enforcement layer.** The workflow gate runs **after** the ownership check (Layer 3 → Layer 4). Both must pass. The fallback search by `(employerId, clinicianNpi)` is dangerous and must be deleted; the URL's `entityId` is the only acceptable binding key. PR2B scaffolding must explicitly forbid the fallback when `entityId` is in the URL.

---

### Exploit 10 — Replay-style repeated mutations without idempotency

**Attack path.** Attacker captures one valid `POST /api/employer-review/<entity>/request-refresh` request and replays it 10,000 times in 60 seconds.

**Outcome today: SUCCEEDS — every replay succeeds.**

Each replay creates a new `RefreshRequest` row; the verifier-side notifier fires; the audit log fills with identical-but-distinct rows. The duplicate-acceptance guard at [employerActions.ts:175-181](apps/api/backend/src/routes/employerActions.ts:175) exists for `accept` (keyed on `(employerId, clinicianNpi, status='ACCEPTED')`) but **does not extend to `request-refresh`, `route-to-review`, or `share-packet`**. There is no `correlationId` uniqueness constraint on `AuditEvent`. No `(actorId, correlationId, 24h)` dedup runs.

**Why succeeds.** `OWNERSHIP_INVARIANTS.md §3.4` lists `correlationId` as a required `AuditEvent` field with `replaySafe: boolean`, but the wave's threat model (T-5) defers replay protection to follow-up "if not trivial." It is not trivial in absence of a unique constraint on the audit table; W2-PR2B should not punt.

**Worse: per `w2-pr2b-adversarial-review.md §3.A6`, the dedup key proposed in `mutation-semantics §3` is `(actorId, correlationId)`** — but `correlationId` is request-scoped (header-supplied or generated). Each replay carries a fresh UUID; the dedup never fires. **The proposed dedup key is wrong.** The correct key is `(actorId, payloadHash, time-window)` — `payloadHash` is server-derived from the redacted body and is identical across true replays.

**Missing invariant.** Every audit row carries `payloadHash`; the audit table has `@@unique([actorId, payloadHash, decidedAtBucket])` or per-action equivalents; duplicate inserts return 409 `duplicate_request`. `correlationId` is auxiliary metadata, not the dedup primary.

**Missing ownership proof.** Server-derived request fingerprint via `payloadHash` — the caller's commitment to a single mutation, written once.

**Safest enforcement layer.** Schema constraint + helper. The W2-PR2B scaffolding plan must add `payloadHash NOT NULL` to `AuditEvent` and a unique index keyed on `(actorId, payloadHash, decidedAt-bucket)`. Without the constraint, the helper is best-effort. With the constraint, replay is impossible.

---

### Bonus exploit — Anonymous NPI iteration via refresh-requests

**Attack path.** Attacker (no auth, no JWT) iterates the NPI keyspace (10-digit numerics):

```
GET /api/employer-review/npi/1234567890/refresh-requests
GET /api/employer-review/npi/1234567891/refresh-requests
…
```

**Outcome today: SUCCEEDS for arbitrary NPIs.**

[refresh-requests/route.ts](apps/web/app/api/employer-review/npi/%5Bnpi%5D/refresh-requests/route.ts) does **not** call `auth()`. The only filter is the 10-digit NPI regex. The proxy returns `{ hasPendingRequest, count, latestAt }` for any NPI. Cross-tenant probing is unimpeded; an attacker can map which clinicians have pending refresh requests across the entire registry without a session.

**Why succeeds.** The route is in the tenant-guard skip-list at the backend, and the proxy never authenticates. The route does not appear in any RBAC matrix today.

**Missing invariant.** Authenticated read with tenant-scoped filtering — caller's `requestingTenantId` plus the NPI; reject if the NPI's pending-request stream belongs to another tenant.

**Missing ownership proof.** JWT-derived `requestingTenantId` plus a join on the refresh-request table's `tenantId` column (which does not yet exist — schema gap).

**Safest enforcement layer.** Both proxy (auth gate) and backend (`tenantId` join). Today neither exists. This route is in the W2-PR2B implementation-lock §1 file list, so the scaffolding plan must explicitly cover it.

---

## 3. Determinations on the six adversarial questions

### Q1 — Can ownership derivation become ambiguous?

**Yes — and is, today.** Four sources compete:

| Source | Trust | Currently consulted? |
|---|---|---|
| JWT `sessionClaims.vitalcv.org_id` | TRUSTED | **No** — not extracted on the proxy |
| `?organizationId=` query | UNTRUSTED | Yes ([organizationContext.ts:65-67](apps/api/backend/src/middleware/organizationContext.ts:65)) |
| `x-org-id` header | UNTRUSTED | Yes ([organizationContext.ts:68-70](apps/api/backend/src/middleware/organizationContext.ts:68)) |
| Body `organizationContextId` / `bundleId` | UNTRUSTED | Yes ([employerReviewActions.ts:709-714](apps/api/backend/src/services/entity/employerReviewActions.ts:709)) |

The W2-PR2B scaffolding plan would need to delete the three untrusted paths and *introduce* the trusted one. It is silent because it does not exist on the merge target.

### Q2 — Can workflow legitimacy bypass ownership?

**Yes.** `confirm-start` falls back to `findFirst({employerId, clinicianNpi})` — workflow is verified ("an acceptance exists for this NPI") but **the acceptance is not bound to the URL `entityId`** (Exploit 9). An attacker confirms-start an entity-id they do not own as long as they have any acceptance for that clinician. Ownership scope is silently broadened by workflow indirection.

The deeper architectural failure is that the workflow gate and the ownership gate are conflated into a single DB lookup whose `where` clause omits `entityId`. The two layers are not actually layered; one short-circuits the other.

### Q3 — Can audit writes become detached from mutations?

**Yes for at least three actions.** `accept` and `confirm-start` are correctly wrapped in `prisma.$transaction`, but `request-refresh`, `route-to-review`, and `share-packet` write audit rows separately ([employerActions.ts:611, 699](apps/api/backend/src/routes/employerActions.ts:611)) without a visible `$transaction` wrapper at those line ranges. Mixed coverage is the worst case for review confidence: high for `accept`, silently broken for `share-packet`. Without the missing `audit-coupling.md` to make the contract uniform, every action's adoption is incidental.

### Q4 — Can readonly indirectly influence state?

**Yes via the `view` ambiguity.** `view` is in `PUBLIC_MUTATION_ACTIONS` and accepts anonymous POST. The taxonomy itself — "public mutation action" — is incoherent. If the backend `view` handler emits any side effect (counter bump, `lastViewedAt`, share-token issuance), readonly users (and anonymous callers from any org) cause writes. PR2B must reclassify before any code lands.

### Q5 — Can request parameters influence ownership incorrectly?

**Yes — via four channels:**

1. **URL `[entityId]`** — names the resource selector but is not validated against actor's tenant. No compare runs.
2. **Body `organizationContextId`** — flows through proxy validation ([route.ts:118-127](apps/web/app/api/employer-review/%5BentityId%5D/%5Baction%5D/route.ts:118)) and becomes `attribution.organizationId` ([employerReviewActions.ts:716-720](apps/api/backend/src/services/entity/employerReviewActions.ts:716)).
3. **Query `?organizationId=`** — read by `getRequestOrganizationId` ([organizationContext.ts:81](apps/api/backend/src/middleware/organizationContext.ts:81)).
4. **Header `x-org-id`** — read by `getRequestOrganizationId` ([organizationContext.ts:81](apps/api/backend/src/middleware/organizationContext.ts:81)).

Channels (2)–(4) must be removed from the ownership-derivation path. Channel (1) must be paired with an ownership compare against the JWT-derived `requestingTenantId`.

### Q6 — Can tenant boundaries drift during mutation?

**Yes — across two boundary hops.**

- **Hop 1: Next.js proxy → backend.** The proxy forwards `x-clerk-user-id` only. **No org claim propagates.** The backend independently derives org from the request (header / query / body fallback) and may pick a different value than the proxy expected. The two layers do not share a tenant identity for the same request.
- **Hop 2: backend → Prisma write.** The backend sets `acceptedByOrgId = attribution.organizationId` where attribution is derived from request body. The persisted row's owning org is whatever the body says.

There is no atomic tenant lock across the request lifecycle. The W2-PR2B scaffolding must define the tenant identity carrier from auth → request → DB row as a **single unbroken chain**, with `tenantId` set once at the proxy from `JWT.org_id`, propagated as a server-set header (or signed token), and written as a typed FK column. Today no such chain exists.

---

## 4. Compounding pre-existing vulnerabilities (independent of W2-PR2B)

The simulation surfaced four live P0/P1 vulnerabilities on the current branch, not specific to W2-PR2B but blocking any safe overlay:

1. **`x-user-role: super-admin` header bypass** ([tenantGuard.ts:144-158](apps/api/backend/src/middleware/tenantGuard.ts:144)). Cross-tenant access is one HTTP header away. **P0** — must be patched before W2-PR2B can claim ownership enforcement.
2. **`getRequestOrganizationId` query/header fallback** ([organizationContext.ts:80-82](apps/api/backend/src/middleware/organizationContext.ts:80)). `?organizationId=` and `x-org-id` override JWT-derived org for any backend route that does not have a stricter middleware. **P0** — must be patched before W2-PR2B.
3. **`enforceOrganizationMatch` returns 403 not 404** ([tenantGuard.ts:188](apps/api/backend/src/middleware/tenantGuard.ts:188)). Leaks tenant existence; violates `OWNERSHIP_INVARIANTS.md §6.2`. **P1** — must be reconciled with the 404-everywhere rule.
4. **`/api/employer-review/npi/[npi]/refresh-requests` admits anonymous reads** ([refresh-requests/route.ts](apps/web/app/api/employer-review/npi/%5Bnpi%5D/refresh-requests/route.ts)). Anonymous NPI-keyspace probing returns pending-request metadata. **P1** — info leak across the registry.

If W2-PR2B implements ownership at the proxy without first patching (1)–(2), the proxy will refuse a malformed request, the attacker will simply call the backend directly, and the backend's bypass paths will succeed. Defense-in-depth requires both layers.

---

## 5. Schema-level gaps blocking implementation

W2-PR2B as the W2-PR2 architecture envisions **requires schema changes that are FOUNDER_REQUIRED per `openclaw-risk-classification.md`:**

| Required schema change | Reason | Doc that mandates it |
|---|---|---|
| Add `EmployerAcceptance.tenantId String NOT NULL @db.Uuid` (replacing or augmenting free-text `organization`) | Ownership compare requires a typed tenant FK | `RESOURCE_OWNERSHIP_DICTIONARY.md` §1, §9 |
| Add `EmployerAcceptance @@unique([entityId, tenantId])` | Prevents same-org dual-acceptance race; closes T-6 | `OWNERSHIP_INVARIANTS.md` (T-6) |
| Add `AuditEvent.actorId String NOT NULL`, `payloadHash String NOT NULL`, `correlationId String NOT NULL` | Enables attribution + replay protection | `OWNERSHIP_INVARIANTS.md §3.4`, Exploit 10 |
| Add `@@unique([actorId, payloadHash, decidedAtBucket])` on `AuditEvent` | Replay protection, server-derived | `w2-pr2b-adversarial-review.md §3.A6` |
| Make `AuditEvent.organizationId NOT NULL` for tenant-scoped events; CHECK `(organizationId IS NOT NULL OR subjectId IS NOT NULL)` | Closes "audit row without owner"; supports subject-scoped events | `RESOURCE_OWNERSHIP_DICTIONARY.md §4`, `w2-pr2b-adversarial-review.md §3.A2` |
| Introduce `EmployerReview` model with explicit `tenantId NOT NULL` | Without an `EmployerReview` row to compare against, the ownership check has no source of truth | `RESOURCE_OWNERSHIP_DICTIONARY.md §1` |

W2-PR2 ownership-model §7 (out-of-scope) explicitly says: "Change Prisma schema (uses existing `EmployerReview.tenantId` and equivalents; if a needed field is missing, that's a separate FOUNDER_REQUIRED PR)." That clause is now dispositive: **the field is missing, the model is missing, and the unique constraint is missing.** W2-PR2B cannot run without a schema PR landing first.

---

## 6. Open verification questions for the implementation PR

These cannot be answered from the simulation; they must be confirmed in implementation review:

1. Are the `request-refresh`, `route-to-review`, and `share-packet` handlers' resource writes + audit writes inside `prisma.$transaction` callbacks? (Exploit 7 — verified for `accept` and `confirm-start`; not yet for the other three.)
2. Does the `view` action emit any persistent side effect (counter bumps, `lastViewedAt`, share-token issuance)? (Exploit 6.)
3. Are there any other backend routes that call `enforceOrganizationMatch` for `/api/employer-review/*` paths despite the skip-list? (Tenant-guard skip does not preclude ad-hoc per-route calls.)
4. Is there any other entry point — gRPC, GraphQL, internal cron, batch worker — that writes `EmployerAcceptance` rows? (T-7.)
5. Does Clerk's session-token customization actually emit `vitalcv.org_id`, or is the path `org_id`, `activeOrganizationId`, etc.? (`w2-pr2b-adversarial-review.md §3.B4`.)

---

## 7. Verdict

**IMPLEMENT_BLOCKED.**

In priority order:

**(R1) The named scaffolding does not exist on the merge target.** Four of eight named source documents (`w2-pr2b-scaffolding-plan.md`, `w2-pr2b-mutation-flow.md`, `w2-pr2b-ownership-derivation.md`, `w2-pr2b-audit-coupling.md`) **do not exist anywhere in the repository under those names**. The remaining four exist only on planning branches (`db0502ba`, `8f91ff2d`, `241b770b`) and are not on the merge-target trunk. There is no contract for the implementation to honor, no specification for reviewers to check against, no `mutation-flow` doc to verify call ordering against, no `audit-coupling` doc to verify atomic-write requirements against. Adversarial simulation against an absent specification is unbounded; reviewers cannot certify what they cannot read.

**(R2) The schema cannot support the ownership invariants the W2-PR2 architecture requires.** `EmployerAcceptance` has no `tenantId` foreign key — it carries free-text `organization` populated from the request body. There is no `EmployerReview` Prisma model. `AuditEvent.organizationId` is nullable and there is no `payloadHash` column to support replay protection. These are FOUNDER_REQUIRED schema changes that must land in a separate PR before W2-PR2B can implement the compare. Per `w2-pr2-ownership-model.md §7`, schema changes are explicitly out of scope for this wave.

**(R3) Four pre-existing P0/P1 vulnerabilities live on the current branch, independent of W2-PR2B.** The `x-user-role: super-admin` header bypass and the `getRequestOrganizationId` query/header fallback together mean any well-intentioned proxy-layer ownership check is trivially circumvented by calling the backend with two extra HTTP headers. The 403-not-404 leak in `enforceOrganizationMatch` violates the enumeration-resistance invariant directly. The anonymous `/api/employer-review/npi/[npi]/refresh-requests` route admits cross-tenant probing today. W2-PR2B as scoped does not patch the backend's tenant-derivation primitives; without those patches, defense-in-depth fails and the proxy-side check is theatre.

**(R4) The W2-PR2 threat model defers four threats (T-4 stale JWT, T-5 replay, T-6 race, T-8 schema drift) — three of which the simulation reproduces as currently exploitable.** Deferral is acceptable when the deferred risk is bounded; here it is not, because the bound (TTL, schema constraint) is itself absent. Worse, the proposed dedup primary key `(actorId, correlationId)` is **architecturally wrong** (Exploit 10 / `w2-pr2b-adversarial-review.md §3.A6`): `correlationId` is request-supplied or fresh-per-request, so the dedup never fires. Replay protection as currently specified is non-functional.

**(R5) Workflow legitimacy bypasses ownership at `confirm-start` (Exploit 9, P0).** The `findFirst({employerId, clinicianNpi})` fallback at [employerActions.ts:830-839](apps/api/backend/src/routes/employerActions.ts:830) lets an attacker chain a `StartAttestation` for entity `E2` off an acceptance for entity `E1`, both belonging to the same clinician. This is canonical-path corruption. PR2B scaffolding must explicitly forbid the fallback when `entityId` is in the URL — but no such doc exists on this branch to make the prohibition merge-gateable.

**(R6) Mutation-flow / audit-coupling / mutation-gate-sequence ordering is not documented for PR2B on the merge target.** The simulation cannot verify that the implementation will run Layer 1 → 2 → 3 → 4 → 5 → 6 in order, because no doc tells reviewers what order to gate against. Reordering is the most common ownership defect (per the OWNERSHIP_INVARIANTS doctrine compliance checklist on the planning branch). Reviewers cannot enforce an unwritten order.

**Required actions before this verdict can flip to IMPLEMENT_SAFE:**

1. **Author and merge** `docs/ops/w2-pr2b-scaffolding-plan.md`, `docs/ops/w2-pr2b-mutation-flow.md`, `docs/ops/w2-pr2b-ownership-derivation.md`, `docs/ops/w2-pr2b-audit-coupling.md` onto the merge target — not a triage branch.
2. **Land the W2-PR2 architecture documents** (`OWNERSHIP_INVARIANTS.md`, `RESOURCE_OWNERSHIP_DICTIONARY.md`, `w2-pr2-route-ownership-matrix.md`, `w2-pr2-ownership-model.md`, `w2-pr2-mutation-semantics.md`, `w2-pr2-ownership-threat-model.md`, `w2-pr2-resource-map.md`, `MUTATION_GATE_SEQUENCE.md`) onto the merge target.
3. **Apply the 12 spec deltas in `w2-pr2b-adversarial-review.md §4`** — most critically the dedup-key correction `(actorId, correlationId)` → `(actorId, payloadHash, window)` (closes A6) and the transitive-ownership rule for parent-referenced workflow gates (closes A1).
4. **Patch the four P0/P1 backend vulnerabilities** identified in §4 (super-admin header bypass; query/header org fallback; 403→404 reconciliation; anonymous refresh-requests). These are independent of W2-PR2B and must land first.
5. **Author and merge a FOUNDER_REQUIRED schema PR** adding `EmployerReview` (or equivalent) with `tenantId NOT NULL`, `EmployerAcceptance.tenantId NOT NULL` + `@@unique([entityId, tenantId])`, and `AuditEvent` `actorId`/`payloadHash`/`correlationId NOT NULL` with `@@unique([actorId, payloadHash, decidedAtBucket])`. The schema PR is the logical prerequisite to any ownership compare.
6. **Author** the `extractVerifierClaims` helper (W2-PR1A), the `requireOwnedEmployerReview` helper, and the `atomicMutateWithAudit` helper — separately from W2-PR2B, with their own tests — so PR2B's scope is "wire handlers to existing helpers," not "design and implement helpers."
7. **Re-run this adversarial simulation** against the actual scaffolding once the above land. The verdict can then be re-evaluated on a branch where the scaffolding under simulation actually exists.

Until those seven prerequisites complete, W2-PR2B should not be implemented, opened as a PR, or merged. Implementing on the current substrate will produce an ownership check that looks correct in code review but is bypassable by anyone who reads the codebase and types two HTTP headers.

---

> Adversarial simulation is the test of the specification.
> If the specification does not exist on the branch the simulation runs against,
> the simulation IS the specification — and the only honest reading is BLOCKED.

**IMPLEMENT_BLOCKED**
