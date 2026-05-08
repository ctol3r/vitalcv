# W2-PR2B — Implementation Lock

**Wave:** Wave 2, PR 2B — implementation lock · **Date:** 2026-05-08 · **Status:** scope freeze; **NO product code in this artifact** · **Authority:** subordinate to `OWNERSHIP_INVARIANTS.md`, `RESOURCE_OWNERSHIP_DICTIONARY.md`, and the W2-PR2 planning set (`w2-pr2-{ownership-model,resource-map,ownership-threat-model,mutation-semantics,route-ownership-matrix}.md`); supersedes implementation-convenience appeals to "while we're here, let's also …"

This document freezes the exact allowed implementation boundary for the W2-PR2B implementation PR. It is a contract. The implementer reads this before opening the PR; the reviewer reads it before approving the merge. A change that falls outside the boundaries listed here is **not part of W2-PR2B**, regardless of merit, and must be deferred to its own PR.

---

## 1. Allowed files (exact list — nothing else may be modified)

Exactly four files may be created or modified by the W2-PR2B implementation PR:

| File | Allowed change | Why scoped to this file |
|---|---|---|
| `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` | Add the canonical mutation gate sequence (§3) before each mutating action; reclassify `view` and `acceptance-history` per `w2-pr2-route-ownership-matrix.md` §A | This is the route handler that emits `EmployerAcceptance` and is the highest-blast-radius unprotected mutation per `launch-blockers.md` |
| `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts` | Add the canonical mutation gate sequence; ownership check before any read or mutation | Sibling route in the same namespace — same ownership rules apply |
| `apps/web/lib/auth/employerReviewOwnership.ts` (new) | Define `requireOwnedEmployerReview(...)` per `w2-pr2-mutation-semantics.md` §5 — pure server-only helper, no abstraction beyond what these two routes need | Single shared helper; consumed by exactly two callers |
| `apps/web/__tests__/employer-review-ownership.test.ts` (new) | The 31-case regression test per `w2-pr2-mutation-semantics.md` §7 | Locks the contract; merge-gate companion |

**No other product file may be touched.** No design system, no marketing copy, no service-layer refactor, no shared "ownership" library, no other API route.

The PR may add up to **2 audit-trail docs** in `docs/ops/` (`w2-pr2b-implementation-summary.md`, `w2-pr2b-risk-review.md`). Anything else is out of scope.

---

## 2. Forbidden files (explicit)

The following files **must not be modified** by W2-PR2B. A diff that touches any of them is a defect:

```
apps/web/prisma/schema.prisma                          # No schema changes
apps/api/backend/prisma/schema.prisma                  # No schema changes
apps/api/backend/prisma/migrations/                    # No migrations
apps/web/middleware.ts                                  # Already wired by W2-PR1A
apps/web/lib/auth/orgInvitations.ts                     # RBAC primitives — frozen
apps/web/lib/auth/roles.ts                              # No role definitions changed
apps/web/lib/issuer-verification/                       # Issuer trust chain — different domain
apps/web/app/api/verifier/                              # W2-PR4 scope
apps/web/app/api/audit/                                 # W2-PR3 scope
apps/web/app/api/hiring/                                # W2-PR3 scope
apps/web/app/api/psv/                                   # W2-PR3 scope
apps/web/app/api/employer/applications/                 # W2-PR3 scope
apps/web/app/api/employer/decisions/                    # W2-PR3 scope
apps/web/app/api/credentials/                           # Subject-scoped sweep — different wave
apps/web/app/api/applications/                          # Subject-scoped sweep — different wave
packages/                                               # All packages
services/                                               # All services
.github/workflows/                                       # CI workflow changes are separate concern
```

Adding a new directory (e.g., `apps/web/lib/policy-engine/`) is forbidden. Adding new shared abstractions, generalization helpers, or "ownership middleware" beyond the single helper named in §1 is forbidden.

---

## 3. Allowed mutation types

W2-PR2B addresses these mutating actions on `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`:

| Action | HTTP | Allowed change | Forbidden change |
|---|---|---|---|
| `accept` | POST | Add gate sequence; require `admin`+ role; atomic write | Re-design the acceptance shape; alter `EmployerAcceptance` row; modify CRS gate |
| `confirm-start` | POST | Add gate sequence; require `admin`+; verify referenced `EmployerAcceptance` exists | Modify `StartAttestation` schema; alter canonical-path semantics |
| `request-refresh` | POST | Add gate sequence; require `member`+; atomic write | Implement the underlying refresh dispatch (separate concern) |
| `route-to-review` | POST | Add gate sequence; require `member`+; atomic write | Implement the human-review queue (separate concern) |
| `share-packet` | POST | Add gate sequence; require `member`+; atomic write of share artifact | Modify the share-token cryptographic shape (separate concern; see threat T-2) |

And these read actions (currently misclassified):

| Action | HTTP | Allowed change |
|---|---|---|
| `view` | GET | Reclassify from `PUBLIC_MUTATION_ACTIONS` to `AUTHENTICATED_READ_ACTIONS` AND add ownership check; OR document share-token public path with token-validation |
| `acceptance-history` | GET | Reclassify from `PUBLIC_READ_ACTIONS` to `AUTHENTICATED_READ_ACTIONS` AND add ownership check; same caveat |
| `packet`, `status` | GET | Already authenticated; ADD ownership check |

**No other action is added by W2-PR2B.** Adding a new action under `[action]` requires a separate PR with its own `route-ownership-matrix.md` row update.

---

## 4. Ownership derivation sources (server-authoritative — no client trust)

Per `OWNERSHIP_INVARIANTS.md` §1.4 and §1.5:

| Source | Trust level | Permitted use in W2-PR2B |
|---|---|---|
| `session.userId` from Clerk JWT | TRUSTED — Clerk-signed | `actorId` for audit writes |
| `session.sessionClaims.vitalcv.org_id` from Clerk JWT | TRUSTED — Clerk-signed | `requestingTenantId` for ownership compare |
| `session.sessionClaims.vitalcv.team_role` (via `parseTeamRole`) | TRUSTED via runtime validation | role gate at handler level |
| `EmployerReview.tenantId` from DB (loaded by `entityId`) | TRUSTED — server-persisted | `resourceTenantId` for ownership compare |
| URL parameter `[entityId]` | UNTRUSTED — names a resource lookup, not an owner | as the lookup key only |
| URL parameter `[action]` | UNTRUSTED | matched against the allowlist sets in §3 |
| Request header `x-verifier-org` | **MUST NOT BE READ BY THE HANDLER** | (validated by middleware Layer 1; not consulted at Layer 3) |
| Request body fields named `tenantId`, `orgId`, `org_id`, `tenant_id`, `org`, `org_slug`, `verifier_org`, etc. | **MUST NOT BE USED AS PERSISTENCE KEY** | discarded; if present, the audit row records the discard |
| Query string parameters | UNTRUSTED — same rule as request body |
| Cookies | UNTRUSTED |

The handler reads owner identity ONLY from (`session.userId`, `session.sessionClaims.vitalcv.org_id`) and resource ownership ONLY from `EmployerReview.tenantId` after a DB load. Any other read of "tenant" / "org" identity is a defect.

---

## 5. Mandatory audit writes (atomic with mutation)

Every mutating action in §3 must produce exactly one `AuditEvent` row in the **same Prisma transaction** as the mutation. The shape per `w2-pr2-mutation-semantics.md` §3:

| Field | Source | Validation |
|---|---|---|
| `actorId` | `session.userId` | non-empty string; never `'system'` / `'unknown'` / `''` |
| `tenantId` | JWT-derived `requestingTenantId` | non-empty; matches `EmployerReview.tenantId` |
| `action` | `'employer_review.accept'` / `'employer_review.confirm_start'` / etc. | matches the allowlist; no free-form action names |
| `subjectId` | URL parameter `[entityId]` | non-empty; passed validation |
| `decidedAt` | server clock — `new Date().toISOString()` | always now |
| `payloadHash` | SHA-256 of redacted request body | always present |
| `correlationId` | request-scoped (header `x-correlation-id` if present, else generated UUID) | unique per `(actorId, 24h)` |
| `replaySafe` | `false` for all mutations in this PR | literal |
| `outcome` | `'permitted'` for success | required field |

**Denied attempts also write an audit row.** When the handler returns 404 (cross-tenant) or 403 (role-blocks):

| Field | Source for denied attempts |
|---|---|
| `actorId` | `session.userId` |
| `tenantId` | the **caller's** JWT org_id (so probing is clustered) |
| `action` | `'<action>.<reason>'` — e.g., `'employer_review.accept.cross_tenant'` |
| `subjectId` | the URL parameter (so the attempted resource is recorded) |
| `outcome` | `'denied'` |
| (other fields) | same as success path |

**A mutation completing without a paired `AuditEvent` row is a defect.** A denied attempt without a paired audit row is a defect (operationally — probing patterns must be visible).

The atomic boundary is `prisma.$transaction((tx) => ...)`. Tests assert both writes occur within it.

---

## 6. Mandatory denial behavior (the response matrix)

| Failure | HTTP | Response body | Header | Audit row written? |
|---|---|---|---|---|
| No Clerk session | 401 (sign-in redirect for browser; 403 for API) | empty | — | no (caller is unauthenticated; no actorId) |
| Auth present, JWT org_id missing | 403 | empty | `x-rbac-fail-closed: no_org_context` | yes — denied attempt |
| Auth present, role denies (e.g., readonly POST) | 403 | empty | — | yes — denied attempt |
| Auth present, role permits, **resource owned by another tenant** | **404** | empty | — | yes — denied attempt |
| Auth present, ownership confirmed, **workflow gate refuses** | 409 or 422 | `{ "error": "<gate_name>", "detail": "..." }` | — | yes — denied attempt |
| `EmployerReview` row missing in DB (no such entity) | **404** (same wire as cross-tenant) | empty | — | yes — denied attempt (records the probe) |
| `EmployerReview.tenantId` is null on row | 500 | empty | internal alert (data-integrity defect) | yes — alerted |
| DB read fails | 503 | empty | `x-rbac-fail-closed: ownership_unresolvable` | best-effort — log internally if no DB |
| URL parameter `entityId` malformed | 400 | `{ "error": "malformed_resource_id" }` | — | yes — denied attempt |
| Duplicate `correlationId` within 24h | 409 | `{ "error": "duplicate_request" }` | — | no — same actorId, prior row exists |
| Atomic transaction fails | 500 | empty | internal alert | no — partial state must rollback |

**Lock the matrix.** Any deviation (e.g., 403 for cross-tenant instead of 404) is a defect — it leaks tenant existence per `OWNERSHIP_INVARIANTS.md` §6.2.

---

## 7. Required tests (the 31-case regression)

Per `w2-pr2-mutation-semantics.md` §7. The test file `apps/web/__tests__/employer-review-ownership.test.ts` must cover at minimum:

| Group | Cases | What it locks |
|---|---|---|
| 7.1 — Per-action ownership (5 actions × 4 scenarios) | 20 | For each of `accept`, `request-refresh`, `route-to-review`, `share-packet`, `confirm-start`: owner-within-org-permitted-role → success; cross-tenant → 404; readonly POST → 403; no-auth → 403/401 |
| 7.2 — Audit atomicity | 3 | success writes one audit row in the transaction; resource update failure rolls back audit; audit write failure rolls back resource |
| 7.3 — Header-injection defense | 3 | `x-verifier-org` set to attacker org → 404; body `tenantId` field → 404; query `?tenantId=` → 404 |
| 7.4 — Probe resistance | 2 | random `entityId` (no row) → 404; valid `entityId` cross-tenant → 404 (same wire) |
| 7.5 — Edge cases | 5 | empty `entityId` → 400; overly long `entityId` → 400; null DB tenantId → 500; empty DB tenantId → 500; empty JWT org_id → 403 |
| 7.6 — Replay resistance | 1 | duplicate `correlationId` → 409 `duplicate_request` |
| **subtotal** | **34** | (3 above the 31-case planning floor — implement as 31 minimum, more if natural) |

**Mocked dependencies only:** Prisma client, Clerk `auth()`. NO real DB, NO real network. Tests run in vitest's `node` environment, sub-second total runtime.

---

## 8. Rollback triggers

The W2-PR2B implementation PR must be **reverted immediately** if any of the following surface after merge:

| Trigger | Why immediate revert |
|---|---|
| Production observability shows >0 successful `accept` actions where `EmployerAcceptance.tenantId !== EmployerReview.tenantId` | Cross-tenant acceptance leaked through the gate — the wave's mission failed |
| Production observability shows `AuditEvent` rows with empty `actorId` | The atomic-write contract is broken; mutations without attribution |
| Production observability shows mutations without paired `AuditEvent` rows in the same transaction | Atomic boundary is broken; auditability defect |
| 404 returned where 403 was expected (or vice versa) on a confirmed-routed scenario | The response matrix is leaking tenant existence — enumeration resistance broken |
| Build regression on Edge runtime | Helper accidentally imports a Node-only API |
| Vitest sweep regresses by ≥1 test (excluding the 31 new cases) | Some other test broke silently |
| Lint regresses | Code-quality regression |
| Verified report from a customer / pilot org of unexplained acceptance on their queue | Cross-tenant breach observed in the wild |

Per `openclaw-pr-scope-rules.md` Rule 9: revert first, root-cause second. Do **not** attempt to "fix forward" on a security regression.

The revert command:

```
gh pr revert <PR-NUMBER> --title "revert: W2-PR2B employer-review ownership enforcement"
```

The revert PR itself must pass Codex SAFE before merge.

---

## 9. Blast-radius boundaries

### What W2-PR2B protects

- `/api/employer-review/[entityId]/{accept, confirm-start, request-refresh, route-to-review, share-packet}` mutating actions become tenant-scoped.
- `/api/employer-review/[entityId]/{view, acceptance-history, packet, status}` reads become ownership-checked.
- `/api/employer-review/npi/[npi]/refresh-requests` read/write becomes ownership-checked.

### What W2-PR2B does NOT protect

- Any route under `/api/verifier/*` — W2-PR4 scope
- Any route under `/api/audit/*` — W2-PR3 scope
- Any route under `/api/hiring/*` — W2-PR3 scope
- Any route under `/api/psv/*` — W2-PR3 scope
- Any route under `/api/employer/applications/*` and `/api/employer/decisions/*` — W2-PR3 scope
- Any subject-scoped clinician route — separate sweep wave
- Cross-tenant audit log read — `SECURITY_INVARIANTS.md` §4.5; separate wave
- Force-JWT-refresh on org membership change — Clerk session-policy concern; separate wave
- DB-level `UNIQUE` constraint on `EmployerAcceptance(entityId)` — schema concern; FOUNDER_REQUIRED separate PR
- Schema-level `NOT NULL` enforcement on `tenantId` columns — schema concern; FOUNDER_REQUIRED separate PR

### What if a regression in another route surfaces during W2-PR2B development?

Stop. Document. Defer. Do not fix in this PR. The discipline is: **one concern per PR**. A regression unrelated to employer-review-ownership is a separate concern and gets a separate PR.

### What if the implementation reveals a missing helper?

Add the helper **only** if it is consumed by the four files in §1 AND nothing outside this PR. If the helper would be useful for `/api/verifier/*` (W2-PR4) or `/api/audit/*` (W2-PR3), do NOT generalize it; keep it scoped to employer-review. The future wave can extract it then.

### What if Prisma schema requires a change?

**Stop.** Schema changes are FOUNDER_REQUIRED per `openclaw-risk-classification.md`. If W2-PR2B cannot complete without a schema change, surface the dependency and defer. The W2-PR2B PR ships with no schema delta.

---

## 10. Canonical mutation gate sequence (immutable)

This sequence is the merge-gate contract. Every mutating action in §3 follows it exactly. **Order is load-bearing — do not reorder.**

```
1. AUTHENTICATE
   const session = await auth();
   if (!session.userId)
     → return 403 (or 401 sign-in redirect for browser flows)

2. RBAC VALIDATE
   const { requestingOrgId, teamRole } = extractVerifierClaims(session.sessionClaims);
   if (!requestingOrgId)
     → return 403 no_org_context (audit denied)
   if (!roleAllowsAction(teamRole, action))
     → return 403 role_denies (audit denied)

3. DERIVE OWNERSHIP SERVER-SIDE
   const requestingTenantId = requestingOrgId;  // JWT-derived only
   const review = await prisma.employerReview.findUnique({
     where: { entityId },
   });

4. VALIDATE OWNERSHIP
   if (!review)
     → return 404 (audit denied — record probe)
   if (typeof review.tenantId !== 'string' || review.tenantId.length === 0)
     → return 500 + internal alert (data integrity defect)
   if (review.tenantId !== requestingTenantId)
     → return 404 cross_tenant (audit denied — record probe)

5. VALIDATE WORKFLOW LEGITIMACY
   const wf = checkWorkflowGate(review, action, body);
   if (!wf.permitted)
     → return 409 or 422 with structured { error, detail } (audit denied)

6. WRITE MUTATION + AUDIT ATOMICALLY
   const result = await prisma.$transaction(async (tx) => {
     const updated = await tx.employerReview.update({ where: { entityId }, data: ... });
     await tx.auditEvent.create({
       data: {
         actorId: session.userId,
         tenantId: requestingTenantId,
         action: '<action>',
         subjectId: entityId,
         decidedAt: nowIso(),
         payloadHash: sha256(redactedBody),
         correlationId,
         replaySafe: false,
         outcome: 'permitted',
       },
     });
     return updated;
   });

7. RETURN
   return NextResponse.json(structuredResponse(result), { status: 200 });
```

A handler that:
- Skips any step → defect
- Reorders steps → defect
- Splits step 6 across multiple `await`s outside `$transaction` → defect (atomicity broken)
- Reads `requestingTenantId` from anywhere other than the JWT → defect
- Reads ownership from anywhere other than the persisted row → defect

---

## 11. Codex audit prompt (for the implementation PR)

The W2-PR2B implementation PR's Codex audit must produce literal `Codex verdict: SAFE` after three audits:

**Implementation audit:** verify the canonical 6-step sequence appears in each of the five mutating actions; verify the helper `requireOwnedEmployerReview` is consumed at every action; verify `extractVerifierClaims` is the only path for claim extraction; verify `prisma.$transaction((tx) => ...)` wraps both the resource update and the audit write.

**Diff audit:** verify exactly four product files changed; verify no file under `apps/web/prisma/`, `apps/web/middleware.ts`, `apps/web/lib/auth/orgInvitations.ts`, `apps/web/lib/auth/roles.ts`, `apps/web/app/api/{verifier,audit,hiring,psv,employer/applications,employer/decisions}/`, `packages/`, `services/`, or any schema is touched; verify no new dependency is added to `apps/web/package.json`.

**Security/copy audit:** verify cross-tenant always returns 404 (never 403); verify no `actorId` defaulted to `'system'` / `'unknown'` / `''`; verify no banned strings introduced; verify no client-supplied `tenantId` field used as a persistence key; verify the handler reads `x-verifier-org` ZERO times.

---

## 12. Founder review requirement

W2-PR2B is **HIGH_RISK** per `openclaw-risk-classification.md` (auth boundary modification + atomic-audit-write contract on highest-blast-radius route). Founder review is **REQUIRED** before merge, regardless of Codex SAFE. The founder reviews:

- The diff against this lock document.
- The Codex audit transcript.
- The risk-review doc (`w2-pr2b-risk-review.md`) produced by the implementation PR.
- The implementation summary (`w2-pr2b-implementation-summary.md`).

A merge without founder approval on a HIGH_RISK auth-boundary change is a process defect.

---

> W2-PR2B is frozen to employer-review ownership enforcement only.
