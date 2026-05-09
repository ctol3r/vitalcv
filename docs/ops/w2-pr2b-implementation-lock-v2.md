# W2-PR2B — Implementation Lock v2

**Wave:** Wave 2, PR 2B — implementation lock, version 2 (reconciled with runtime audit) · **Date:** 2026-05-08 · **Status:** **FROZEN** scope; **NO product code in this artifact** · **Supersedes:** `w2-pr2b-implementation-lock.md` (v1) — for reasons enumerated in `w2-pr2b-v1-vs-runtime-divergence.md` · **Authority:** subordinate to `MUTATION_GATE_SEQUENCE.md`, `OWNERSHIP_INVARIANTS.md`, `AUTHORIZATION_BASELINE_V1.md`, `w2-pr2b-runtime-mutation-audit.md`; supersedes implementation-convenience appeals to "while we're here, let's also …"

This document **freezes the implementation boundary for W2-PR2B with honest scope**. Lock v1 was authored before the runtime audit, and its premises (an `EmployerReview.tenantId` column, direct DB writes from the web route, per-org ownership comparison) are incompatible with the runtime as observed on `9eb5cdee`.

Lock v2 reconciles. It **classifies the wave as mutation legitimacy hardening, NOT true tenant ownership**, and explicitly defers org ownership to a separate future migration wave.

The wave that lands per this lock:
- **Tightens** actor-scoped attribution, replay observability + best-effort idempotency check via correlationId (DB-enforced replay prevention deferred to W2-PR2B-MIG-A), audit coupling, readonly enforcement, and fail-closed mutation semantics.
- **Does NOT** introduce per-org tenant comparison.
- **Does NOT** introduce a `tenantId` column on any model.
- **Does NOT** propagate `org_id` from the web layer to the backend.
- **Does NOT** add JWT verification on the backend.

These four "does not" items are deferred — see `w2-pr2b-future-org-ownership-migration.md`.

---

## 1. Wave classification (the honest framing)

| Aspect | Lock v1 framing | Lock v2 framing |
|---|---|---|
| Wave name | "Ownership Authorization (employer-review)" | **"Mutation Legitimacy Hardening (employer-review)"** |
| Layer addressed | Layer 3 (Ownership) per `AUTHORIZATION_BASELINE_V1.md` §2 | **Layer 2 + 5 hardening** (RBAC differentiation + atomic-with-audit coupling) — Layer 3 deferred |
| Primary invariant | Cross-tenant returns 404 | **Replays produce no duplicate state; readonly cannot mutate; mutation+audit atomic in tx; no implicit org grant** |
| Risk class | HIGH (cross-tenant exposure) | **MEDIUM** (within-actor mutation hygiene) |
| Founder approval threshold | Required per `SECURITY_INVARIANTS.md` §7.1 (HIGH_RISK + cross-tenant) | **Required** per `SECURITY_INVARIANTS.md` §7.1 (HIGH_RISK middleware-adjacent + first-of-kind audit-coupling enforcement); LOWER blast radius than v1's framing |

**This wave does not introduce per-org tenant ownership.** Subsequent waves do. The wave's value is to make the existing actor-scoped persistence *legitimate, idempotent, audit-coupled, and replay-resistant* — which is a real, shippable improvement and a prerequisite for the future org-ownership migration.

---

## 2. Current Runtime Truth (the substrate this wave operates on)

Per `w2-pr2b-runtime-mutation-audit.md` and `w2-pr2b-runtime-topology-reconciliation.md`. These facts bind the wave's allowed and forbidden changes.

### 2.1 Actor-scoped persistence

`EmployerAcceptance` rows carry `employerId String?` (= Clerk userId of the actor) and `organization String` (descriptive text — NOT enforcement-grade). There is no `tenantId UUID` column. The canonical-path predicate "this actor accepted this clinician" is enforced PER (employerId, clinicianNpi), not PER (org, clinicianNpi).

### 2.2 Clerk `userId` is the authority

The backend's `requireClerkUserId(req)` reads the `x-clerk-user-id` header (set by the web proxy). It is the only actor-attribution primitive available on the backend. The wave treats `userId` as the authoritative actor identity AND the authoritative scope key.

### 2.3 Web layer is a proxy

`apps/web/app/api/employer-review/[entityId]/[action]/route.ts` and the sibling refresh-requests route do NOT read or write Prisma. They authenticate the Clerk session, validate the body, and forward to the backend with `x-clerk-user-id`. The wave's web-layer hardening is bounded to: session check, role check, body validation, and header propagation — NO ownership comparison.

### 2.4 Backend trust limitations

The backend trusts the web proxy implicitly (no JWT verification on the backend itself). The deployment topology must enforce that the only origin able to reach the backend is the web proxy. This is OUT OF SCOPE for this wave but flagged in §10 as an operational invariant the wave depends on.

### 2.5 No state-enum field

`EmployerAcceptance` has `status String?` defaulting to `'ACCEPTED'`. There is no `reviewState` enum field on any model. State derivation is a function of which rows exist (per `w2-pr2b-workflow-transition-map.md` §2). The wave does NOT introduce a state field.

---

## 3. Allowed files (exact list — nothing else may be modified)

The wave touches these files only. Five product-code files (down from v1's four — adds the backend layer because that's where persistence actually lives) plus one test file.

| File | Allowed change | Why scoped to this file |
|---|---|---|
| `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` | Add per-action role gate (admin+ for accept / confirm-start; member+ for others); add explicit `readonly`-denial wire (403); add `x-correlation-id` header forwarding | Web-layer auth + role gate is the first proxy of authorization signal to backend |
| `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts` | (No mutation; reads only.) Add Clerk auth requirement (today: anonymous); reclassify per `w2-pr2b-runtime-mutation-audit.md` §B10 — **OPTIONAL** in this wave; defer if the public-NPI semantics is still desired | Sibling read; ownership-deferred |
| `apps/api/backend/src/routes/employerActions.ts` | Add `readonly`-derivation from a new `x-vitalcv-team-role` header forwarded by the web proxy; reject `readonly` POST early; add idempotency-key check on `accept` and `confirm-start` (TOCTOU close); make `share-packet` and `packet` audit writes transactional w/ a no-op mutation row in `$transaction` for atomicity-with-audit consistency | Where mutations actually live |
| `apps/api/backend/src/services/entity/employerReviewActions.ts` | Add `correlationId` propagation to audit-row metadata; reject duplicate `(actorId, correlationId, 24h)` per `MUTATION_GATE_SEQUENCE.md` §3.7 | Where the `prisma.$transaction` blocks live |
| `apps/web/lib/auth/employerReviewLegitimacyGate.ts` (new — RENAMED from v1's `employerReviewOwnership.ts`) | Pure web-layer helper: validates session presence, extracts and validates `team_role` from JWT (via existing `extractVerifierClaims`), denies `readonly` POST, computes `correlationId`, and stamps trusted headers (`x-clerk-user-id`, `x-vitalcv-team-role`, `x-correlation-id`) for backend forwarding | Single shared gate; web-layer responsibilities only |
| `apps/web/__tests__/employer-review-legitimacy.test.ts` (new — RENAMED from v1's `employer-review-ownership.test.ts`) | Regression suite per §7 below | Locks the contract |

**No other product file may be touched.** Specifically forbidden: any change to `apps/api/backend/src/routes/pilotKpi.ts` (the `view` handler) — that branch is intentionally anonymous and is OUT OF SCOPE for this wave.

The PR may add up to **2 audit-trail docs** in `docs/ops/`: `w2-pr2b-implementation-summary.md`, `w2-pr2b-risk-review.md`. Anything else is out of scope.

---

## 4. Forbidden files (explicit)

| File / pattern | Reason for forbid |
|---|---|
| `apps/web/prisma/schema.prisma` | NO schema changes. Adding `tenantId` is a separate wave (`w2-pr2b-future-org-ownership-migration.md`) |
| `apps/api/backend/prisma/schema.prisma` | NO schema changes |
| `apps/api/backend/prisma/migrations/` | NO migrations |
| `apps/web/middleware.ts` | Already wired by W2-PR1A — frozen |
| `apps/web/lib/auth/orgInvitations.ts` | RBAC primitives — frozen |
| `apps/web/lib/auth/roles.ts` | No role definitions changed |
| `apps/web/lib/issuer-verification/` | Issuer trust chain — different domain |
| `apps/web/app/api/verifier/` | W2-PR4 scope |
| `apps/web/app/api/audit/` | W2-PR3 scope |
| `apps/web/app/api/hiring/` | W2-PR3 scope |
| `apps/web/app/api/psv/` | W2-PR3 scope |
| `apps/web/app/api/employer/applications/` | W2-PR3 scope |
| `apps/web/app/api/employer/decisions/` | W2-PR3 scope |
| `apps/api/backend/src/routes/pilotKpi.ts` | The `view` action handler — intentionally anonymous; out of scope per §B6 of the runtime audit |
| `packages/` | All packages |
| `services/` | All services |
| `.github/workflows/` | CI workflow changes are separate concern |

Adding a new directory (e.g., `apps/web/lib/policy-engine/`) is forbidden. Adding new shared abstractions, generalization helpers, or "ownership middleware" beyond the single `employerReviewLegitimacyGate.ts` helper named in §3 is forbidden.

---

## 5. Forbidden patterns (the substrate this wave protects)

These patterns must NOT appear in the diff. They are explicitly forbidden because the runtime audit identified them as risks the wave is meant to prevent — not introduce.

### 5.1 Forbid fake org ownership derivation

| Forbidden | Why |
|---|---|
| Reading `req.body.tenantId`, `req.body.orgId`, `req.body.org_id`, `req.body.organizationContextId` (already present), `req.body.organization`, `req.body.org_slug` and using ANY of them as a tenant authorization key | None of these is a trusted tenant authority in v1. `organizationContextId` is descriptive metadata only — recording it in audit metadata is fine; using it for permission decisions is forbidden |
| Reading `req.headers['x-vitalcv-org-id']` (a header the web proxy does NOT today set) and treating its absence/presence as authorization | Header-injection vector; the wave does not introduce this propagation |
| Joining `EmployerAcceptance.organization String` (descriptive text) against any actor-claim and treating equality as ownership | The column is descriptive metadata, not enforcement; equating two strings is not "tenant comparison" |
| Adding any "default org if unspecified" fallback | Would silently widen capability; violates "degraded auth never widens capability" mutation rule |
| Using Clerk SDK's `clerkClient.users.getOrganizationMembershipList(userId)` to derive an org tenant at request time | Out of scope; correct architecture, but a separate wave (latency, error-mode, and Clerk reachability shape this differently) |

### 5.2 Forbid ownership heuristics unsupported by runtime persistence

| Forbidden | Why |
|---|---|
| Filtering reads by `EmployerAcceptance.organization === actor.tenantHint` | Hint is untrusted; column is descriptive |
| Treating "first acceptance for this `(clinicianNpi)`" as the canonical one (cross-actor) | Per-actor scope is the runtime reality; cross-actor canonical assumes org membership we cannot derive |
| Inferring org from the email domain on `auth().sessionClaims` | Speculative; not enforcement-grade |
| Inferring org from `bundleId` ownership | `bundleId` is also untrusted attribution metadata |
| Any predicate of the form "if I cannot derive an org, deny" — when the only paths to derive one are forbidden by §5.1 | Would deny everything; would be a regression of currently-permissive behavior. v1 actor-scoped behavior is the floor; this wave preserves it |

### 5.3 Forbid mutation-without-audit and audit-without-tx

| Forbidden | Why |
|---|---|
| Writing a mutation row outside `prisma.$transaction` | Violates atomic-with-audit per `MUTATION_GATE_SEQUENCE.md` §4 |
| Writing an audit row asynchronously / out-of-band / via a queue dispatch | Probe visibility requires the audit row exist when the mutation commits |
| Skipping the denied-path audit row "for performance" | Probe-visibility is non-negotiable per `w2-pr2b-audit-coupling.md` §1.2 |
| Replacing `prisma.auditEvent.create` with a fire-and-forget call on the success path | Audit must be transactional with mutation |

### 5.4 Forbid implicit grants on missing inputs

| Forbidden | Why |
|---|---|
| `if (!userId) { ...permit anyway... }` | Violates Layer 1 fail-closed |
| `if (!teamRole) { teamRole = 'member' }` | Implicit grant |
| `if (!correlationId) { correlationId = randomUUID() }` AT THE BACKEND | Idempotency anchor must come from the actor / proxy; backend-generated correlation IDs defeat replay observability. (Proxy may generate one if missing; the proxy then forwards it.) |

---

## 6. Allowed mutation types (scope-frozen)

W2-PR2B-LV2 addresses these mutating actions on `apps/api/backend/src/routes/employerActions.ts`:

| Action | HTTP | Allowed change | Forbidden change |
|---|---|---|---|
| `accept` | POST | Reject readonly POST early (web + backend); add `correlationId` idempotency key (UNIQUE check inside tx); record correlationId in audit metadata | Add a `tenantId` column lookup; modify `EmployerAcceptance` schema; alter the CRS / blocked gate; modify the duplicate-check predicate beyond adding the correlation-key |
| `confirm-start` | POST | Reject readonly POST; require `acceptanceId` in body (DEPRECATE the fallback-to-most-recent path) — phased rollout: still accept omitted `acceptanceId` for 1 release with deprecation warning header; correlationId idempotency | Modify `StartAttestation` schema; alter canonical-path semantics |
| `request-refresh` | POST | Reject readonly POST; correlationId idempotency (no-duplicate within 24h is the predicate); record correlationId | Implement the underlying refresh dispatch (separate concern) |
| `route-to-review` | POST | Reject readonly POST; correlationId idempotency; **add explicit error-emission when HITL silently degrades** (record `reviewItemCreated: false` is already in audit metadata; add a logged warning + Sentry breadcrumb at degrade) | Implement the human-review queue (separate concern); add a transactional fallback to a different model |
| `share-packet` | POST | Reject readonly POST; wrap audit insert in a `prisma.$transaction((tx) => ...)` (single-write tx is acceptable — establishes the contract that share-packet's audit row is the persistent record AND is rollback-safe); correlationId | Modify the share-token cryptographic shape (separate concern; flagged as O7); change the "audit IS the persisted record" pattern |

And these read actions:

| Action | HTTP | Allowed change |
|---|---|---|
| `view` | POST (anonymous telemetry) | **NO CHANGE** — out of scope per §4 |
| `acceptance-history` | GET | **OPTIONAL** in this wave: add Clerk auth requirement, retain the cross-tenant read shape (since per-org enforcement is deferred) — defer if the cross-tenant public-read is still load-bearing for the marketing surface |
| `packet` | GET | Wrap audit insert in `prisma.$transaction((tx) => ...)` (single-write tx); add `correlationId` to audit metadata |
| `status` | GET | **OPTIONAL** in this wave: add Clerk auth requirement (already authenticated); enforce role gate (member+) |
| `refresh-requests` | GET (NPI-keyed) | **NO CHANGE** — explicitly anonymous by design |

**No other action is added by W2-PR2B-LV2.** Adding a new action under `[action]` requires a separate PR.

---

## 7. Mandatory tests (the 28-case regression — REVISED from v1's 34)

Per `w2-pr2b-mutation-semantics.md` §7, **revised** to remove the cross-tenant cases that depend on per-org ownership (deferred). The test file `apps/web/__tests__/employer-review-legitimacy.test.ts` must cover at minimum:

| Group | Cases | What it locks |
|---|---|---|
| 7.1 — Per-action readonly denial (5 actions × 1 scenario) | 5 | Each of `accept`, `request-refresh`, `route-to-review`, `share-packet`, `confirm-start` denies a `readonly` POST with 403 + denied audit row + correct `<base>.role_denied` literal |
| 7.2 — Per-action permitted-role permit (5 actions × 1 scenario) | 5 | Each action permits a permitted-role (member+ or admin+ per the table in §6) with 200/201 + paired audit row in tx |
| 7.3 — Audit atomicity (4 cases) | 4 | success writes one audit row in the transaction; resource-update failure rolls back audit; audit-write failure rolls back resource; **share-packet** is the explicit single-write tx case |
| 7.4 — Replay observability via correlationId, best-effort idempotency check (5 actions × 1 scenario) | 5 | Each action with duplicate `(actorId, correlationId, 24h)` returns 409 `duplicate_request` and writes NO new audit row. Single-threaded test scope; TOCTOU race remains until DB UNIQUE lands in W2-PR2B-MIG-A |
| 7.5 — Forbidden-input discard (4 cases) | 4 | Body fields `tenantId` / `orgId` / `org_id` / `organization` are recorded in `payloadHash` only AFTER discard from the canonical-key set; presence does not change the persisted row's actor-scoped attribution |
| 7.6 — Header-injection defense (3 cases) | 3 | A forged `x-vitalcv-team-role: admin` header (when the JWT says `readonly`) is ignored — the helper's runtime `team_role` validation derives from JWT, not header; `x-clerk-user-id` forgery is mitigated by the deployment topology (test asserts the helper does not consult an injected header without JWT validation) |
| 7.7 — Edge cases (2 cases) | 2 | Malformed `entityId` → 400 + denied audit; absent `correlationId` (auto-generated by proxy) → success with proxy-generated value forwarded |

**Total: 28 cases.** Down from v1's 34 — the 6 cross-tenant cases (per §7.1 & §7.3 of v1) are removed because cross-tenant comparison is deferred. The 28-case suite locks the legitimacy contract: readonly cannot mutate, mutations are atomic with audit **for the four C-1 transactional handlers (`accept`, `request-refresh`, `route-to-review`, `confirm-start`); cosmetic single-row tx wrap for the two C-2 audit-as-persistence handlers (`share-packet`, `packet`) — no additional rollback semantics**, replays produce best-effort idempotency-checked denials (not prevention), forbidden inputs are discarded, header injection is defeated, edge cases fail closed.

**Mocked dependencies only:** Prisma client, Clerk `auth()`. NO real DB, NO real network. Tests run in vitest's `node` environment, sub-second total runtime.

---

## 8. Mandatory audit writes (atomic with mutation for C-1 handlers; cosmetic single-row tx wrap for C-2 handlers)

Every mutating action in §6 must produce exactly one `AuditEvent` row in the **same Prisma transaction** as the mutation (or, for the audit-only branches `share-packet` + `packet`, in a single-row `$transaction`). The shape per `w2-pr2b-audit-coupling.md` §3, with two corrections for v1 reality:

| Field | Source | Validation |
|---|---|---|
| `actorId` (in metadata) | `requireClerkUserId(req)` | non-empty string; never `'system'` / `'unknown'` / `''` |
| `tenantId` field on `AuditEvent` | **NULL or omitted in v1** — populated when the future org-ownership wave lands | The schema column is nullable; v1 leaves it null. (Dev-flagged: future migration backfill.) |
| `organizationId` field on `AuditEvent` | **NULL or omitted in v1** — same as above | Per-actor scope means there's no trusted org to record yet |
| `action` (or `type`) | one of the existing literals (`EMPLOYER_REVIEW_ACCEPTED`, etc.) | matches the existing allowlist; no free-form action names |
| `referenceId` | `entityId` for accept/refresh/routing; `acceptanceId` for confirm-start; per existing pattern | non-empty |
| `clinicianId` | resolved subject NPI | non-empty |
| `metadata.correlationId` | from web proxy (or proxy-generated UUID if request lacked one) | unique per `(actorId, 24h)` |
| `metadata.payloadHash` | SHA-256 of redacted body (per `w2-pr2b-audit-coupling.md` §6) | always present |
| `metadata.outcome` | `'permitted'` for the success path; `'denied'` for the rejected path | required |
| `metadata.replaySafe` | `false` | literal |
| All existing metadata fields | preserved unchanged | the wave does NOT remove or rename any existing metadata field |

**Denied attempts also write an audit row** (per `w2-pr2b-audit-coupling.md` §1.2). The `metadata.action` reason suffix matches the v1 schema (`<base>.role_denied`, `<base>.duplicate_request`, etc.).

The atomic boundary is `prisma.$transaction((tx) => ...)`. Tests assert both writes occur within it (or, for single-row tx, the single audit row commits with rollback semantics).

---

## 9. Mandatory denial behavior (the response matrix — v2)

The matrix is reduced from v1 because cross-tenant 404 cases are deferred. The remaining matrix:

| Failure | HTTP | Response body | Header | Audit row written? |
|---|---|---|---|---|
| No Clerk session (browser) | 401 (sign-in redirect) | empty | — | NO |
| No Clerk session (API) | 403 | empty | — | NO |
| Auth present, JWT `team_role` missing | 403 | empty | `x-rbac-fail-closed: no_team_role` | YES — denied attempt |
| Auth present, role denies (e.g., readonly POST) | 403 | empty | — | YES — denied attempt |
| Auth present, role permits, **resource lookup fails (entity not found)** | 404 | empty | — | YES — denied attempt |
| Auth present, role permits, **passport BLOCKED on accept** | 422 | `{ "error": "acceptance_blocked", "blockers": [...] }` | — | YES — denied (existing behavior preserved) |
| Auth present, role permits, **already_accepted on accept** | 409 | `{ "error": "already_accepted", "acceptanceId": "..." }` | — | YES — denied |
| Auth present, role permits, **no prior acceptance on confirm-start** | 409 | `{ "error": "no_prior_acceptance" }` | — | YES — denied |
| URL parameter malformed | 400 | `{ "error": "malformed_resource_id" }` | — | YES — denied |
| Duplicate `correlationId` within 24h | 409 | `{ "error": "duplicate_request" }` | — | NO — same actorId + correlationId; prior row stands |
| Atomic transaction fails | 500 | empty | internal alert | NO — partial state must rollback |

**Lock the matrix.** Cross-tenant 404 (deferred to future-migration wave) is NOT in this matrix. Any 404 response in v2 is "entity not found" (literally — there is no per-org cross-tenant filter to return 404 for).

---

## 10. Operational invariants the wave depends on

The wave's correctness depends on these invariants being maintained by deployment / ops, NOT by code in this PR:

| Invariant | Owner | What breaks if violated |
|---|---|---|
| The backend is reachable ONLY by the web proxy (VPC-locked, IP-allowlisted, or equivalent) | Deployment topology | A direct backend caller can forge `x-clerk-user-id` and impersonate any user |
| Clerk JWT validation continues to happen at the web layer (per W2-PR1A) | Web middleware | A forged JWT would propagate forged claims to the backend |
| `x-clerk-user-id` is set ONLY by the web proxy from the validated JWT, never echoed from a request header | Web proxy code (this wave touches it; preserves the pattern) | Header injection vector |
| `x-vitalcv-team-role` (NEW header forwarded by this wave) is similarly set ONLY by the proxy from the validated JWT | Web proxy code | Header injection |
| `x-correlation-id` (NEW header forwarded by this wave) defaults to a proxy-generated UUID; if a client sends it, the proxy validates UUID format and forwards the validated value | Web proxy code | Replay-resistance bypass via duplicate-key collisions |

The PR description must explicitly state these dependencies and reference this section.

---

## 11. Founder approval matrix (for this wave)

Per `SECURITY_INVARIANTS.md` §7.1, founder approval is required because:

- This is a first-of-kind audit-coupling enforcement on a HIGH_RISK domain (employer-review).
- The wave deprecates the `confirm-start` fallback-to-most-recent path (behavior change for an existing endpoint).
- The wave introduces a NEW header (`x-vitalcv-team-role`, `x-correlation-id`) at the web→backend boundary.
- The wave reclassifies — at the OPTIONAL level — `acceptance-history` (today public read) and the sibling `refresh-requests` (today public read).

Founder approval is NOT required for the cross-tenant 404 enforcement *because that enforcement is deferred*. This is the central honest reframe.

---

## 12. Rollback triggers

The wave is rolled back (PR reverted) if any of the following are observed in production within 7 days of merge:

| Trigger | Why |
|---|---|
| Increase in 5xx rate on `/api/employer-review/**` mutating endpoints | Likely a new transaction-boundary issue |
| Increase in 409 `duplicate_request` rate above the 0.1% baseline | Idempotency-key collision; correlationId UUID format may be wrong, or proxy is sending duplicate IDs |
| Verified report of legitimate `confirm-start` calls failing because the fallback-to-most-recent was removed | The deprecation window may need to be longer than 1 release |
| Audit-row growth rate > 2× baseline | Denied-path audit-row emission may be over-emitting; consider rate-limiting at proxy |
| Verified failure of best-effort replay dedup (duplicate persisted state on retry due to TOCTOU race AND no DB-enforced anchor) | Application-layer idempotency check insufficient at observed concurrency; escalation to W2-PR2B-MIG-A required |

**This wave's mission is NOT to enforce per-org tenancy. The mission is to ensure that the existing actor-scoped persistence is legitimate, idempotent, audit-coupled, and replay-resistant.** Rollback triggers reflect that scope.

---

## 13. Blast radius (scope-frozen)

Per `OWNERSHIP_INVARIANTS.md` §7.5: the wave's blast radius is bounded to the employer-review domain on the backend + the employer-review proxy on the web.

- `/api/employer-review/[entityId]/{accept, confirm-start, request-refresh, route-to-review, share-packet}` mutating actions become legitimacy-hardened (role-gated, replay-resistant, audit-coupled).
- `/api/employer-review/[entityId]/packet` becomes audit-coupled (the audit row commits in a single-row tx).
- `/api/employer-review/[entityId]/{view, acceptance-history, status}` are NOT changed by this wave's mandatory scope (optional reclassification permitted; defer recommended).
- `/api/employer-review/npi/[npi]/refresh-requests` is NOT changed (explicitly anonymous by design).

No other route family is touched. No other domain is touched. No schema is touched. No middleware is touched.

---

## 14. Codex audit prompt (for the merge gate)

Codex SAFE audit must verify:

1. The diff touches only the files listed in §3.
2. Every `prisma.$transaction((tx) => ...)` in the touched code emits one mutation row + one audit row (or, for share-packet/packet, one audit row in a single-row tx).
3. Every denied attempt that reached at least Step 2 of the gate sequence (auth present) writes an audit row with `outcome: 'denied'`.
4. Readonly-role mutations are denied at the helper level (web layer) AND at the backend route handler (defense in depth).
5. No code path uses `req.body.tenantId` / `req.body.organization` / etc. as an authorization key. (Recording in audit metadata is fine; using as authorization is not.)
6. The 28-case regression suite passes.
7. The PR description explicitly states the deferred items (org ownership, schema migration, JWT verification on backend) and references `w2-pr2b-future-org-ownership-migration.md`.
8. The PR description names this wave as **mutation legitimacy hardening**, NOT ownership authorization.

---

## 15. Closing principle

Lock v2 is the honest scope. v1's promises were aspirational against runtime that didn't exist. The wave that ships per v2:

- Makes the existing actor-scoped persistence legitimate.
- Closes replay surfaces.
- Couples audit writes atomically.
- Refuses readonly mutations.
- Discards client-supplied org claims (without pretending they were meaningful).
- Preserves the existing canonical-path semantics.

It does NOT:

- Compare actors to org-tenant ownership.
- Enforce cross-tenant isolation at the resource-row level.
- Introduce tenant columns or tenant graphs.
- Pretend that "org" is a meaningful Layer-3 dimension in v1.

These deferred items are real and important. They land in a separate wave (`w2-pr2b-future-org-ownership-migration.md`) under separate founder approval, with its own schema migration, JWT propagation, and per-org enforcement plan.

**W2-PR2B-LV2 aligns authorization enforcement with the actual runtime topology rather than aspirational ownership architecture.**
