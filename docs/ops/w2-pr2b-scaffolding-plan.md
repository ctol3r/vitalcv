# W2-PR2B — Implementation Scaffolding Plan

**Wave:** Wave 2, PR 2B — implementation scaffolding · **Date:** 2026-05-08 · **Status:** scaffolding only; **NO product code in this artifact** · **Authority:** subordinate to `MUTATION_GATE_SEQUENCE.md`, `OWNERSHIP_INVARIANTS.md`, `w2-pr2b-implementation-lock.md` and the W2-PR2 planning set; supersedes implementer-convenience generalization.

This doc is the **top-level scaffolding map** for the W2-PR2B implementation PR. It does not introduce new behavior. It enumerates the minimum explicit shape that the implementation must take so that the canonical mutation gate sequence is honored on every employer-review mutating action. It is a contract between the planning bundle (already locked) and the implementation PR (not yet opened).

The peer scaffolding docs decompose the contract along three axes:

- `w2-pr2b-mutation-flow.md` — the request-lifecycle skeleton (one sequence applied to all five actions).
- `w2-pr2b-ownership-derivation.md` — per-action ownership derivation source rules.
- `w2-pr2b-audit-coupling.md` — per-action audit-row contract and atomicity semantics.

Together, the four docs are sufficient to write the implementation PR without introducing scope creep, generalized abstractions, or unaudited mutations.

---

## 1. Scope under scaffolding

**In scope (frozen by `w2-pr2b-implementation-lock.md` §1, §3):**

The five mutating actions on `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`:

| Mutation | HTTP | Required role | Resource of record |
|---|---|---|---|
| `accept` | POST | `admin`+ | writes `EmployerAcceptance` |
| `confirm-start` | POST | `admin`+ | writes `StartAttestation` |
| `request-refresh` | POST | `member`+ | writes `RefreshRequest` |
| `route-to-review` | POST | `member`+ | updates `EmployerReview.reviewState` |
| `share-packet` | POST | `member`+ | writes share-artifact (e.g., `ApplyShare`) + token reference |

Plus the read reclassifications already enumerated in the lock (`view`, `acceptance-history`, `packet`, `status`) — those are scaffolded in `w2-pr2b-mutation-flow.md` §6 but are not "mutations" in the gate-sequence sense.

The sibling refresh-requests route (`apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts`) follows the same scaffold; an `npi`-keyed lookup substitutes for `entityId` per the lock §1 file row.

**Out of scope (explicit forbid):**

- Ownership enforcement on any other route family (verifier, audit, hiring, psv, employer/applications, employer/decisions, credentials, applications). Those are W2-PR3 and W2-PR4.
- Any schema migration, role-table change, or new Prisma model.
- Any "general ownership middleware" beyond the single `requireOwnedEmployerReview` helper called out in the lock §1.
- Any change to the canonical 5-step path (Recognition → Acceptance → Start → … per `MASTER_PROMPT.md` §3); workflow gates are READ from existing domain code, not introduced here.

---

## 2. Minimal explicit components (the four-piece scaffold)

The implementation PR introduces exactly four product-code components. Anything else is out of scope.

### 2.1 The ownership helper — `apps/web/lib/auth/employerReviewOwnership.ts` (new)

Single shared file. Pure server-only import. Consumed by exactly two callers (the two route files). Its conceptual signature is fixed by `w2-pr2-mutation-semantics.md` §5; W2-PR2B does not widen it.

Responsibilities (§5 of mutation-semantics):

1. Resolve `auth()`.
2. Reject when `userId` is absent.
3. Run JWT claims through the existing `extractVerifierClaims` (from `apps/web/lib/auth/orgInvitations.ts`, frozen by W2-PR1A).
4. Reject when `org_id` is absent.
5. Optional role gate against `requireRole` (defaults to `'member'` per resource dictionary).
6. Load `EmployerReview` by `entityId`.
7. Return 404 wire on missing row OR cross-tenant row.
8. Return 500 + alert on null/non-string `tenantId` (data-integrity defect).
9. On success return `{ ok: true, requestingTenantId, actorId, resource }`.

The helper does **NOT** write the audit row. Auditing is the caller's responsibility, scoped to the action being attempted (so the action-name and payload-hash are correct).

The helper is **NOT** generalized to "any tenant-scoped resource." It is specifically the employer-review ownership helper. A future PR may generalize it after a second caller emerges; W2-PR2B does not.

### 2.2 The route-handler reshape — `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`

The handler is reshaped to invoke the canonical 6-step gate sequence (per `MUTATION_GATE_SEQUENCE.md` §2) before each mutating action. The reshape is described as a flow in `w2-pr2b-mutation-flow.md`. It does not alter:

- The action-name allowlist (already pinned in `w2-pr2-route-ownership-matrix.md` §A).
- The CRS-80 acceptance gate logic.
- The canonical-path domain in `packages/domain-common/employmentGuards.ts`.
- The shape of the `EmployerAcceptance` / `StartAttestation` / `RefreshRequest` / share-artifact rows.

The reshape only adds: the helper invocation, the role gate, the workflow check (read from existing domain code), the atomic write wrapper, and the denied-path audit emission.

### 2.3 The sibling route — `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts`

Same reshape as 2.2 with `npi` substituted for `entityId`. Currently this route exposes refresh-request reads/writes without ownership enforcement; W2-PR2B closes that.

### 2.4 The regression test — `apps/web/__tests__/employer-review-ownership.test.ts` (new)

The 31-case (34 implemented) regression file enumerated in `w2-pr2b-implementation-lock.md` §7. It locks every cell of the gate sequence per action: identity, role, ownership, workflow, atomicity, denial wire, audit emission, replay resistance. It runs in vitest's `node` environment with mocked Prisma + Clerk; sub-second runtime; deterministic.

---

## 3. The canonical 6-step gate sequence (recap)

Per `MUTATION_GATE_SEQUENCE.md` §2, every mutating action runs the same sequence in the same order. W2-PR2B is the first wave to apply it end-to-end on real route handlers.

```
1. Authenticate           — Clerk session → 401/403 if missing
2. Validate RBAC          — JWT team_role permits this verb → 403 if not
3. Derive ownership       — server only; from JWT org_id and DB resource.tenantId
4. Validate ownership     — resource.tenantId === requestingTenantId → 404 if not
5. Validate workflow      — domain rule (CRS-80, prior-acceptance-exists, etc.)
6. Atomic write + audit   — single Prisma transaction emits both rows
```

Each action's per-step parameter values are tabulated in `w2-pr2b-ownership-derivation.md` and `w2-pr2b-audit-coupling.md`. A handler that takes a shortcut on any step fails the merge gate.

---

## 4. Build sequence (the work the implementer does)

The PR is opened in this order. Reordering is allowed; skipping is not.

| Step | Work | Verification |
|---|---|---|
| S1 | Create `employerReviewOwnership.ts` with the conceptual signature; no callers yet | `pnpm typecheck` passes; helper has no runtime callers |
| S2 | Create the regression test file with all 34 cases initially red | tests fail with "not implemented" sentinel — establishes the contract |
| S3 | Reshape `[action]/route.ts` action-by-action (5 mutations × 6 steps) | each action's 4 ownership scenarios + 1 audit case turn green incrementally |
| S4 | Reshape sibling `refresh-requests/route.ts` mirror | sibling-route cases turn green |
| S5 | Reclassify the read actions (`view`, `acceptance-history`, etc.) per lock §3 | read-classification cases turn green |
| S6 | Add the 5 edge cases (§7.5) and the replay-resistance case (§7.6) | full 34/34 green |
| S7 | Author `w2-pr2b-implementation-summary.md` and `w2-pr2b-risk-review.md` | docs-only |
| S8 | Codex SAFE audit (mandatory per `OWNERSHIP_INVARIANTS.md` §7.5) | three audits: implementation / diff / copy |
| S9 | Founder approval (HIGH_RISK + cross-tenant + audit-write + first-of-kind) | per `SECURITY_INVARIANTS.md` §7.1 |
| S10 | Merge by Terminal under `gh pr merge` | merge hook validates Codex transcript |

---

## 5. Per-mutation scaffolding summary table

The full per-action contract appears in the peer docs. This table is the index.

| Mutation | Ownership rule (`derivation.md`) | Workflow rule (`mutation-flow.md` §5) | Audit row (`audit-coupling.md`) | Denial wire (`mutation-flow.md` §7) | Tenant-boundary guarantee |
|---|---|---|---|---|---|
| `accept` | `EmployerReview.tenantId === JWT.org_id` AND role ≥ `admin` | `reviewState ∈ {recognized, ready_for_acceptance}` AND `clinician.crs ≥ 80` | `'employer_review.accept'`, `outcome: 'permitted'`, atomic with `EmployerAcceptance` row | 404 cross-tenant; 403 readonly; 409 `crs_below_threshold`; 422 `wrong_review_state` | `EmployerAcceptance.tenantId` MUST equal `EmployerReview.tenantId` MUST equal JWT-derived `org_id` |
| `confirm-start` | same as `accept` (admin+) | prior `EmployerAcceptance` row exists for entity AND `acceptance.tenantId === requestingTenantId` AND `reviewState ∈ {accepted, ready_for_start}` | `'employer_review.confirm_start'`, references prior `EmployerAcceptance.id`, atomic with `StartAttestation` row | 404 cross-tenant; 403 readonly; 409 `no_prior_acceptance`; 422 `wrong_review_state` | `StartAttestation.tenantId` AND prior `EmployerAcceptance.tenantId` MUST equal JWT-derived `org_id` |
| `request-refresh` | `EmployerReview.tenantId === JWT.org_id` AND role ≥ `member` | `reviewState !== 'archived'` AND no open `RefreshRequest` for entity within 24h | `'employer_review.request_refresh'`, atomic with `RefreshRequest` row | 404 cross-tenant; 403 readonly; 409 `duplicate_refresh_request`; 422 `archived_review` | `RefreshRequest.tenantId` MUST equal JWT-derived `org_id` |
| `route-to-review` | `EmployerReview.tenantId === JWT.org_id` AND role ≥ `member` | `reviewState ∈ allowed-routable-states` (per `employmentGuards.ts`) | `'employer_review.route_to_review'`, atomic with `EmployerReview.reviewState` update | 404 cross-tenant; 403 readonly; 422 `wrong_review_state` | only `EmployerReview` rows owned by JWT org_id can transition state |
| `share-packet` | `EmployerReview.tenantId === JWT.org_id` AND role ≥ `member` | `reviewState !== 'archived'` AND share-token entropy ≥ 128 bits AND token bound to single `entityId` | `'employer_review.share_packet'`, records share-token ID (NOT the secret), atomic with `ApplyShare` row | 404 cross-tenant; 403 readonly; 422 `archived_review` | share artifact's `tenantId` MUST equal JWT-derived `org_id`; downstream public read of the token is a separate authorization (out of W2-PR2B scope) |

---

## 6. What scaffolding does NOT include

Scope discipline. The implementer is not authorized to add, even if the diff "feels small":

- A general-purpose `requireOwnedResource(resource, tenantId)` helper. The wave defines exactly one helper for `EmployerReview`.
- Ownership enforcement on `view`, `acceptance-history`, `packet`, `status` beyond the reclassification + ownership check (no audit-on-read in this wave; the lock §3 row-set is exact).
- Error-code consolidation across the wider API.
- Refactoring the existing CRS gate or canonical-path domain.
- Any change to the share-token cryptographic shape (threat T-2 is logged but not closed by W2-PR2B).
- Any change to readonly-role behavior beyond denying mutating verbs (readonly users may still successfully read tenant-scoped resources after the reclassification).

If the implementer needs any of the above, they pause and request a separate PR.

---

## 7. Hand-off contract

When W2-PR2B opens, the implementer asserts in the PR description:

1. The diff touches only the four files in the lock §1.
2. Every mutating action follows the 6-step canonical sequence.
3. Every cross-tenant request returns 404 (not 403).
4. Every mutation is paired with one and only one `AuditEvent` row in the same Prisma transaction.
5. Every denied attempt also writes an audit row (probe-visibility).
6. The 31-case (34 implemented) regression suite is green.
7. The Codex SAFE audit transcript is in the PR thread.
8. The founder has approved per `SECURITY_INVARIANTS.md` §7.1.

The supervisor (Desktop) verifies these against the diff and the merge transcript. The merge hook verifies the Codex SAFE verdict. The founder verifies the wave matches the lock + this scaffolding plan.

---

## 8. Closing principle

Scaffolding is the smallest explicit shape that makes the canonical mutation gate sequence inescapable on every employer-review mutating action. It is not architecture; it does not introduce new abstractions; it does not generalize. It captures exactly the four pieces (helper, two routes, test) that, together, make the gate sequence load-bearing.

If a piece can be removed without weakening the sequence, it should be removed. If a piece must be added to make the sequence load-bearing, it must be authorized by the lock or rejected.

**W2-PR2B's scaffolding is the gate sequence made executable for employer-review only — nothing more.**
