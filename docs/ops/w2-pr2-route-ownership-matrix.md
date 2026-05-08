# W2-PR2 — Route Ownership Matrix

**Wave:** Wave 2, PR 2 — planning only · **Date:** 2026-05-07 · **Status:** architecture; **NO product code in this artifact**

This doc classifies every API route in `apps/web/app/api/` against the four-layer authorization model. It is the merge-time gate: every route added in W2-PR2 (or any future wave) MUST appear in this matrix with explicit classifications, OR carry founder approval to be excluded.

**Classification axes** (per axis: `yes` / `no` / `n/a`):

- **Authenticated** — does the route require a Clerk session?
- **RBAC-protected** — does the route check the JWT role / team_role beyond mere authentication?
- **Ownership-protected** — does the route handler verify the resource is owned by the requesting tenant?
- **Workflow-protected** — does the route enforce a state-transition gate (issuer chain, canonical path, etc.)?
- **Audit-sensitive** — does the route MUST write an `AuditEvent` on success and on attribution-relevant failures?

**Status column:**
- `current` — what's on origin/main today (best-effort inference; `?` = unverified by this audit)
- `target` — what W2-PR2 (or the named follow-up wave) brings the route to

---

## §A. `/api/employer-review/**` — primary W2-PR2 scope

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/api/employer-review/[entityId]/accept` | POST | yes | `admin`+ | **MUST** | yes (CRS ≥ 80; review state) | **MUST** | current: ❌ ownership/audit; target: ✅ all |
| `/api/employer-review/[entityId]/confirm-start` | POST | yes | `admin`+ | **MUST** | yes (Acceptance referenced) | **MUST** | current: ❌; target: ✅ |
| `/api/employer-review/[entityId]/request-refresh` | POST | yes | `member`+ | **MUST** | yes (review state permits) | **MUST** | current: ❌; target: ✅ |
| `/api/employer-review/[entityId]/route-to-review` | POST | yes | `member`+ | **MUST** | yes | **MUST** | current: ❌; target: ✅ |
| `/api/employer-review/[entityId]/share-packet` | POST | yes | `member`+ | **MUST** | yes (sharable state) | **MUST** | current: ❌; target: ✅ |
| `/api/employer-review/[entityId]/view` | GET | **needs reclassification** — currently `PUBLIC_MUTATION_ACTIONS` | depends | depends | n/a | minimum-info | current: public; target: auth+ownership OR documented share-token-protected public read |
| `/api/employer-review/[entityId]/packet` | GET | yes (already in `AUTHENTICATED_READ_ACTIONS`) | `readonly`+ | **MUST** | n/a | minimum-info | current: auth ✅, ownership ❌; target: ✅ |
| `/api/employer-review/[entityId]/status` | GET | yes | `readonly`+ | **MUST** | n/a | minimum-info | current: auth ✅, ownership ❌; target: ✅ |
| `/api/employer-review/[entityId]/acceptance-history` | GET | **needs reclassification** — currently `PUBLIC_READ_ACTIONS` | depends | depends | n/a | minimum-info | current: public; target: auth+ownership OR share-token-public |
| `/api/employer-review/npi/[npi]/refresh-requests` | GET / POST | yes | `member`+ | **MUST** (verifier-org owns the refresh-request stream for that NPI) | yes (state) | **MUST** | current: ❌; target: ✅ |

**W2-PR2 implements the `target` row for each of the above.** This is the wave's scope.

---

## §B. `/api/verifier/**` — W2-PR4 scope (NOT this PR)

No routes exist on origin/main today. When W2-PR4 ships, every new route under this namespace MUST be classified before merge. The required classifications:

| Route pattern | Authenticated | RBAC | Ownership | Workflow | Audit |
|---|---|---|---|---|---|
| `/api/verifier/team` (GET) | yes (W2-PR1 middleware) | `readonly`+ | yes — within own org | n/a | minimum-info |
| `/api/verifier/team/[memberId]` (PATCH/DELETE) | yes | `admin`+ | yes | yes (role transitions) | **MUST** |
| `/api/verifier/invite` (POST) | yes | `admin`+ | yes — issuing org | yes (invitation state) | **MUST** |
| `/api/verifier/invite/[code]/accept` (POST) | yes | the invited user | yes — code → org binding | yes (one-time) | **MUST** |
| `/api/verifier/packet/[packetId]` (GET) | yes | `readonly`+ | yes | n/a | minimum-info |
| `/api/verifier/decision/[decisionId]` (POST) | yes | `member`+ | yes | yes (decision state) | **MUST** |

**The matrix entry is the merge gate. A route under `/api/verifier/*` that does not fit one of these classifications must be founder-approved.**

---

## §C. `/api/issuer/**` — issuer-side audit / persistence (W2-PR3 + Code Red Phase 3 work)

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/api/issuer/policy-review/[requestId]` (POST) | POST | yes | issuer-org `admin`+ | yes — issuer-org owns the request | yes (5-gate flow in `policyReview.ts`) | **MUST** under `ISSUER_PERSISTENCE_ENABLED` flag | current: behind flag; target: enforced unconditionally for the gated env |
| `/api/issuer/psv-receipt/[requestId]` (POST) | POST | yes | issuer-org `admin`+ | yes | yes (gate-checked promotion) | **MUST** | current: behind flag; target: enforced |
| `/api/issuer/psv-reuse/[receiptId]` (POST) | POST | yes | reusing-org `member`+ | yes — both reusing AND issuing tenants | yes (cross-tenant consent gate) | **MUST** | current: foundation only; target: implementation depends on W6 |

**Issuer-side route handlers are partially wired; full enforcement is Code Red Phase 3 + W2-PR3 scope.**

---

## §D. `/api/audit/**` — audit visibility (W2-PR3 scope)

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/api/audit/events` (GET) | GET | yes | `ADMIN` `UserRoleType` only | yes — caller's tenantId scopes the read | n/a | the route IS the audit | **current: PUBLIC** (vulnerability); target: ADMIN+ownership |
| `/api/audit/events/[eventId]` (GET) | GET | yes | `ADMIN` | yes | n/a | minimum-info read-of-audit | current: not implemented; target: ADMIN+ownership |

**Until W2-PR3 lands, the audit endpoint is exposed publicly per `current-state-map-2026-05-07.md`. This is one of the highest-priority remaining gaps.**

---

## §E. `/api/hiring/**`, `/api/employer/applications/**`, `/api/employer/decisions/**` — W2-PR3 scope

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/api/hiring/accept` (POST) | POST | yes | `member`+ | yes — verifier owns the hire request | yes (Acceptance referenced) | **MUST** | current: PUBLIC (gap); target: full |
| `/api/hiring/start` (POST) | POST | yes | `admin`+ | yes | yes (StartAttestation gate) | **MUST** | current: PUBLIC (gap); target: full |
| `/api/employer/applications/dashboard` (GET) | GET | yes | `member`+ | yes — only the org's own apps | n/a | minimum-info | current: PUBLIC (gap); target: full |
| `/api/employer/applications` (GET, POST) | GET | yes | `member`+ | yes | yes for state changes | **MUST** for mutations | current: PUBLIC (gap); target: full |
| `/api/employer/decisions` (GET) | GET | yes | `member`+ | yes | n/a | minimum-info | current: PUBLIC (gap); target: full |

**These are W2-PR3 dependencies. Each is tenant-scoped and currently unguarded. The pattern this PR establishes for employer-review applies verbatim.**

---

## §F. `/api/psv/**` — primary-source-verification routes (W2-PR3 scope)

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/api/psv/oig/check/[npi]` | POST | yes | `VERIFIER` role | n/a — subject is the NPI; tenant authorization gates the EXECUTION not the resource | n/a | **MUST** for cost-tracking + freshness | current: PUBLIC (gap); target: full |
| `/api/psv/oig/batch` | POST | yes | `VERIFIER` role | n/a (subject-keyed) | n/a | **MUST** | current: PUBLIC (gap); target: full |
| `/api/psv/[receiptId]` | GET | yes | scope-of-receipt-permits | yes — verify caller has read access to the receipt | n/a | minimum-info | current: ?; target: full |

Subject-scoped (NPI) routes do not have a tenant owner per se, but they have an **execution authority** — a tenant must be paying for and authorized to execute the check. The audit row records WHICH tenant invoked the check, even though the result is cached for cross-tenant reuse.

---

## §G. Subject-scoped clinician routes — (mostly already in scope or deferred)

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit | Status |
|---|---|---|---|---|---|---|---|
| `/api/identity/[npi]/ingest` | POST | yes | `CLINICIAN` (the subject) OR system | yes — JWT.userId binds to NPI via Clerk publicMetadata | n/a | minimum-info | current: ?; target: subject-ownership |
| `/api/identity/bootstrap/[npi]` | GET | partial (per `apply` public delegation) | n/a public | n/a (public NPPES data) | n/a | minimum-info | current: PUBLIC (correct for public NPPES) |
| `/api/credentials/mine` | GET | yes | `CLINICIAN` | yes — JWT.userId is the subject | n/a | minimum-info | current: ?; target: subject-ownership |
| `/api/credentials/[id]/confirm` | POST | yes | `CLINICIAN` | yes — credential.subjectId === JWT.userId | yes (state permits confirmation) | **MUST** | current: ?; target: subject-ownership |
| `/api/credentials/ingest-npi` | POST | yes (clinician for own; system for ingest) | `CLINICIAN` or system | yes | n/a | minimum-info | current: ?; target: subject-ownership |
| `/api/applications/[appId]/review` | GET | yes | applicant OR receiving employer | yes — appId binds to applicant + employer org | n/a | minimum-info | current: ?; target: full |
| `/api/applications/[appId]/withdraw` | POST | yes | applicant only | yes | yes (state permits withdraw) | **MUST** | current: ?; target: subject-ownership |
| `/api/applications/[appId]/workflow` | POST | yes | applicant or employer (per action) | yes | yes | **MUST** | current: ?; target: full |
| `/api/apply/bundle/[bundleId]` | GET | depends — public-share path or auth-required | n/a | yes — bundle.subjectId | n/a | minimum-info | current: public per delegation; target: confirm share-token model |
| `/api/apply/share/[shareId]` | GET | depends — share-token | n/a | yes — token validates | n/a | minimum-info | current: public delegation; target: token enforcement |
| `/api/apply/shares/[npi]` | GET | depends | n/a | yes — backend ACL on NPI | n/a | minimum-info | current: PUBLIC (backend ACL responsibility per current state map); target: backend-side guard |

---

## §H. Public infrastructure / health (no ownership concerns)

| Route | Method | Authenticated | RBAC | Ownership | Workflow | Audit |
|---|---|---|---|---|---|---|
| `/api/health` | GET | no | n/a | n/a | n/a | n/a |
| `/api/readyz` | GET | no | n/a | n/a | n/a | n/a |
| `/api/.well-known/jwks.json` | GET | no | n/a | n/a | n/a | n/a |
| `/api/deploy-info` | GET | no | n/a | n/a | n/a | n/a |
| `/api/internal/source-health/snapshots` | GET | yes — CRON_SECRET | `CRON_SECRET` bearer | n/a (system-scoped) | n/a | minimum-info |
| `/api/internal/source-health/probe` | POST | yes — CRON_SECRET | `CRON_SECRET` bearer | n/a | n/a | minimum-info |

---

## §I. Trust-state and intelligence routes — public per design (per `MASTER_PROMPT.md` §6)

These surfaces are intentionally public — NPPES data is public, OIG is public, PECOS quarterly snapshot is public. The route emits public data; no ownership check is required because there is no tenant owner.

| Route | Authenticated | RBAC | Ownership | Workflow | Audit |
|---|---|---|---|---|---|
| `/api/trust-state/[npi]` (GET) | optional | n/a | n/a — public data | n/a | minimum-info |
| `/api/trust-state/[npi]/refresh` (POST) | yes (cost-tracking) | `VERIFIER` or system | n/a | n/a | **MUST** |
| `/api/trust-state/[npi]/history` (GET) | optional | n/a | n/a | n/a | minimum-info |
| `/api/passport/npi/[npi]` (GET) | optional | n/a | n/a | n/a | minimum-info |
| `/api/entity/resolve/npi/[npi]` (GET) | optional | n/a | n/a | n/a | minimum-info |
| `/api/intelligence/providers/[npi]` (GET) | yes (intelligence routes are AUTHENTICATED) | n/a | n/a | n/a | minimum-info |
| `/api/intelligence/launch-readiness` (GET) | yes | n/a | n/a | n/a | minimum-info |

---

## §J. Routes that MUST NOT change ownership semantics in W2-PR2

| Route | Reason |
|---|---|
| Anything in `apps/web/lib/issuer-verification/` | PSV trust chain — different domain, frozen literals (`decisionGrade: false`, `proofTier: 'receipt_candidate'`); explicit deferral |
| `/api/auth/resolve-role` | Clerk session-recovery path; do not modify in this wave |
| `/api/intelligence/**`, `/api/investigation/**` | Graceful-degrade pattern from W2-PR1; do not break |
| `/api/internal/**` | `CRON_SECRET`-gated; separate trust boundary |
| Anything in `apps/api/backend/` | Backend-side enforcement; tracked separately by backend audit |

---

## Summary — gaps closed by W2-PR2 vs gaps deferred

### W2-PR2 closes (employer-review namespace, ~10 routes)

5 mutating actions × ownership check + atomic audit write + tests = primary scope.
Plus reclassification of `view` and `acceptance-history` (currently public; needs auth + ownership OR documented share-token-public).
Plus the pattern (helpers + tests) that W2-PR3 / W2-PR4 will replicate.

### Deferred to W2-PR3

- `/api/audit/events` ADMIN gate
- `/api/hiring/**` ownership + audit
- `/api/employer/applications`, `/api/employer/decisions` ownership + audit
- `/api/psv/oig/**` execution-authority + audit

### Deferred to W2-PR4

- Every `/api/verifier/**` route handler with Layer-2 ownership check
- Verifier invitation lifecycle

### Deferred to subject-scoped sweep (separate wave)

- `/api/credentials/**` clinician-subject ownership
- `/api/applications/**` applicant + employer ownership
- `/api/identity/**` clinician-subject binding to NPI

---

## Merge-time review gate

Every PR that touches `apps/web/app/api/**` MUST update this matrix. A route that lacks a row is a defect. A row whose `current` column does not match the actual code is a regression. Reviewers verify the diff against this matrix.

The matrix is the source of truth for "is this route gated correctly?" — code review consults it; tests assert against it; the founder approves changes to it.
