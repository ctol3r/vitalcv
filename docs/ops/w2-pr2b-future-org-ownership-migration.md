# W2-PR2B — Future Org-Ownership Migration

**Wave:** Wave 2, PR 2B — future-migration plan (deferred, NOT this wave) · **Date:** 2026-05-08 · **Status:** plan only; **NO product code, NO runtime modification, NO merge in this artifact** · **Authority:** companion to `w2-pr2b-implementation-lock-v2.md`, `w2-pr2b-runtime-topology-reconciliation.md`, `w2-pr2b-v1-vs-runtime-divergence.md`

This doc plans the **deferred** wave that introduces per-org tenant ownership on the employer-review surface. It is the destination for everything Lock v2 declined to do because the runtime did not yet support it.

The wave described here is **not authorized to ship today.** It carries a schema migration, a Clerk SDK addition on the backend, a new web→backend header propagation, and a behavior change (per-org scope replaces per-actor scope on `loadEmployerAcceptanceHistory`, `loadEmployerReviewStatus`, and `confirm-start`'s acceptance lookup).

It is documented now so that the deferrals from Lock v2 have a credible home and the engineering surface area is visible to founder review.

---

## 1. Wave nomenclature

This wave is provisionally named **"W2-PR2B-MIG"** (mig = migration). It runs after W2-PR2B-LV2 ships and stabilizes (≥ 7 days in production with no rollback triggers per Lock v2 §12).

It is decomposable into three sub-waves if blast radius needs to be capped:

| Sub-wave | Purpose | Land separately? |
|---|---|---|
| **W2-PR2B-MIG-A** | Schema migration: add `tenantId UUID` to `EmployerAcceptance`, `StartAttestation`, `HITLReviewItem`, `AuditEvent` (already has `organizationId String?` — backfill); add UNIQUE constraints | YES — schema-only PR |
| **W2-PR2B-MIG-B** | Backend JWT verification: Clerk SDK on backend; JWKS caching; web→backend header propagation extended with `x-vitalcv-org-id` | YES — backend trust-frontier PR |
| **W2-PR2B-MIG-C** | Per-org enforcement: route handlers and service functions consult `tenantId`; cross-tenant returns 404; backfill ownership on existing rows | YES — enforcement PR |

Each sub-wave has its own founder approval, Codex audit, and rollback plan. The decomposition exists so that the schema migration (highest infra risk) can settle before the enforcement (highest behavior-change risk).

---

## 2. Org Ownership — the missing primitive

### 2.1 What "org" means in v2 reality

Today there is no canonical "org" entity that owns resources. There are:

- **Clerk organizations** — orgs in the Clerk identity provider; each user belongs to ≥ 0 orgs; the JWT carries `vitalcv.org_id` (post-W2-PR1A).
- **`EmployerAcceptance.organization String`** — descriptive text, untyped, no FK enforcement. Could match a Clerk org name, or could be free-form.
- **`AuditEvent.organizationId String?`** — nullable column, populated inconsistently.
- **`organizationContextId`** — a request-body attribution field, untrusted.

These are **four different "org" concepts** with no canonical mapping. The migration's first task is to choose ONE authoritative org concept (recommended: Clerk `org_id`) and migrate all records to use it.

### 2.2 Authoritative org concept (recommended)

**`Clerk org_id` from JWT** is the recommended authoritative org concept because:

- It is server-signed (cannot be forged client-side).
- It is the same identifier used by W2-PR1A's middleware (Layer 1).
- It is consistent across users in the same org.
- It is rotation-aware via Clerk's session refresh.

The migration's invariant: **every authorization decision and every audit row records the actor's JWT-derived `org_id` as the canonical org.** All other "org" concepts are descriptive metadata only.

### 2.3 Tenant-graph model

Provisional shape:

```
TenantOrg (Clerk org_id-keyed)
  - id (UUID, primary key)
  - clerkOrgId (string, UNIQUE)
  - displayName
  - createdAt
  - status ('active' | 'suspended' | 'deleted')

TenantOrgMembership
  - tenantOrgId (FK)
  - clerkUserId (string)
  - role ('owner' | 'admin' | 'member' | 'readonly')
  - addedAt
  - removedAt (nullable)
```

The `TenantOrg` table is populated lazily — first time an actor with a given `org_id` performs an authenticated mutation, a row is upserted. The membership table mirrors Clerk's source of truth via webhook (read-only on the platform side).

This is the **canonical tenant graph** the future-migration wave introduces. All ownership comparisons are then against `TenantOrg.id`.

---

## 3. Backend JWT Verification

### 3.1 What needs to change

Today the backend's `requireClerkUserId(req)` reads `x-clerk-user-id` and trusts. The future-migration replaces this with:

```
function requireAuthenticatedActor(req): { actorId, tenantOrgId, teamRole, correlationId } {
  // 1. Extract Bearer JWT from Authorization header (or x-clerk-jwt header from proxy)
  // 2. Fetch JWKS (cached); verify signature
  // 3. Validate exp, iss, aud
  // 4. Extract sub (Clerk userId), org_id (Clerk org), team_role
  // 5. Look up TenantOrg by clerkOrgId (lazy upsert)
  // 6. Return { actorId, tenantOrgId, teamRole, correlationId }
  // — Throws 503 with x-rbac-fail-closed: clerk_unavailable on JWKS failure
  // — Throws 403 on missing/invalid JWT
}
```

The web proxy now forwards the JWT (validated at the web layer per W2-PR1A) to the backend. The backend re-verifies for defense in depth.

### 3.2 Latency budget

JWKS fetch + signature verify costs ~1–3ms per request after cache warm-up. Cold cache (rare): up to 50ms. The backend's existing per-request budget is ~100ms for the data-bound endpoints; an extra 3ms is acceptable.

### 3.3 Failure mode

Same fail-closed pattern as W2-PR1A's middleware:

- JWKS fetch fails → 503 with `x-rbac-fail-closed: clerk_unavailable`.
- JWT signature invalid → 403 (immediate, no retry).
- JWT expired → 403 (caller must refresh).
- Missing JWT → 403.

The web proxy + backend both fail closed; the backend never independently widens.

### 3.4 Library footprint

- `@clerk/backend` — JWT verification primitive.
- `node-jwks-rsa` (or equivalent) — JWKS caching.
- A small intra-process cache (LRU, ~1MB).

This is a non-trivial dependency addition; it must be done in a dedicated PR (sub-wave MIG-B).

---

## 4. Cross-Tenant Enforcement (the actual ownership comparison)

### 4.1 Schema (MIG-A)

```
ALTER TABLE employer_acceptances ADD COLUMN tenant_org_id UUID;
ALTER TABLE employer_acceptances ADD CONSTRAINT fk_acceptances_tenant FOREIGN KEY (tenant_org_id) REFERENCES tenant_orgs(id);
CREATE INDEX idx_acceptances_tenant ON employer_acceptances(tenant_org_id);
CREATE UNIQUE INDEX idx_acceptances_tenant_clinician_active ON employer_acceptances(tenant_org_id, clinician_npi) WHERE status = 'ACCEPTED';

ALTER TABLE start_attestations ADD COLUMN tenant_org_id UUID;
ALTER TABLE start_attestations ADD CONSTRAINT fk_attestations_tenant FOREIGN KEY (tenant_org_id) REFERENCES tenant_orgs(id);
ALTER TABLE start_attestations ADD CONSTRAINT uniq_attestation_per_acceptance UNIQUE (acceptance_id);

ALTER TABLE hitl_review_items ADD COLUMN tenant_org_id UUID;

ALTER TABLE audit_events ADD COLUMN tenant_org_id UUID;  -- (organizationId String? becomes deprecated; tenant_org_id is the new authority)
```

**Backfill plan (MIG-A migration script):**

For each existing row:
- If `employerId` has a Clerk membership with exactly one org → backfill `tenant_org_id` from that org.
- If `employerId` has multiple memberships → backfill from the most recent membership at the row's `acceptedAt` time (best-effort; flagged for manual review).
- If `employerId` has no membership → backfill NULL (legacy row; readable but non-mutable).

The backfill is the highest-risk part of the migration. It must run in a maintenance window with read-only mode on the affected tables.

### 4.2 Enforcement (MIG-C)

After MIG-A + MIG-B land:

| Action | New gate (in addition to v2 legitimacy gates) |
|---|---|
| `accept` | INSERT row with `tenant_org_id = JWT.org_id`; UNIQUE on `(tenant_org_id, clinician_npi, status='ACCEPTED')` enforces idempotency at the DB level (no more TOCTOU) |
| `confirm-start` | Acceptance lookup keyed by `(tenant_org_id, clinician_npi, status='ACCEPTED')` (per-org, NOT per-actor); UNIQUE on `start_attestations(acceptance_id)` enforces idempotency |
| `request-refresh` | INSERT outbox + audit with `tenant_org_id = JWT.org_id`; downstream consumers filter by tenant |
| `route-to-review` | INSERT HITL + outbox + audit with `tenant_org_id = JWT.org_id` |
| `share-packet` | INSERT audit with `tenant_org_id = JWT.org_id`; share-token resolution path optionally cross-tenant (for downstream public reads) |
| `packet` (GET, audit-emitting) | Read scoped to `tenant_org_id = JWT.org_id`; cross-tenant entity returns 404 |

Cross-tenant 404 is enforced for the first time in this sub-wave. The 28-case Lock v2 regression grows to ~50 cases (the 22 cross-tenant cases that v2 deferred).

### 4.3 Read-side behavior changes

`loadEmployerAcceptanceHistory` and `loadEmployerReviewStatus` are migrated to scope by `tenant_org_id` instead of `employerId`. **This is a user-visible behavior change:**

- Today: a user sees their own acceptances only.
- After MIG-C: a user sees their org's acceptances (shared with co-workers in the same org).

This is the **per-actor → per-org scope shift** flagged throughout the audit. It is a feature improvement but a behavior change. Founder approval required.

The sibling NPI-keyed `refresh-requests` GET remains anonymous + cross-tenant by design.

---

## 5. EmployerReview aggregate (optional)

Lock v1 referenced an `EmployerReview` model. The future-migration wave MAY introduce one, but it does NOT have to. Two architectures:

| Architecture | Pros | Cons |
|---|---|---|
| **A. Aggregate `EmployerReview` model** — explicit row per `(tenant_org_id, clinician_npi)` with `reviewState` enum | Single source of truth for review state; easier ownership scoping | New model + migration for a value that is currently derivable; introduces possible drift between aggregate state and source rows |
| **B. Derived view of `EmployerAcceptance` + `StartAttestation`** — keep state implicit; provide a database view for read convenience | No new model; preserves current semantics | Read queries must join; state derivation is more code |

**Recommendation:** option B. The aggregate is a planning-doc artifact; the runtime functions correctly without it. Introducing the aggregate is incidental complexity unless a real product feature demands it.

The future-migration wave defers this decision; it can be made when a feature actually needs the aggregate (e.g., a "review queue" UI that wants paginated tenant-scoped review state).

---

## 6. Idempotency Anchors (DB-enforced)

Today, idempotency on `accept` is query-then-create (TOCTOU). The future-migration adds DB-enforced anchors:

| Action | DB-enforced anchor |
|---|---|
| `accept` | `UNIQUE (tenant_org_id, clinician_npi) WHERE status = 'ACCEPTED'` (partial unique index) — concurrent inserts collapse to one row + one Postgres unique-violation that the handler turns into 409 `already_accepted` |
| `confirm-start` | `UNIQUE (acceptance_id)` on `StartAttestation` — concurrent inserts collapse to one |
| `request-refresh` | (Optional) `UNIQUE (tenant_org_id, clinician_npi, request_window_bucket)` where `request_window_bucket = floor(timestamp / 24h)` — collapses retries within 24h |
| `route-to-review` | (Optional) similar bucketing |
| `share-packet` | None at the persistence level; correlationId UNIQUE in audit metadata is the anchor |

The DB-enforced anchors complement Lock v2's correlation-key anchors. Together they provide two layers of replay defense (correlation + DB unique). This is defense in depth.

---

## 7. Canonical Tenant Graph (the durable map)

The durable map of "which actor belongs to which org at which time" — needed for:

- Auditing "who acted on this resource at the time of mutation."
- Backfilling existing rows (per §4.1).
- Detecting org-membership transitions (user joined / left / role-changed).

### 7.1 Source of truth

**Clerk** is the source of truth via webhook events:

- `organization.created` → upsert `TenantOrg`.
- `organizationMembership.created` → upsert `TenantOrgMembership`.
- `organizationMembership.updated` → update role.
- `organizationMembership.deleted` → soft-delete (`removedAt = now()`).

The platform's `TenantOrgMembership` is a **read-only mirror** of Clerk; the platform never writes membership directly.

### 7.2 Audit-row stamping

Every audit row written after the migration includes:

- `actorId` (= Clerk userId).
- `tenant_org_id` (= the active org of the actor at the time of the request, derived from JWT — NOT from a follow-up DB lookup that could race).
- `actorRoleAtDecision` (= the team_role from the JWT).

These are immutable; if the actor's role or org membership changes later, the audit row preserves the decision-time context.

### 7.3 Stale membership invariant

If a user is removed from an org but their JWT is still valid (until expiry, per `AUTHORIZATION_BASELINE_V1.md` §5.1), they CAN still perform mutations. The migration does NOT close this stale-session window; that is a separate wave (`session-revocation-wave`). See `AUTHORIZATION_BASELINE_V1.md` §5.1.

---

## 8. Migration runbook (high-level)

### 8.1 Pre-migration checklist

- [ ] Lock v2 has shipped and stabilized (≥ 7 days, no rollback triggers).
- [ ] Founder approval for MIG-A schema migration.
- [ ] Backup of `employer_acceptances`, `start_attestations`, `hitl_review_items`, `audit_events`.
- [ ] Read-only mode on the affected tables during backfill.
- [ ] Clerk webhook listener deployed (MIG-B prep).
- [ ] `@clerk/backend` dependency review.

### 8.2 MIG-A (schema)

1. Add `tenant_org_id` columns (nullable initially).
2. Run backfill script (per §4.1).
3. After backfill verification, mark `tenant_org_id` NOT NULL on the affected tables (separate migration).
4. Add UNIQUE indices for idempotency anchors.

### 8.3 MIG-B (backend trust frontier)

1. Add `@clerk/backend` to backend dependencies.
2. Implement `requireAuthenticatedActor` with JWKS caching.
3. Web proxy forwards JWT to backend (Authorization header).
4. Update existing handlers to call new helper alongside `requireClerkUserId` (during transition).
5. Verify dual-path produces identical results in observability dashboards.

### 8.4 MIG-C (enforcement)

1. Update `recordEmployerReviewAcceptance` to scope by `tenant_org_id`.
2. Update `recordEmployerReviewRefreshRequest` similarly.
3. Update `recordEmployerReviewRouting` similarly.
4. Update `confirm-start` acceptance lookup to use `tenant_org_id`.
5. Update read functions (`loadEmployerReviewStatus`, `loadEmployerAcceptanceHistory`) — **behavior change announcement to users**.
6. Add cross-tenant 404 wire on resource lookup.
7. Add the 22 cross-tenant test cases (the ones Lock v2 deferred).

### 8.5 Rollback plan

- MIG-A: drop the new columns + indices; downstream code in MIG-B + MIG-C must not have shipped yet.
- MIG-B: revert backend Clerk SDK addition; keep web proxy unchanged.
- MIG-C: revert per-tenant scope changes; revert to per-actor scope; user-visible behavior reverts.

---

## 9. Engineering footprint estimate

| Sub-wave | Files touched | Lines (rough) | Engineering days | Risk |
|---|---|---|---|---|
| MIG-A (schema) | 1 schema + 1 migration script | ~100 | 2–3 | MEDIUM (backfill) |
| MIG-B (backend trust frontier) | ~5 backend files + 1 web file | ~200 | 3–5 | MEDIUM (new dep, latency) |
| MIG-C (enforcement) | ~6 backend files + ~2 test files | ~400 | 5–7 | HIGH (behavior change) |
| **TOTAL** | ~14 files | ~700 | **10–15** | HIGH cumulative |

This is not a single-wave PR. It is a multi-wave migration that must be sequenced and validated.

---

## 10. Explicitly Deferred to this Migration

For traceability, the deferred items from Lock v2:

- **Org ownership** — Layer 3 enforcement on the employer-review surface.
- **Multi-tenant verifier ownership** — same pattern extended to `/api/verifier/**` (a separate wave: W2-PR4-MIG, after this).
- **Backend JWT verification** — the Clerk SDK on the backend with JWKS caching.
- **EmployerReview aggregate model** — optional; recommended NOT to introduce unless a feature requires it.
- **Canonical tenant graph** — `TenantOrg` + `TenantOrgMembership` tables synced from Clerk webhooks.
- **Cross-tenant 404 wire on resource lookups** — the actual ownership comparison.
- **Per-action `tenantId` in mutation rows + audit rows** — DB-stamped tenant identity.
- **DB-enforced idempotency anchors** — partial UNIQUE indices replacing TOCTOU duplicate checks.
- **`x-vitalcv-org-id` header propagation** from web to backend (Lock v2 added `x-vitalcv-team-role` and `x-correlation-id`; org_id stays deferred).

Each of the above lands in MIG-A, MIG-B, or MIG-C per §1.

---

## 11. What this migration does NOT address

Even after MIG-A + MIG-B + MIG-C ship, the following are STILL deferred:

- **Stale role/session invalidation** (per `AUTHORIZATION_BASELINE_V1.md` §5.1) — needs session-revocation wave.
- **Ownership/workflow desynchronization** at recognition time (per §5.2 of baseline) — needs recognition-audit-coupling wave.
- **Audit retention / archival** — separate wave.
- **Rate-limiting** on denied-attempt audit emissions — separate wave.
- **Rate-limiting** on mutation throughput per tenant — separate wave.
- **Public share-token enforcement** at the downstream public-read flow — separate wave.

These are noted to keep expectations honest. The migration brings the platform to "per-org tenancy is enforced on employer-review mutations." It does not bring it to "all multi-tenant authorization concerns are resolved."

---

## 12. Closing principle

The future-migration wave is the destination for everything Lock v2 declined. It is documented in advance because:

1. The deferrals from Lock v2 are real and non-trivial; founder + reviewer must see they have a credible home.
2. The migration is large enough (10–15 engineering days, 3 sub-waves, schema + backend + behavior changes) that it deserves its own planning surface, not just a footnote.
3. Some of the migration's architectural choices (Clerk org_id as the canonical org concept; lazy `TenantOrg` upsert; webhook-mirrored membership; aggregate model deferred) deserve explicit review now, not deferred to wave-time.

When this doc is approved, the implementation PR for Lock v2 can open with confidence that the deferred items are not lost — they are queued.

**The future-migration wave converts Lock v2's actor-scoped legitimacy hardening into runtime org-scoped tenant ownership, in a sequenced, reviewable, rollback-able shape.**
