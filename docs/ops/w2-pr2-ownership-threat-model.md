# W2-PR2 — Ownership Threat Model

**Wave:** Wave 2, PR 2 — planning only · **Date:** 2026-05-07 · **Status:** architecture; **NO product code in this artifact**

This doc enumerates threats specifically against the **ownership-authorization** layer (Layer 3). It is distinct from the RBAC threats covered in W2-PR1A's risk review, and distinct from the audit / replay / freshness threats covered in `SECURITY_INVARIANTS.md` §4.

Threats are ranked by exploitation potential. Each row carries: scenario, exploit path, severity, current defense (or absence), required mitigation, mitigation owner.

---

## Threat ranking

### T-1 — Forged tenantId in request body / query / URL

**Scenario:** An authenticated attacker (Org A verifier) sends `POST /api/employer-review/entity-belonging-to-org-B/accept` with a request body that includes `tenantId: 'org_a'`. The handler reads `body.tenantId` and proceeds without comparing to the persisted `EmployerReview.tenantId`.

**Exploit path:** Org A accepts a clinician on behalf of Org B (or accepts an entity that is not theirs at all). The resulting `EmployerAcceptance` row carries the wrong tenantId (Org A's), but the underlying clinician was never recognized by Org A. Downstream the canonical-path `Start` step references this acceptance.

**Severity:** **P0** (privilege escalation across tenant boundary; business-impact: a hire decision is made on someone else's pipeline).

**Current defense:** none today. The existing `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` does not check ownership.

**Required mitigation:** the route handler MUST:
1. Discard any `tenantId` in the request body / query (use `JWT.org_id` only).
2. Load `EmployerReview` by `entityId` from the URL.
3. Compare loaded row's `tenantId` to the JWT-derived `requestingTenantId`.
4. On mismatch → 404 (cross-tenant, per `OWNERSHIP_INVARIANTS.md` §6.2).

**Mitigation owner:** W2-PR2 implementation PR.

### T-2 — `[entityId]` URL-parameter probing for cross-tenant existence

**Scenario:** Authenticated Org A verifier iterates `GET /api/employer-review/<probed-id>/view` for sequential or guessable entity IDs, hoping for a 200 response that returns Org B's data.

**Exploit path:** Today, `view` is in `PUBLIC_MUTATION_ACTIONS` — anonymous callers can hit it. Any caller (auth or anonymous) can probe entity-id space.

**Severity:** **P1** (info-leak across tenant; no mutation but data is exposed).

**Current defense:** the `view` action is "public" in name; the actual handler enforcement is unknown without reading the rest of the file (deferred to implementation PR scope). Backend-side ACL may or may not exist.

**Required mitigation:**
- Reclassify `view` from `PUBLIC_MUTATION_ACTIONS` to `AUTHENTICATED_READ_ACTIONS` — or document why it remains public.
- If `view` MUST remain public (e.g., share-token-based public review), the public path must enforce a `shareToken` parameter that proves the caller has the out-of-band share artifact. The token is single-resource-scoped; it does not grant cross-resource access.
- Either way, return **404** for cross-tenant or invalid-token, never 403.

**Mitigation owner:** W2-PR2 implementation PR (re-classify) + a follow-up PR if share-token enforcement is missing.

### T-3 — Header-based tenantId injection (`x-verifier-org` consumed by handler)

**Scenario:** Authenticated Org A verifier sends `POST /api/employer-review/[entityId]/accept` with `x-verifier-org: org_b`. Middleware validates `x-verifier-org` against `JWT.org_id` for `/api/verifier/*` paths (per W2-PR1) — but **not** for `/api/employer-review/*`. If the handler reads `x-verifier-org` and trusts it as the tenantId, the attacker bypasses ownership.

**Exploit path:** Same outcome as T-1 — wrong tenantId persisted on the resulting acceptance.

**Severity:** **P0** if the handler reads the header; otherwise **P1** (defensive belt-and-suspenders).

**Current defense:** unknown without code inspection. The middleware's `x-verifier-org` validation is scoped to `/api/verifier/*` only.

**Required mitigation:** the route handler MUST NOT read `x-verifier-org` for ownership purposes. Use `JWT.sessionClaims.vitalcv.org_id` only.

**Mitigation owner:** W2-PR2 implementation PR.

### T-4 — Stale JWT after org-membership revocation

**Scenario:** A user is removed from Org A but retains a valid JWT (within Clerk session-token TTL — typically 60s with refresh). They mutate Org A's resources during the TTL window.

**Exploit path:** Bounded by TTL — typically minutes. Attacker must act fast.

**Severity:** **P2** (bounded by Clerk session policy; not specific to ownership layer).

**Current defense:** Clerk session expiry handles this on the time horizon of TTL. We do not invalidate JWTs on org-membership change; the JWT remains "valid per signature" until expiry.

**Required mitigation:** out of W2-PR2 scope. Tracked as follow-up: "force JWT refresh on org-membership change" — requires Clerk admin API integration. Documented in `OWNERSHIP_INVARIANTS.md` §3.4 (mutation attribution) and `w2-pr1a-final-risk-review.md` R-1.

**Mitigation owner:** future Clerk-integration wave.

### T-5 — Replay of a mutation request after the user is removed from Org A

**Scenario:** Attacker captures a valid `POST /api/employer-review/[entityId]/accept` request with a valid JWT signed for Org A. The user is later removed from Org A. The captured request is replayed before the JWT expires.

**Exploit path:** The mutation is honored — the replay is indistinguishable from a fresh request to the handler. Acceptance is recorded.

**Severity:** **P2** (bounded by JWT TTL; requires capture; idempotent if `correlationId` collisions are rejected).

**Current defense:** JWT TTL bound; idempotency at the application layer via `correlationId` (if implemented — verify in W2-PR2 implementation).

**Required mitigation:**
- Add `correlationId` uniqueness constraint on the mutation table OR a request-deduplication helper that uses `(actorId + correlationId + 24h window)` as the dedup key.
- Reject duplicate `correlationId` with 409 `duplicate_request`.
- This is defense-in-depth for replay attacks; out of W2-PR2 scope unless trivially additive.

**Mitigation owner:** W2-PR2 if trivial; otherwise follow-up.

### T-6 — Simultaneous-mutation race: two verifiers in the same org accept the same entity

**Scenario:** Two `admin` users in Org A both call `POST /api/employer-review/entity-1/accept` simultaneously. Both pass auth, both pass ownership (same tenantId). Both attempt to write `EmployerAcceptance` rows.

**Exploit path:** The DB constraint (unique on `(entityId, action)` or equivalent) should prevent dual writes. Without the constraint, two acceptance rows exist; downstream canonical-path logic must pick one.

**Severity:** **P2** (data-integrity; not a security boundary breach).

**Current defense:** DB-level unique constraints (per `apps/api/backend/prisma/schema.prisma`) — verify presence on `EmployerAcceptance`. The constraint, if present, makes the second write fail with a foreign-key violation; the route handler returns 409.

**Required mitigation:** verify the schema has `@@unique([entityId])` or equivalent on `EmployerAcceptance`. If absent, this is a separate FOUNDER_REQUIRED schema PR. W2-PR2 documents the dependency but does not add the constraint.

**Mitigation owner:** schema audit (separate PR); W2-PR2 documents the requirement.

### T-7 — Service-to-service call bypassing the handler

**Scenario:** A backend service or worker (e.g., a cron job) writes to `EmployerAcceptance` directly via Prisma, bypassing the route handler's ownership check. The service uses a hard-coded `tenantId` or an inferred one.

**Exploit path:** No external attacker; this is a self-inflicted vulnerability if a code path circumvents the handler.

**Severity:** **P1** if such a code path exists; **P2** as a hypothetical.

**Current defense:** code review; no architectural enforcement that says "only the route handler may write `EmployerAcceptance`."

**Required mitigation:**
- Document that the only writer is the route handler.
- Add a runtime check in the route handler that the actor is human (via `actorId !== '<worker>'`).
- For workers / batch jobs that legitimately write, route them through the same shared helper (`requireOwnedEmployerReview` accepts a `serviceContext` overload that requires explicit tenantId argument).

**Mitigation owner:** W2-PR2 implementation PR (handler-side guards); architectural enforcement is a separate hardening wave.

### T-8 — DB column drift: `tenantId` becomes nullable

**Scenario:** A future migration relaxes `tenantId NOT NULL` on a tenant-scoped table. Future writes can insert null. The ownership compare (`row.tenantId === requestingTenantId`) becomes ambiguous when the row is null.

**Exploit path:** A row with `tenantId: null` is treated by a buggy handler as "no owner" and accessible to any caller.

**Severity:** **P0** if it ever happens.

**Current defense:** schema migration discipline (`docs/ops/db-migrate-cutover-runbook.md`, the `migration-shape` test in PR #251). Per `openclaw-risk-classification.md`, schema changes are FOUNDER_REQUIRED.

**Required mitigation:** the migration-shape test (PR #251) blocks DROP / ALTER patterns that relax constraints. Verify it covers `NOT NULL → NULL` transitions on `tenantId` columns specifically.

**Mitigation owner:** schema audit + extension to migration-shape test. W2-PR2 documents the dependency.

### T-9 — Non-string tenantId in the row (data corruption)

**Scenario:** A buggy migration or upstream system injects a non-string value into `tenantId` (e.g., empty string, whitespace-only string, or string with control characters).

**Exploit path:** The compare `row.tenantId === requestingTenantId` may unexpectedly match (e.g., if both are empty strings — though §3.3 below blocks this).

**Severity:** **P1** (data-integrity defect; potential for ambiguity in compares).

**Current defense:** application-side discipline — ownership helpers should reject empty/whitespace tenantId values.

**Required mitigation:** the shared ownership helper (`requireOwnedEmployerReview` or equivalent) MUST validate:
- `requestingTenantId` is a non-empty string (already done in `extractVerifierClaims` per W2-PR1A).
- `row.tenantId` is a non-empty string. If not → 500 with internal alert.

Both validation sites must be unit-tested.

**Mitigation owner:** W2-PR2 implementation PR.

### T-10 — Audit-event write disjoint from mutation (transaction not wrapping both)

**Scenario:** The route handler writes the resource row, then writes the audit row in a separate `await`. A failure between them leaves a mutation without an audit record.

**Exploit path:** Auditability defect; not a permissions breach. But a future operator querying the audit log will not see the mutation.

**Severity:** **P0** for compliance; **P1** for security.

**Current defense:** none today; existing route handlers may or may not use `db.$transaction`.

**Required mitigation:** every mutation in the W2-PR2 scope MUST use `prisma.$transaction((tx) => ...)` and write both rows inside the transaction. Tests assert the transactional shape (mock the Prisma client's `$transaction` and verify both writes occur within it).

**Mitigation owner:** W2-PR2 implementation PR.

### T-11 — `subjectId`-scoped resources accessed via tenant-scoped route

**Scenario:** A tenant-scoped route (e.g., `/api/employer-review/[entityId]`) attempts to read a clinician-scoped resource (e.g., `KnowledgeInboxItem`) where the subject is the clinician, not the verifier org.

**Exploit path:** Cross-scope read. The verifier sees clinician-scoped data they shouldn't.

**Severity:** **P1**.

**Current defense:** none architecturally; depends on which subject-scoped reads the handler chooses.

**Required mitigation:** the handler must NOT read clinician-scoped resources unless the clinician's consent artifact (`ConsentArtifact` per `apps/web/lib/issuer-verification/types.ts`) is present and references the requesting verifier-org. If absent → 404. The handler is forbidden from emitting clinician-scoped data without a consent artifact in the response trace.

**Mitigation owner:** W2-PR2 implementation PR + follow-up where consent artifacts must be added.

### T-12 — Cross-tenant audit-log read

**Scenario:** A non-`ADMIN` actor in Org A queries `/api/audit/events?tenantId=org_b` and the handler honors the body's tenantId without checking the actor's `UserRoleType`.

**Exploit path:** Org A reads Org B's audit log.

**Severity:** **P0** if this surface ever ships without `ADMIN` gating.

**Current defense:** the audit endpoint is currently public (per `current-state-map-2026-05-07.md`). W2-PR3 is the wave that gates it.

**Required mitigation:** out of W2-PR2 scope. Tracked as `SECURITY_INVARIANTS.md` §4.4 + W2-PR3 dependency.

**Mitigation owner:** W2-PR3.

---

## Threat coverage matrix

| Threat | W2-PR2 closes? | Notes |
|---|---|---|
| T-1 — forged body tenantId | ✅ yes — handler discards body tenantId, uses JWT only |
| T-2 — `view` action probing | ✅ partial — `view` reclassification; full close depends on share-token enforcement (follow-up) |
| T-3 — header-based tenantId injection | ✅ yes — handler must not read `x-verifier-org` |
| T-4 — stale JWT post-revocation | ❌ deferred — Clerk session policy; documented |
| T-5 — replay attack | ✅ partial — `correlationId` dedup if trivial |
| T-6 — simultaneous-mutation race | ❌ deferred — schema constraint required |
| T-7 — service-to-service bypass | ✅ partial — handler-side guards; architectural enforcement separate |
| T-8 — schema NOT-NULL drift | ❌ deferred — migration-shape test extension |
| T-9 — non-string tenantId in row | ✅ yes — helper validates both sides |
| T-10 — audit-write disjoint | ✅ yes — atomic transaction in handler + test |
| T-11 — subject-scoped data leak via tenant-scoped route | ✅ partial — handler discipline; consent artifacts where needed |
| T-12 — cross-tenant audit log read | ❌ deferred to W2-PR3 |

W2-PR2 fully closes 5 threats, partially closes 4, defers 3 to other waves. The deferred items are tracked in the wave's deferred section.

---

## Adversary capabilities W2-PR2 assumes

The threat model assumes adversaries have:

- ✅ Valid Clerk JWTs for some org (insider attacker).
- ✅ Ability to forge HTTP headers and request bodies.
- ✅ Ability to probe URL parameter space (sequential/guessable IDs).
- ✅ Ability to capture and replay TLS-protected requests (with TLS keys, e.g., compromised proxy).

It does NOT assume:

- ❌ Ability to forge JWT signatures (Clerk's responsibility — out of scope).
- ❌ DB-level direct access (separate trust boundary).
- ❌ Compromised internal services with elevated DB privileges (out of scope; covered by infrastructure security review).

The W2-PR2 layer protects against insider attackers within the application's intended attack surface. Defense beyond that boundary is a separate concern.
