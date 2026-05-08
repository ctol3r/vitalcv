# W2-PR2B — Runtime Topology Reconciliation

**Wave:** Wave 2, PR 2B — runtime topology reconciliation · **Date:** 2026-05-08 · **Status:** reconciliation map only; **NO product code, NO runtime modification, NO merge** · **Authority:** companion to `w2-pr2b-implementation-lock-v2.md`, `w2-pr2b-runtime-mutation-audit.md`, `AUTHORIZATION_BASELINE_V1.md`

This doc reconciles each runtime audit finding with a corresponding Lock v2 commitment. It is the bridge: it shows, finding by finding, what reality forces the wave to do (or not do), and where the non-trivial deferrals land.

The doc is structured in 6 sections: each of the 6 critical runtime findings, then a closing accounting of what the wave does keep, what it explicitly defers, and the operational invariants the wave depends on.

---

## 1. Finding F1 — No `EmployerReview` Prisma model exists

### 1.1 Observed reality

Per `w2-pr2b-runtime-mutation-audit.md` §2.1: searches across both `apps/web/prisma/schema.prisma` and `apps/api/backend/prisma/schema.prisma` return **zero** matches for `EmployerReview` / `employer_review` / `employerReview`. The closest analog is `EmployerAcceptance` (lines 1621–1637 of the backend schema), which has:

- `employerId String?` — Clerk user ID of the actor.
- `organization String` — descriptive text, untyped, no UNIQUE / FK enforcement.
- `clinicianNpi String?` — NPI of the subject.
- `status String? @default("ACCEPTED")` — single-state field with no transitions today.
- NO `tenantId` / `orgId` UUID column.
- NO foreign key to any organization model.

### 1.2 Lock v1's premise

Lock v1 referenced `EmployerReview.tenantId` ~30 times across §1, §3, §4, §5. The helper signature `requireOwnedEmployerReview(req, entityId)` in `w2-pr2-mutation-semantics.md` §5 loads `EmployerReview` by `entityId` and compares its `tenantId` to `JWT.org_id`.

**This premise is incompatible with the runtime.** No such model exists; no such column exists; no such comparison can be performed.

### 1.3 Lock v2 reconciliation

| What v1 wanted | What v2 commits to |
|---|---|
| Compare `EmployerReview.tenantId` to JWT `org_id` | **Removed.** No model to query. The reconciled gate compares `requireClerkUserId(req)` (= actor `userId`) to `EmployerAcceptance.employerId` for the actor-scoped lookups (`confirm-start`'s acceptance lookup; `loadEmployerReviewStatus`'s history scope). |
| Cross-tenant returns 404 | **Deferred.** The runtime does not have a tenant column to compare. v2 does not add one (forbidden in §4 of lock v2). The future-migration wave introduces this. |
| `requireOwnedEmployerReview` helper | **Renamed to `employerReviewLegitimacyGate`.** Different responsibilities: validates session + role + body, rejects readonly POST, computes `correlationId`, stamps trusted headers — does NOT load any DB row, does NOT perform tenant comparison. |

### 1.4 Forbidden derivations (per Lock v2 §5.1)

- Reading `req.body.tenantId` / `organizationContextId` / `organization` and using as authorization key.
- Joining `EmployerAcceptance.organization` against any actor claim.
- "Default org if unspecified" fallback.

These are explicitly forbidden because they would simulate org ownership without runtime support — the worst kind of regression because it would *appear* enforced while being trivially forgeable.

---

## 2. Finding F2 — Persistence is actor-scoped, not org-scoped

### 2.1 Observed reality

Per `w2-pr2b-runtime-mutation-audit.md` §3 (assumption O1, O2) and `w2-pr2b-mutation-branch-map.md` cross-branch matrix: the canonical path (Recognition → Acceptance → Start) is enforced PER `(employerId, clinicianNpi)` pair. Two users in the same org each independently accept and confirm-start. A user in Org A and a user in Org B can both accept the same clinician — separate Acceptance + StartAttestation chains.

The "employer" is the Clerk userId, not an organization. There is no per-org aggregate.

### 2.2 Implications

- "Cross-tenant" has no operational meaning today. Cross-actor (A and B) is the relevant axis.
- A user removed from an org loses access to their *own* acceptances (because acceptances are keyed to their userId, not the org). Re-joining or rotation breaks attribution.
- Two actors in the same org cannot share work — each must independently accept and confirm-start.

These are real product limitations of the actor-scoped model; the wave does NOT introduce them. They will be addressed by the future org-ownership migration.

### 2.3 Lock v2 reconciliation

| Lock v2 commitment | Why |
|---|---|
| Wave is classified as "**Mutation Legitimacy Hardening**", NOT "Ownership Authorization" | Honesty: per-actor mutation hygiene is the achievable hardening; per-org tenant ownership is deferred |
| The 28-case regression suite (§7) tests **per-action readonly-denial, replay resistance, audit-atomicity, header-injection defense, forbidden-input discard** | These properties are achievable in actor-scoped runtime |
| The 28-case regression suite does NOT test **cross-tenant 404** | Property cannot exist in actor-scoped runtime; testing a forged tenant claim against an actor-scoped row would be testing a no-op |
| The audit-row `tenantId` and `organizationId` columns remain NULL in v1 | Per-actor scope means no trusted org to record |

---

## 3. Finding F3 — Web layer is an auth-checking proxy, not a DB writer

### 3.1 Observed reality

Per `w2-pr2b-runtime-mutation-audit.md` §2.4: the web `[action]/route.ts` POST handler:

1. Checks Clerk session.
2. Validates the action allowlist + body shape.
3. Forwards to `BACKEND_URL/api/employer-review/<entityId>/<action>` with the body and `x-clerk-user-id`.
4. Normalizes the upstream response.

It does NOT read or write Prisma. There is no DB at the web layer for the helper to consult.

### 3.2 Lock v1's premise

Lock v1 §1 specified `apps/web/lib/auth/employerReviewOwnership.ts` (new helper) consumed by exactly two callers in the web layer, doing DB lookups (`prisma.employerReview.findUnique`).

**This premise is incompatible with the runtime.** The web layer has no such Prisma access, and even if it did, the model doesn't exist.

### 3.3 Lock v2 reconciliation

| What v1 wanted | What v2 commits to |
|---|---|
| Web-layer helper performs DB lookup for ownership | **Removed.** Web-layer helper does role gate + readonly denial + correlation ID stamping ONLY |
| Web-layer helper consumed by 2 web routes | **Preserved structurally**, but with different responsibilities |
| Backend handlers continue unchanged | **Replaced.** Backend handlers are the persistence + audit layer; v2's allowed-files list (§3 of v2) explicitly includes `apps/api/backend/src/routes/employerActions.ts` and `apps/api/backend/src/services/entity/employerReviewActions.ts` because those are where the mutations actually live |
| Single shared helper | **Two-layer split**: web-layer `employerReviewLegitimacyGate.ts` (signal proxy + role gate); backend continues to use `requireClerkUserId` (no new helper there — the wave adds correlation-key idempotency to existing service functions) |

### 3.4 The header-stamping protocol

The web-layer helper, after validation, stamps three trusted headers for backend forwarding:

| Header | Source | Used by backend for |
|---|---|---|
| `x-clerk-user-id` | `auth().userId` (already present in v1; preserved) | `requireClerkUserId(req)` — the actor identity |
| `x-vitalcv-team-role` | `extractVerifierClaims(session.sessionClaims).teamRole` (NEW) | Role gate at the backend (defense in depth — v2 enforces at both layers) |
| `x-correlation-id` | request header `x-correlation-id` if valid UUID, else proxy-generated UUID (NEW) | Idempotency anchor for replay resistance |

The headers are set by the proxy from JWT-validated values. They are **never echoed from request headers** (a forged `x-vitalcv-team-role` from the client is dropped by the helper).

This is the only new propagation pattern the wave introduces. Org-id propagation is **not** part of it (deferred).

---

## 4. Finding F4 — Backend trust boundary uses `x-clerk-user-id`

### 4.1 Observed reality

Per `w2-pr2b-runtime-mutation-audit.md` §2.2: the backend's `requireClerkUserId(req)` at `apps/api/backend/src/routes/employerActions.ts:55` reads `req.headers['x-clerk-user-id']` and trusts it unconditionally. There is no JWT verification on the backend.

### 4.2 Implications

- The backend's authorization is "whoever the proxy says you are."
- Network topology must enforce that only the proxy can reach the backend.
- A direct backend caller can forge any actor identity.

This is fine for the deployment topology where the backend is VPC-locked behind the web proxy. It is NOT fine if the backend is reachable from any other origin.

### 4.3 Lock v2 reconciliation

| What v1 wanted | What v2 commits to |
|---|---|
| Backend independently verifies tenant ownership against `EmployerReview.tenantId` | **Removed.** No model, no ownership comparison |
| Backend trusts `x-clerk-user-id` | **Preserved.** The pattern is sound *given the deployment topology assumption*. v2 codifies the assumption in §10 of lock v2 ("Operational invariants the wave depends on") |
| Backend independently validates JWT | **Deferred.** Adding JWT verification to the backend is correct architecture but a separate wave (Clerk SDK at the backend, JWKS caching, latency budget, error-mode shape) — see `w2-pr2b-future-org-ownership-migration.md` §3 |

### 4.4 Defense-in-depth role-gate added at the backend

v2 adds a backend role gate by reading the new `x-vitalcv-team-role` header (set by the proxy from JWT-validated `team_role`). The backend rejects readonly POST early with 403 + denied audit row. The web layer also rejects readonly POST.

Both layers enforce the same rule. Defense in depth means: a misconfigured proxy that fails to deny readonly does not produce a successful mutation; the backend would still deny.

---

## 5. Finding F5 — Backend currently lacks JWT/org verification

### 5.1 Observed reality

The backend's `requireClerkUserId` reads a header. It does not call `clerkClient`; it does not verify a JWT signature; it does not consult JWKS.

### 5.2 Lock v2 reconciliation

| What v1 wanted | What v2 commits to |
|---|---|
| Backend extracts `org_id` from JWT and compares to resource | **Removed.** Backend has no JWT to extract from |
| Backend validates `team_role` claim | **Added** via the new `x-vitalcv-team-role` header. NOT via JWT verification on the backend; via header forwarding from a trusted proxy that DID verify the JWT |
| Backend treats request body fields `tenantId` / `organizationContextId` as ownership input | **Forbidden** per §5.1 of lock v2 |

The honest tradeoff: v2 *expands* the backend's authorization signal (now: `userId` + `team_role` + `correlationId`) but does NOT make the backend a JWT-aware authorization frontier. The web proxy remains the JWT-aware frontier.

### 5.3 Why backend JWT verification is deferred

Adding JWT verification to the backend is the correct long-term architecture, but it carries non-trivial complexity:

| Concern | Why it's a separate wave |
|---|---|
| Latency | JWKS fetch + signature verify per request adds 1–10ms; needs JWKS caching design |
| Error mode | What happens when Clerk is unreachable? Same fail-closed pattern as web middleware (W2-PR1A) but at a different layer |
| Library footprint | Clerk SDK on the backend; backend currently has no Clerk dep |
| Rotation handling | Key rotation must propagate; cache invalidation strategy |
| Test surface | Mocking JWKS in tests, fake JWTs, etc. |

These are real, but they do not block legitimacy hardening today. v2 ships without backend JWT verification; the future-migration wave adds it as a precursor to org-ownership enforcement.

---

## 6. Finding F6 — Lock v1's ownership assumptions are incompatible with runtime reality

### 6.1 Summary

This finding is the synthesis of F1–F5. Lock v1's ownership model assumed:

- An `EmployerReview.tenantId` column (F1: doesn't exist).
- Per-org persistence scope (F2: actor-scoped reality).
- Direct DB writes from the web layer (F3: web is a proxy).
- Implicit JWT-aware backend (F5: header-trust backend).
- A single helper consumed by 2 web routes (F3: helper would have nothing to do at web layer).

### 6.2 Lock v2 reconciliation

The wave is reframed:

| Aspect | Lock v1 | Lock v2 |
|---|---|---|
| Wave name | Ownership Authorization (employer-review) | **Mutation Legitimacy Hardening (employer-review)** |
| Layer addressed | Layer 3 (Ownership) | **Layer 2 + 5 hardening** (RBAC differentiation + atomic-with-audit) |
| Primary invariant | Cross-tenant returns 404 | **Replays produce no duplicate state; readonly cannot mutate; mutation+audit atomic; no implicit grant** |
| Helper at web layer | `requireOwnedEmployerReview` doing DB lookups | **`employerReviewLegitimacyGate`** doing role gate + correlation-key + header stamping |
| New backend changes | "minimal, optional" | **Required** — readonly denial; correlation-key idempotency; transactional audit for share-packet & packet |
| Schema changes | "forbidden" | **Forbidden** (preserved) |
| Backend JWT verification | "implicit" | **Deferred** explicitly |

---

## 7. Accounting: what the wave keeps, defers, and depends on

### 7.1 Kept (v2 enforces these)

- **Atomic mutation+audit** in `prisma.$transaction` for all mutations — including `share-packet` and `packet` (which previously wrote audit standalone; v2 wraps them in single-row tx for rollback consistency).
- **Mandatory audit row on success** AND on denial-after-auth.
- **Readonly cannot mutate** — denied at proxy AND backend (defense in depth).
- **Replay resistance** via `correlationId` UNIQUE per `(actorId, 24h)`.
- **Deterministic actor attribution** — `requireClerkUserId` reads `x-clerk-user-id`; never falls back, never widens.
- **Forbidden-input discard** — body fields `tenantId` / `organizationContextId` / `organization` are NOT used for authorization decisions; they may appear in audit metadata as descriptive attribution only.
- **Fail-closed mutation semantics** — all denial paths from `MUTATION_GATE_SEQUENCE.md` §3 hold; the matrix is reduced (no cross-tenant cell) but every remaining cell remains fail-closed.
- **Frozen blast radius** — only the employer-review domain on the backend + the employer-review proxy on the web.

### 7.2 Deferred (separately scoped — see `w2-pr2b-future-org-ownership-migration.md`)

- Per-org tenant ownership (Layer 3 enforcement).
- `tenantId UUID` column on `EmployerAcceptance`, `StartAttestation`, `HITLReviewItem`.
- Backend JWT verification.
- `org_id` propagation from web to backend.
- Cross-tenant 404 wire on resource-row lookups.
- An aggregate `EmployerReview` model (if one is introduced at all — could be replaced by a denormalized view).
- Canonical tenant graph (the durable map of "which actor belongs to which org at which time").

### 7.3 Operational invariants the wave depends on (not enforced by code)

- The backend is reachable ONLY by the web proxy.
- Clerk JWT validation continues to happen at the web layer.
- `x-clerk-user-id` is set ONLY by the proxy from validated JWT.
- `x-vitalcv-team-role` (NEW) is set ONLY by the proxy.
- `x-correlation-id` (NEW) is validated as UUID format by the proxy before forwarding.

These invariants are operational because the wave does not introduce code to enforce them at the backend (that would be the future-migration's JWT verification work). The wave's correctness is bounded by these invariants holding in production.

---

## 8. Reconciliation summary table

| Finding | Lock v1 stance | Lock v2 stance | Where in v2 |
|---|---|---|---|
| F1 — No EmployerReview model | "Use EmployerReview.tenantId for ownership" | **Forbidden;** use Clerk userId for actor scope | v2 §5.1 |
| F2 — Actor-scoped persistence | "Per-org tenant comparison" | **Per-actor mutation hygiene only;** classify wave as legitimacy hardening | v2 §1, §2 |
| F3 — Web is a proxy | "Web-layer helper does DB lookup" | **Web-layer helper does role gate + correlation; backend handlers do persistence** | v2 §3, §6 |
| F4 — Backend trusts header | "Backend independently verifies tenant" | **Backend continues to trust header; topology assumption codified in v2 §10** | v2 §10 |
| F5 — No backend JWT verification | "Implicit JWT awareness on backend" | **Deferred** explicitly; web proxy remains the JWT frontier | v2 §10; future-migration §3 |
| F6 — v1 ownership assumptions wrong | (the meta-finding) | **Wave reframed as Mutation Legitimacy Hardening** | v2 §1, throughout |

---

## 9. Closing principle

Reconciliation is the act of refusing to ship the lock that doesn't fit the runtime. The wave that ships per Lock v2 is materially smaller in promise than v1 — but every promise it makes is achievable, testable, and load-bearing.

The deferrals are real and important; they are not abandonment, they are scoping. The future-migration wave will introduce per-org tenancy, backend JWT verification, and cross-tenant 404 enforcement. Those are larger architectural commitments that deserve their own founder review, their own Codex audit, and their own rollback plan.

**Reconciliation is the act of saying: this wave does what the runtime allows, no more, no less.**
