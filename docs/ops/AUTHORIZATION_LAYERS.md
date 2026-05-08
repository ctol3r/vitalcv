# VitalCV Authorization Layers

**Version:** 2026-05-07 · **Status:** constitutional · **Authority:** subordinate to `VITALCV_OPERATING_DOCTRINE.md` and `SECURITY_INVARIANTS.md`; supersedes any "we'll do auth in middleware" or "the route handler is enough" simplifications.

This document defines the canonical layered authorization model for VitalCV. Each layer has a precise responsibility and a precise non-responsibility. Layers compose; no single layer is sufficient alone.

This document exists to prevent:
- Auth drift (a check moved from layer A to layer B without preserving the property)
- Ownership confusion (middleware claiming to enforce ownership; ownership belongs to the route handler)
- Middleware overreach (middleware doing a DB read and becoming a single point of failure)
- RBAC misuse (treating role as a proxy for ownership)
- Workflow authorization ambiguity (assuming a state-transition check is the same as a permission check)

---

## Five layers, each load-bearing

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   1. MIDDLEWARE AUTHORIZATION    — coarse, fast, identity-coherence   │
│                                    & route-classification             │
│                                                                       │
│   2. RBAC HELPER AUTHORIZATION   — pure, deterministic, role-policy   │
│                                    decisions on a typed input         │
│                                                                       │
│   3. OWNERSHIP AUTHORIZATION     — route-handler-resident; verifies   │
│                                    the requesting actor owns the      │
│                                    resource named by the URL          │
│                                                                       │
│   4. WORKFLOW AUTHORIZATION      — domain-resident; verifies a        │
│                                    state-transition is legitimate     │
│                                    given the resource's current state │
│                                                                       │
│   5. AUDIT AUTHORIZATION         — visibility + traceability + scope  │
│                                    on audit-event reads & writes      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

A request that mutates a resource passes through all five before reaching `200 OK`. A read may skip layer 4 (no state transition). A failure at any layer ends the request.

---

## Layer 1 — Middleware Authorization

**Module:** `apps/web/middleware.ts` + `apps/web/lib/auth/orgInvitations.ts` (`isVerifierApiRoute`, `checkVerifierFailClosed`)

### Responsibilities

- **Identity coherence.** "Is this caller authenticated by Clerk?" Resolves `auth()`, reads `session.userId`. If absent for a protected route, redirects (browser) or returns 403 (API).
- **Route classification.** "What class of route is this?" Public, authenticated, role-gated, verifier-API, intelligence-API. Each class flows through a distinct branch.
- **Fail-closed behavior.** When auth infrastructure is degraded (Clerk unavailable, env vars missing, parser failure), the middleware emits the most-restrictive honest response — `503 clerk_unavailable` for verifier paths, `401`/redirect for protected non-API paths.
- **Coarse verifier gating.** For `/api/verifier/**`, the middleware runs the three RBAC gates (no_org_context → cross_org → readonly_blocks_mutation) on the JWT-derived org / role and the client-declared `x-verifier-org` header.
- **Degraded-auth protection.** A request that cannot be authoritatively decided is rejected. There is no "let it pass through and we'll figure it out later" path for security-sensitive routes.

### Does NOT guarantee

- **Resource ownership.** The middleware has no DB connection (Edge runtime). It cannot verify that resource X belongs to org Y. It validates only that the caller's JWT-claimed org matches their `x-verifier-org` header — not that the resource named by the URL is theirs.
- **Workflow authorization.** "Can this user accept this clinician right now?" requires reading the clinician's current state. Middleware doesn't.
- **Mutation authorization.** Beyond the readonly-blocks-mutation HTTP-method check, the middleware doesn't know whether a specific POST is allowed for the caller. The route handler does.
- **Audit visibility.** Middleware does not inspect what the route handler will emit; it cannot decide whether the response leaks audit data.

### Key constraints

- Edge-runtime safe (no `node:crypto`, no `Buffer` outside helpers, no Node-only APIs).
- Pure / deterministic decision functions only — no fetches, no DB, no Clerk API calls beyond `auth()`.
- Fail-closed pre-check fires BEFORE any branch that can return `NextResponse.next()` for a verifier path.

### Threat model defended

- Anonymous probes against verifier routes (`/api/verifier/**`) → 403/404 by middleware.
- Cross-tenant requests via forged `x-verifier-org` → 404 (Gate 2).
- Readonly users attempting POST/PUT/DELETE/PATCH → 403 (Gate 3).
- Clerk service outage → 503 (`checkVerifierFailClosed`).

### Threat model NOT defended

- A verifier in Org A reading a resource owned by Org B but using `x-verifier-org: org_a`. The middleware has no DB; the route handler must catch this at Layer 3.

---

## Layer 2 — RBAC Helper Authorization

**Module:** `apps/web/lib/auth/orgInvitations.ts` (`checkVerifierPermission`, `parseTeamRole`, `extractVerifierClaims`, `timingSafeEqualStrings`)

### Responsibilities

- **Deterministic role semantics.** Same inputs → same outputs. No env reads, no I/O, no logging in the decision path. Unit-testable in isolation.
- **Readonly enforcement.** `readonly` role + mutating HTTP method → `403 readonly_blocks_mutation`. Method-based, not route-semantic-based.
- **Org-context extraction.** `extractVerifierClaims` performs runtime validation of every JWT claim shape — `typeof` and `Array.isArray` checks, no type assertions. Hostile input (Symbol, function, recursive object) does not throw.
- **Runtime claim validation.** Empty-string `org_id`, non-string `team_role`, missing `vitalcv` claim, array-shaped `vitalcv` — all collapse to null fields → Gate 1 fires → 403 `no_org_context`.

### Does NOT guarantee

- **Resource ownership.** The helper has no knowledge of which resource the URL names. It only decides "is this caller's org claim coherent with their role and the org they claim to represent?"
- **Workflow legitimacy.** "Can this admin accept the clinician?" requires the clinician's current state. The helper doesn't see it.

### Key constraints

- All functions synchronous (no `async`, no `Promise`).
- All return types are total — never `undefined`, never `throw` on malformed input.
- `rbacEnforced` is the literal `true as const` — the flag cannot be widened to `boolean`.
- Gate evaluation order is immutable: no_org_context → cross_org → readonly_blocks_mutation. Locked by tests.

### Threat model defended

- Forged JWT (signature invalid) → Clerk rejects before this layer runs.
- Type-asserted claim coercion (Codex SAFE finding on W2-PR1) → eliminated by `extractVerifierClaims` runtime validation.
- Timing oracle on org_id compare → defended by `timingSafeEqualStrings` (full-byte XOR, no early return).
- Gate-ordering attack (probing for gate 3 to confirm role) → defended by gate 2 firing before gate 3.

---

## Layer 3 — Ownership Authorization

**Module:** route handlers under `apps/web/app/api/**/route.ts` — currently mostly absent; W2-PR2 (employer-review) and W2-PR4 (verifier routes) will introduce.

### Responsibilities

- **Resource ownership validation.** "Is the resource named by the URL parameter actually owned by the caller's org/clinician?" Performed via DB read (Prisma) or service call.
- **Org-resource relationship enforcement.** A verifier in Org A may not read or mutate a packet whose `tenantId` is Org B, even if Layer 1 and Layer 2 passed.
- **Tenant-boundary mutation protection.** A mutation that would change a row's `tenantId`, or attach a row to a different tenant, must be refused unless an explicit cross-tenant consent artifact is present.

### Examples (deferred — these are W2-PR2 / W2-PR4 scope)

- `POST /api/employer-review/[entityId]/accept` must verify the requesting employer-org is the original requester of `entityId`. Without this check, any authenticated employer can accept any entity.
- `GET /api/verifier/packet/[packetId]` must verify the packet's owning org matches the caller's JWT org.
- `POST /api/verifier/invite` must verify the inviting team member belongs to the org the invitation is for.

### Does NOT guarantee

- **Workflow legitimacy.** Ownership says "this is your resource"; workflow says "you can do THIS to your resource right now." Different layer.
- **Audit visibility.** Even when the caller owns the resource, they may not be entitled to read its full audit trail. Audit visibility is layer 5.

### Key constraints

- The route handler is the ONLY layer with DB access for ownership decisions.
- The check is **mandatory** for any route with a dynamic URL segment that names a resource (`[entityId]`, `[packetId]`, `[receiptId]`, `[npi]`, `[caseId]`, `[appId]`).
- Cross-tenant mismatch must return **404** (not 403) — enumeration resistance per `SECURITY_INVARIANTS.md` §5.5.
- The check uses the JWT-derived `requestingOrgId`, **never** the client-supplied `x-verifier-org` header.

### Threat model defended (after W2-PR4)

- Verifier in Org A reading Org B's packet (despite passing Layer 1 + Layer 2 by claiming `x-verifier-org: org_a`).
- Employer accepting another employer's entity.
- Issuer modifying another issuer's review.

### Status today

**Mostly absent.** Currently no `/api/verifier/*` routes exist on origin/main. The `POST /api/employer-review/[entityId]/accept` endpoint (one of the highest-risk surfaces) does not enforce ownership today — this is a known launch blocker tracked in `launch-blockers.md` and slated for W2-PR2.

---

## Layer 4 — Workflow Authorization

**Module:** domain-resident — `apps/web/lib/issuer-verification/policyReview.ts`, `apps/web/lib/issuer-verification/psvReceipt.ts`, the canonical-path domain in `packages/domain-common/employmentGuards.ts`.

### Responsibilities

- **State-transition legitimacy.** Given a resource's current state and the requested action, is the transition allowed? E.g., a `ReceiptCandidate` in `review_required` state cannot be promoted to `PSVReceiptCandidate` — the candidate must first reach `ready_for_policy_review`.
- **Workflow sequencing.** "Recognition → Acceptance → Start" is the canonical path. A `Start` cannot be emitted without an `Acceptance`. An `Acceptance` cannot be emitted without a `Recognition`.
- **Allowed action progression.** Each role has a permitted set of actions per resource state. An admin can `accept_candidate` from `ready_for_policy_review` but not from `unable_to_verify`.

### Examples

- The five-gate flow in `applyPolicyReviewDecision` (action → wrong_office → unable_to_verify → conflict_review → ready_state → legally_only-needs-limitation-note) is workflow authorization.
- `promotePsvReceiptCandidate` requires the policy review decision was `accepted_as_psv_candidate` AND the candidate was in `ready_for_policy_review` state. Both are workflow checks.
- `EmployerAcceptance` cannot be created without a referenced valid `Recognition` (canonical-path enforcement).

### Does NOT guarantee

- **Authentication or authorization.** The workflow layer assumes the caller has already passed Layer 1, Layer 2, and Layer 3. It enforces only state-transition correctness.
- **Audit recording.** A successful workflow transition still requires an `AuditEvent` write — that's layer 5.

### Key constraints

- Workflow checks are **pure transforms** in `apps/web/lib/issuer-verification/`. No I/O, no DB writes (those happen in route handlers per the truth contract).
- Type-level guarantees: `decisionGrade: false` (literal) on `ReceiptCandidate`; `proofTier: 'receipt_candidate'` (literal). A future caller cannot assemble an out-of-state artifact at compile time.
- Gate ordering inside workflow checks is immutable. Re-ordering is a defect.

### Threat model defended

- Forged state transitions ("I claim this candidate is ready for promotion" — verified via the candidate's actual `reviewState` in DB).
- Out-of-order canonical path (`Start` without `Acceptance` — refused by `employmentGuards.ts`).
- Promotion of an `unable_to_verify` candidate to PSV grade — refused by gate 2 of `canCreatePsvReceiptCandidate`.

---

## Layer 5 — Audit Authorization

**Module:** `apps/web/lib/issuer-verification/auditPersistence*.ts`, `apps/web/app/api/audit/*` (when wired); `AuditEvent` table writes in `apps/api/backend/`.

### Responsibilities

- **Audit visibility.** Reading audit-event rows is a separate authorization decision. A user authorized to view a packet may not be authorized to view the packet's full audit history. Audit reads run their own role check (typically `ADMIN`).
- **Mutation traceability.** Every mutating verifier action MUST emit an `AuditEvent` row in the same transaction as the mutation. The row carries `actorId`, `action`, `subjectId`, `decidedAt`, `tenantId`, `payloadHash`, `correlationId`, `replaySafe`. A mutation that does not write an audit event is a defect.
- **Append-only guarantees.** No `UPDATE` or `DELETE` path on the `AuditEvent` table. Corrections happen by appending a new row that references the original (`correctsEventId`).
- **Scoped audit access.** A tenant cannot read another tenant's audit rows. Cross-tenant audit reads require a separate explicit consent artifact.

### Examples

- `POST /api/employer-review/[entityId]/accept` (when wired in W2-PR2) must atomically:
  1. Write the `EmployerAcceptance` row.
  2. Write an `AuditEvent` row.
  Both succeed together or neither does.
- `GET /api/audit/events` is `ADMIN`-only, not `VERIFIER`-role-allowed.
- The `recordedBy: 'demo'` literal on demo-surface audit metadata is a layer-5 convention — demo writes are tagged so they can never be misinterpreted as production audit records.

### Does NOT guarantee

- **Resource access correctness.** Audit visibility is independent of resource ownership. The audit endpoint may return audit rows for resources the caller no longer owns (e.g., a clinician who left an org may still appear in that org's audit log).
- **Workflow correctness.** Audit records what happened; it does not enforce what should happen.

### Key constraints

- Mutating endpoint + AuditEvent write are **atomic** (same DB transaction).
- `actorId` is **never** defaulted to `'system'`, `'unknown'`, or empty. A row that would have been written with a defaulted actor must abort and surface 500.
- The audit table has no UPDATE / DELETE migration path — schema-level enforcement (founder-required to introduce).

### Threat model defended

- Silent mutation (write without audit) → defended by atomic transaction discipline.
- Audit log exfiltration → defended by `ADMIN`-only role on read endpoints.
- Audit forgery (writing a fake row with someone else's `actorId`) → defended by per-row `actorId` resolution from the JWT, not from request body.

### Status today

- Most mutating endpoints under `apps/web/app/api/**` do not yet write `AuditEvent` rows — tracked as W2-PR3 dependency.
- Issuer review surfaces are `recordedBy: 'demo'` by truth contract (deferred to feature-flag `ISSUER_PERSISTENCE_ENABLED` per Code Red Phase 3).
- `/api/audit/events` is currently public — needs `ADMIN` gate (W2-PR3).

---

## Explicit distinctions

These five concepts are routinely conflated. Every reviewer and implementer must hold them apart:

### Authentication

> Who is this caller?

Answered by Clerk (`auth()`). Returns a session object with `userId`, `sessionClaims`. Resolves at Layer 1.

A valid session does NOT imply authorization. A `userId` from Clerk only means "this person was issued a JWT we trust." It does not mean they can read or mutate anything.

### Authorization

> What is this caller allowed to do?

Answered by Layers 1–2 (RBAC) and Layer 3 (ownership). Layers 1–2 decide based on role + org claims (the JWT). Layer 3 decides based on resource-ownership state (the DB).

Authorization is **not** "can this person sign in?" That's authentication. Authorization is "having signed in, can they touch this resource?"

### Ownership

> Does this caller own this resource?

Answered exclusively by Layer 3 — the route handler. Requires DB access. The middleware (Layer 1) and the RBAC helper (Layer 2) **cannot** answer this question; they have no DB access in the Edge runtime.

`x-verifier-org` is a client declaration of which org the caller wants to act on behalf of. It is **not** ownership proof. Layer 1 validates it against the JWT (identity coherence). Layer 3 validates the resource's actual `tenantId`.

### Workflow legitimacy

> Is the requested action legal in the current resource state?

Answered by Layer 4 — domain modules. A user with role + org + ownership for a `ReceiptCandidate` may still be unable to promote it if the candidate is in `unable_to_verify` state.

Workflow checks are **state-aware**. RBAC checks are **state-blind**. They are different layers and must compose.

### Audit visibility

> Can this caller read this audit row?

Answered by Layer 5. A user with all of: authentication, authorization, ownership, workflow legitimacy MAY STILL not be entitled to read every audit row of every action they took. Audit access is typically `ADMIN`-only or scoped to a redacted summary view.

Audit visibility is **independent** of resource access. Conflating them is a privilege-escalation pattern (e.g., "if I can read the resource, I should be able to read its audit trail" — false).

---

## How the layers compose for a single mutating request

For `POST /api/verifier/team/invite` (W2-PR4 deferred):

1. **Layer 1 — Middleware:**
   - Is auth service available? (CLERK_SECRET_KEY present.) ✓
   - Is the path verifier-API? ✓
   - Resolve session. `auth().userId` present? ✓
   - Run `checkVerifierPermission(...)`:
     - Gate 1: `requestingOrgId` and `teamRole` non-null? ✓
     - Gate 2: `requestingOrgId === resourceOrgId` (timing-safe)? ✓
     - Gate 3: `teamRole !== 'readonly'` (it's a POST)? ✓ (assume admin)
   - Layer 1 passes; `NextResponse.next()` to the route handler.

2. **Layer 2 — RBAC helper (already evaluated inside Layer 1):**
   - Same checks as above, decision module reused.

3. **Layer 3 — Route handler (W2-PR4 enforces):**
   - Resolve `requestingOrgId` from JWT (not from header).
   - Verify the requesting actor's org actually owns the invitation context.
   - For invitation creation: verify the actor's role is `admin` or `owner` (not `member`).

4. **Layer 4 — Workflow:**
   - Has this email already been invited? Reject duplicate.
   - Is the org over its team-size cap? Reject if so.
   - Is the role being granted (`readonly` / `member` / `admin`) valid for the actor's role to grant? (Owner may grant any; admin may grant up to `member`.)

5. **Layer 5 — Audit:**
   - Atomically: insert `VerifierInvitation` row + insert `AuditEvent` row.
   - `actorId` = JWT `userId`; `tenantId` = JWT `org_id`; `action` = `'invitation.created'`.

Any layer's failure ends the request. Every layer must be enforced; no layer is sufficient alone.

---

## No single authorization layer is sufficient alone.
