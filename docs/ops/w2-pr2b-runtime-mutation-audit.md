# W2-PR2B — Runtime Mutation Surface Audit

**Wave:** Wave 2, PR 2B — runtime audit · **Date:** 2026-05-08 · **Status:** audit only; **NO product code, NO runtime behavior modified, NO merge** · **Scope:** the employer-review mutation runtime surface as observed on `wave/w2-pr2b-employer-review-ownership` (cut from `origin/main` at `9eb5cdee`) · **Authority:** subordinate to `MUTATION_GATE_SEQUENCE.md`, `OWNERSHIP_INVARIANTS.md`, `AUTHORIZATION_BASELINE_V1.md`, and `w2-pr2b-implementation-lock.md`; supersedes the lock's *assumed* runtime shape with the *observed* runtime shape

This audit decomposes every mutation path, workflow transition, side effect, audit write, and ownership assumption that today exists in the employer-review runtime — across both the web-route entry point AND the directly coupled backend handlers + service functions + Prisma calls — so that subsequent ownership-enforcement waves operate on the actual surface, not on the planning bundle's idealized one.

The audit's central finding (called out below) is that the W2-PR2B implementation lock's plan presumed direct DB writes from the web route handlers and an `EmployerReview.tenantId` column. Reality differs in both respects. This document does NOT change the lock; it surfaces the deltas the lock must reconcile before code lands.

The peer audit docs decompose the surface along three axes:

- `w2-pr2b-mutation-branch-map.md` — per-branch decomposition (11 dimensions × 10 branches).
- `w2-pr2b-side-effect-inventory.md` — fire-and-forget calls, SEAL captures, learning events, outbox writes, recomputations.
- `w2-pr2b-workflow-transition-map.md` — canonical-path state transitions (Recognition → Acceptance → Start) and per-branch state effects.

Together with this top-level doc they are sufficient to (a) plan the W2-PR2B implementation against reality and (b) update the lock + scaffolding bundle to remove false premises.

---

## 1. Audited surface

The `/api/employer-review/**` mutation surface as observed on `9eb5cdee`:

### 1.1 Web entry points (proxy layer)

- `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` (528 LoC) — POST + GET; routes `[action]` to a backend forward via `BACKEND_URL`.
- `apps/web/app/api/employer-review/npi/[npi]/refresh-requests/route.ts` (26 LoC) — GET-only proxy.

### 1.2 Backend route handlers (persistence + audit layer)

- `apps/api/backend/src/routes/employerActions.ts` (993 LoC) — registers 10 routes via `registerEmployerActionRoutes(app)`; the substantive mutating handlers for accept / request-refresh / route-to-review / share-packet / confirm-start / packet / status / acceptance-history / refresh-requests live here.
- `apps/api/backend/src/routes/pilotKpi.ts` (lines 128–182) — separately registers POST `/api/employer-review/:entityId/view` which the web `[action]` route's `view` action proxies to.
- `apps/api/backend/src/routes/employer-action.ts` (148 LoC) — sibling registration of an older single-action endpoint; not on the audit's primary path but flagged in §6.

### 1.3 Backend service functions (Prisma writers)

- `apps/api/backend/src/services/entity/employerReviewActions.ts` — `recordEmployerReviewAcceptance`, `recordEmployerReviewRefreshRequest`, `recordEmployerReviewRouting`, plus readers `loadEmployerReviewStatus`, `loadEmployerAcceptanceHistory`, `resolveEmployerReviewSubject`.
- `apps/api/backend/src/services/entity/employerReviewAttribution.ts` — attribution resolver (`organizationContextId`, `bundleId`, source).
- `apps/api/backend/src/services/audit/auditService.ts` — generic `writeEmployerReviewAuditEvent` writer.
- `apps/api/backend/src/services/distribution/applyShareService.ts` — share-token utilities.
- `apps/api/backend/src/services/decision/omegaOrchestrator.ts` — `captureEmployerDecision` SEAL writer.
- `apps/api/backend/src/services/seal/sealEventCapture.ts` — `captureStartOutcome` and related.
- `apps/api/backend/src/services/pilot/*` — pilot KPI capture for the view path.

### 1.4 Prisma models touched (mutating)

| Model | Touched by | Mode |
|---|---|---|
| `EmployerAcceptance` | `recordEmployerReviewAcceptance` | INSERT (in `$transaction`) |
| `StartAttestation` | confirm-start handler | INSERT (in `$transaction`) |
| `HITLReviewItem` (optional) | `recordEmployerReviewRouting` | INSERT (in `$transaction`, optional via try/catch) |
| `AuditEvent` | every mutating path; some reads (`packet`); also `share-packet` standalone | INSERT |
| Outbox event table (via `writeEmployerReviewOutboxEvent`) | accept / refresh / routing | INSERT (in `$transaction`) |

No UPDATE on `EmployerReview` — there is no `EmployerReview` model. State is implicit: presence of an `EmployerAcceptance` row with `status === 'ACCEPTED'` plus presence of a `StartAttestation` referencing it.

---

## 2. Critical deltas between planning and reality

These deltas are the most consequential findings of the audit. The W2-PR2B implementation cannot land without resolving them. They are surfaced here, NOT silently absorbed.

### 2.1 No `EmployerReview` Prisma model

The lock §1, the scaffolding plan §1, and the mutation-flow doc §2.3 all reference `EmployerReview.tenantId` as the right-hand side of the ownership comparison. **No such model exists in either schema** (`apps/web/prisma/schema.prisma` or `apps/api/backend/prisma/schema.prisma`).

The closest analog: `EmployerAcceptance` has `organization String` (untyped descriptive text) and `employerId String?` (= Clerk user ID for the actor). Neither is a tenant identifier suitable for ownership enforcement. Cross-tenant comparison against either would compare apples to oranges (Clerk user_id vs. JWT org_id; or arbitrary org-name string vs. canonical org_id).

**Implication:** ownership enforcement requires either (a) introducing a `tenantId UUID` column on the relevant tables (schema migration — currently forbidden by the lock §2) or (b) deriving tenant from Clerk-membership lookups in real time (architecturally heavier; backend currently has no Clerk SDK access).

### 2.2 Web→Backend trust boundary uses `x-clerk-user-id` header, not JWT

The web route forwards Clerk identity to the backend via the `x-clerk-user-id` header (a string). The backend's `requireClerkUserId` reads `req.headers['x-clerk-user-id']` and trusts it unconditionally. There is **no JWT verification on the backend**.

This is fine when the only actor on the backend is the web proxy (load-balancer-locked or VPC-locked deployment). It is not fine if the backend is reachable from any other origin, because forging the header forges the actor.

**Implication:** the web layer is the canonical authorization frontier. Any plan that pushes ownership enforcement to the backend must either (a) add JWT verification at the backend boundary, or (b) trust the web proxy to carry forward the JWT-derived `org_id` in a similarly-trusted header (and document that the deployment locks the network path).

### 2.3 Web layer does NOT forward `org_id` to backend

Web `app/api/employer-review/[entityId]/[action]/route.ts` line 386 forwards `'x-clerk-user-id': userId` only. There is no `'x-vitalcv-org-id': orgId` companion. The post-W2-PR1A JWT validation extracts `org_id`, but that value is not propagated to the backend. The backend cannot enforce ownership today even if it wanted to.

**Implication:** before W2-PR2B can move enforcement to the handler, the web layer must propagate `org_id` (and `team_role`) to the backend via signed/trusted headers, AND the backend must (i) validate them and (ii) consult them at every mutating handler.

### 2.4 The route is a thin auth-checking proxy, not a DB writer

The web `[action]` route's POST handler:
1. Checks Clerk session (line 362).
2. Validates the action allowlist + body shape.
3. Forwards to `BACKEND_URL/api/employer-review/<entityId>/<action>` with the body and `x-clerk-user-id`.
4. Normalizes the upstream response.

It does NOT read or write any Prisma row. The `requireOwnedEmployerReview(req, entityId)` helper proposed by the lock §1 has no canonical implementation surface at the web layer because there is no DB to consult there.

**Implication:** the lock's "single shared helper consumed by exactly two callers in the web layer" is the wrong shape for the actual surface. The helper either belongs on the backend (consumed by ~10 backend route handlers + 5 service functions), or the web proxy's auth check must extend to reaching into the backend's read API for ownership lookup before forwarding, OR ownership must be enforced *inside* the existing service functions (so every backend handler inherits it).

### 2.5 Atomicity holds in 3 of 5 mutating handlers, not all 5

| Handler | `prisma.$transaction` wrapping | Audit row in same tx |
|---|---|---|
| `accept` | YES (`recordEmployerReviewAcceptance`) | YES |
| `request-refresh` | YES (`recordEmployerReviewRefreshRequest`) | YES |
| `route-to-review` | YES (`recordEmployerReviewRouting`) | YES |
| `confirm-start` | YES (inline in route handler) | YES |
| `share-packet` | **NO** — standalone `prisma.auditEvent.create` | n/a (audit IS the only persisted row) |

Plus: `packet` (GET, but writes audit) — `prisma.auditEvent.create` standalone; no mutation row to be atomic with.

**Implication:** the constitutional "every mutation atomic with audit" rule (`MUTATION_GATE_SEQUENCE.md` §4 + `w2-pr2b-audit-coupling.md` §1.1) is satisfied for accept/refresh/routing/confirm-start. For `share-packet` and `packet`, the audit IS the persisted record (the share-token is reconstructed by audit lookup on resolve), so atomicity-with-mutation is vacuous — but the corollary "transaction failure rolls back the side effects" does NOT hold: a successful audit write followed by a failed response write leaves a half-committed share record. This is a known weakness flagged for §3.4.

### 2.6 Idempotency on `accept` is query-then-create (race-prone)

Lines 175–185 of the backend route check for an existing ACCEPTED row before inserting. The check and the insert are NOT in the same `$transaction`. Two concurrent accept requests for the same `(employerId, clinicianNpi)` pair can both pass the check and both insert. There is no UNIQUE constraint on `(employerId, clinicianNpi, status)` to backstop the race.

**Implication:** the W2-PR2B regression suite's `accept` tests must include a concurrency case, OR the lock must require a UNIQUE constraint to be added (which is a schema migration — currently forbidden).

### 2.7 `confirm-start` fallback to most-recent ACCEPTED is implicit ownership

Lines 829–839: when the request body omits `acceptanceId`, the handler picks the most recent `ACCEPTED` row for `(employerId, clinicianNpi)`. The implicit assumption: "the actor's most recent acceptance is the one they intend to start." This holds for single-actor flows; it breaks if a clinician has been accepted by multiple employers (each `employerId` scoped) and `confirm-start` is replayed without `acceptanceId`.

The race window: same actor concurrently calling `confirm-start` twice on the same NPI without `acceptanceId` — both calls find the same acceptance, both insert `StartAttestation` rows referencing it. UNIQUE on `StartAttestation.acceptanceId` would prevent it; the schema (line 3661) has only `@@index([acceptanceId])`, not UNIQUE.

**Implication:** flagged in `w2-pr2b-mutation-branch-map.md` §confirm-start as a race-condition risk.

### 2.8 `route-to-review` HITL fallback is silent

Lines 930–947: the `hITLReviewItem.create` call is wrapped in try/catch. On any error (model missing in this Prisma client, constraint violation, etc.) the handler silently sets `reviewItemId = null` and continues. The mutation persists to the outbox event but **not** to the review queue. A SOC analyst querying "all routed-to-review items" against `HITLReviewItem` misses these. The audit row records `reviewItemCreated: false` so forensics is preserved, but operational behavior degrades silently.

**Implication:** flagged in `w2-pr2b-side-effect-inventory.md` as a partial-failure pattern.

### 2.9 SEAL + learning + recompute side effects are fire-and-forget OUTSIDE the transaction

Every mutating handler launches one or more `void`-discarded Promises after the `$transaction` commits:

- `captureEmployerDecision` (SEAL — full trust snapshot capture)
- `captureDecisionSignal` (learning capture)
- `recomputeMatchBoosts` (boost recomputation, accept + route-to-review)
- `captureStartOutcome` (confirm-start only, in a `.catch` handler)

A failure in any of these does NOT roll back the mutation or audit. The result is an eventually-consistent learning graph; failures are logged but not surfaced to the actor or the audit row.

**Implication:** this is the correct pattern (mutations should not depend on observability writes), but the audit row does NOT mark which side effects have completed. Any post-hoc reconciliation that depends on `captureEmployerDecision` having completed is racy.

### 2.10 `view` lives in `pilotKpi.ts`, not `employerActions.ts`

The web route's `view` action proxies to a backend handler in `apps/api/backend/src/routes/pilotKpi.ts` (lines 128–182), not in `employerActions.ts`. The handler is fire-and-forget telemetry capture (`captureAdvisoryEvent`); it does NOT write an audit row, does NOT write a mutation row, does NOT require the `x-clerk-user-id` header, and returns 202 always.

**Implication:** `view` is mis-classified by the web `[action]` route's `PUBLIC_MUTATION_ACTIONS` set — the verb is technically a mutation (it produces a learning event), but the persistence shape is closer to a fire-and-forget telemetry POST. The lock §3 reclassification of `view` to `AUTHENTICATED_READ_ACTIONS` would change the wire (today returns 202 anonymously) and would break clients that POST `view` without auth. Reclassification needs a deprecation window.

---

## 3. Implicit ownership assumptions (the audit's findings list)

| # | Assumption | Where today | Risk if false |
|---|---|---|---|
| O1 | `requireClerkUserId` returns the acting user's Clerk ID, and that ID maps 1:1 to "the employer" | backend `requireClerkUserId` line 55 | A user who belongs to multiple employer orgs has no way to disambiguate; the row is attributed to "Clerk userId" not "org" |
| O2 | An `EmployerAcceptance` row's `employerId` (= Clerk userId) is sufficient ownership scope for "this employer's accept history" | `recordEmployerReviewAcceptance` line 742; `loadEmployerAcceptanceHistory` (sibling) | A user whose Clerk ID is rotated or whose org membership changes loses access to their acceptances; data is per-user, not per-org |
| O3 | The `organization String` column on `EmployerAcceptance` is descriptive metadata, not enforcement | line 1624 schema | A handler that filters by `organization === userInput.org` would be vulnerable to forgery; today no handler does, but a future one might |
| O4 | `confirm-start` finding "the most recent ACCEPTED row for this `(employerId, clinicianNpi)` pair" is the correct one to start | line 833 | If acceptance was issued via a different actor in the same org, `confirm-start` cannot reach it (per-user scope, not per-org scope) |
| O5 | The web layer is the only origin that can reach the backend (so trusting `x-clerk-user-id` is safe) | implicit deployment topology | If the backend is exposed beyond the web proxy, the trust boundary collapses |
| O6 | Cross-tenant probing of `entityId` is mitigated by the entity not being directly addressable from outside the actor's session (i.e., they have to know the UUID) | implicit | A leaked or guessed UUID returns the resource without an ownership check; today the backend handlers do NOT compare any tenant of the actor to any tenant of the resource |
| O7 | `share-token` strings are unguessable enough to be authorization-grade for downstream public reads | `applyShareService.buildShareToken` | If the token PRNG is weak or short, the share resolver becomes an enumeration surface |
| O8 | Audit writes are durable enough to be the "source of truth" for share-token lookup (since `share-packet` stores nothing except the audit row) | line 746 — `prisma.auditEvent.findFirst` against `shareTokenHash` in metadata | If audit retention shortens or audit rows are GC'd, share-token resolution silently breaks |
| O9 | The fire-and-forget `captureEmployerDecision` will land before any downstream consumer reads the trust state | `void` discard at line 237 | A downstream consumer that reads "the latest decision" within milliseconds of the mutation may see stale state |
| O10 | `EMPLOYER_REVIEW_REFRESH_REQUESTED` audit rows are the canonical list of refresh requests; counting them by `(npi, lookback=30d)` is the right query for "is there a pending request" | line 951 — sibling refresh-requests endpoint | Audit rows are not idempotent (no UNIQUE on `(employerId, clinicianNpi, sameDay)`); a retry storm inflates the count |

These are the assumptions a future ownership-enforcement wave must either preserve or explicitly retire.

---

## 4. Branch-specific workflow rules

Per `w2-pr2b-workflow-transition-map.md`, the per-branch state-machine rules observed today:

| Branch | Required predicate | Source of predicate |
|---|---|---|
| `accept` | `passport.decisionPosture.status !== 'BLOCKED'` AND no existing `(employerId, clinicianNpi, status='ACCEPTED')` row | `buildPassport` + Prisma query (lines 191–186) |
| `confirm-start` | acceptance row exists for `(employerId, clinicianNpi)` AND row's clinicianNpi matches the resolved subject | lines 829–846 |
| `request-refresh` | none — every refresh request succeeds (audit-only persistence) | line 319 |
| `route-to-review` | none — every routing succeeds | line 421 |
| `share-packet` | NPI in body matches resolved subject (if body provides it) | line 677 |
| `packet` (GET, audit-writing) | passport must exist for entityId AND vcvEntity must have non-null NPI | lines 569–579 |

**Note:** there is NO state machine on the resource. The "review state" is computed dynamically from the presence of acceptance + start-attestation rows. There are no `reviewState ∈ {recognized, ready_for_acceptance, accepted, ...}` branches as the planning bundle described. The lock + scaffolding docs describe a state machine that doesn't exist yet; W2-PR2B implementation must either (a) introduce one (schema change, forbidden) or (b) reformulate workflow rules in terms of the observed predicates above.

---

## 5. Mutation-before-audit and audit-after-mutation patterns

| Handler | Pattern | Atomic? |
|---|---|---|
| `accept` (via `recordEmployerReviewAcceptance`) | mutation → outbox → audit, all in `$transaction` | YES |
| `request-refresh` (via `recordEmployerReviewRefreshRequest`) | outbox → audit (no separate mutation row), all in `$transaction` | YES (outbox is the mutation) |
| `route-to-review` (via `recordEmployerReviewRouting`) | HITL (optional) → outbox → audit, all in `$transaction` | YES |
| `confirm-start` (inline in route handler) | StartAttestation → audit, in `$transaction` | YES |
| `share-packet` (inline) | audit standalone (no mutation row) | n/a |
| `packet` (GET, inline) | audit standalone (export side effect; no DB mutation) | n/a |

No mutation-before-audit anti-pattern (where the mutation commits before the audit attempt). No audit-after-mutation outside of transaction (where the audit could miss while the mutation persists). The platform's existing pattern is sound for the four atomic handlers; the two non-transactional cases are inherently audit-only and have no mutation to roll back.

---

## 6. Stale-state, replay, race, and transaction-boundary risks

### 6.1 Stale-state risks

| Risk | Where | Severity |
|---|---|---|
| Trust snapshot captured before transaction can race a concurrent ingest write that updates the underlying source state | `buildDecisionTrustSnapshot` line 727 (called before `$transaction`) | LOW — the snapshot is intentionally point-in-time; staleness is a feature, not a bug |
| `passport.decisionPosture` read at line 191 is not within the same `$transaction` as the acceptance write | the gap between line 191 and line 738 | MEDIUM — a passport that becomes BLOCKED between the check and the write would still allow the accept to commit |
| Acceptance lookup at line 175 is not within the `$transaction` — concurrent accept can race the duplicate check | TOCTOU on `accept` | MEDIUM (see §2.6) |

### 6.2 Replay risks

| Risk | Where | Severity |
|---|---|---|
| `accept` has no idempotency key on the request — a retried POST after a network blip can succeed twice if the first commit hasn't yet shown up in the duplicate check | every accept call | MEDIUM (mitigated only by the duplicate-check query) |
| `request-refresh` has no idempotency key — a retried POST writes a duplicate audit row | every refresh call | MEDIUM (audit-only persistence; bloat, not state corruption) |
| `route-to-review` similarly has no idempotency | every routing call | MEDIUM |
| `confirm-start` without `acceptanceId` finds the same row twice on retry | line 833 | HIGH — duplicate `StartAttestation` rows for one acceptance |
| `share-packet` retry produces a NEW share token — the prior one remains valid until expiry | line 683 | MEDIUM — share-link proliferation; bounded by SHARE_TOKEN_TTL_MS |

### 6.3 Race conditions

| Race | Impact |
|---|---|
| Concurrent `accept` for the same `(employerId, clinicianNpi)` | Two ACCEPTED rows; downstream consumers see ambiguity |
| Concurrent `confirm-start` without `acceptanceId` | Two `StartAttestation` rows for one acceptance |
| `accept` racing a passport-source ingest that flips BLOCKED→OK or OK→BLOCKED | Decision-time predicate doesn't match the persisted state |
| `route-to-review` racing the HITL queue's eventual existence | Whether the review item is created depends on whether the model exists at request time |

### 6.4 Transaction-boundary weaknesses

| Weakness | Severity |
|---|---|
| `buildPassport` (line 191) is OUTSIDE the `$transaction` | MEDIUM |
| `existing` accept lookup (line 175) is OUTSIDE the `$transaction` | MEDIUM |
| All SEAL captures + learning captures + recompute jobs are OUTSIDE the `$transaction` | LOW (intentional fire-and-forget) |
| `share-packet` audit write is NOT in a `$transaction` (would be vacuous, but still — failure between audit write and response means the caller never sees the share URL even though the share record persists) | LOW |
| `packet` audit write is NOT in a `$transaction` (similar — caller may never receive the packet bytes despite the audit row existing) | LOW |

---

## 7. Mutation branches sharing authorization logic incorrectly

Today, **all** mutating handlers in this surface share the same auth-derivation: `requireClerkUserId(req)` reads the `x-clerk-user-id` header. There is no per-action role gate, no per-action ownership gate, no per-action workflow gate at the auth layer. They share auth correctly insofar as they all rely on the same lone primitive — but that primitive is too thin to be the authorization frontier.

The web layer adds a Clerk-session check (`auth()` line 362) for actions in `AUTHENTICATED_MUTATION_ACTIONS`, plus action-allowlist + body validation. **All five mutating actions share the same web-layer auth check.** This is correct sharing.

Where the lock §3 wants per-role-threshold differentiation (`accept` / `confirm-start` → admin+; `request-refresh` / `route-to-review` / `share-packet` → member+), neither layer enforces it today. The role gradient is not load-bearing on the runtime.

**Implication:** introducing differentiated role gates in W2-PR2B is a NEW behavior, not a hardening of an existing one. The wave's risk surface is therefore higher than "add ownership to existing per-action role enforcement." It is "introduce per-action role enforcement AND ownership AND workflow gates simultaneously." The lock can be modified to phase these (PR2B-i: ownership only; PR2B-ii: role differentiation; PR2B-iii: workflow gates) if the founder prefers.

---

## 8. Mutation Branch Criticality Table

Each mutation branch is classified by combined risk: tenant-boundary risk × workflow-state impact × audit sensitivity × replay sensitivity × mutation blast radius.

| Branch | Tenant-boundary risk | Workflow-state impact | Audit sensitivity | Replay sensitivity | Blast radius | **Criticality** |
|---|---|---|---|---|---|---|
| `accept` (POST) | **HIGH** — creates `EmployerAcceptance` row attributable to actor's employerId; cross-actor / cross-org probing today returns the resource without ownership compare | **HIGH** — establishes head-start; gates `confirm-start` | **HIGH** — `EMPLOYER_REVIEW_ACCEPTED` is one of 5 canonical non-repudiation events | **MEDIUM** — TOCTOU on duplicate check | **HIGH** — downstream SEAL captures, recompute jobs, decision graph | **CRITICAL** |
| `confirm-start` (POST) | **HIGH** — creates `StartAttestation` referencing acceptance; cross-actor wrong-employer scenario could attest a start owned by another org | **CRITICAL** — `START_ATTESTED` is the canonical wedge-proof event; closes the trust loop | **CRITICAL** — paired audit row is canonical non-repudiation | **HIGH** — fallback-to-most-recent allows duplicate StartAttestation rows | **HIGH** — fires KPI funnel capture | **CRITICAL** |
| `request-refresh` (POST) | **MEDIUM** — audit-only persistence; data exposure is `npi_prefix`; wrong-tenant attribution possible in metadata | **LOW** — does not transition state; clinician-facing | **MEDIUM** — bloat from replay; no duplicate suppression | **MEDIUM** — multiple identical audit rows from retry | **MEDIUM** — clinician notification dispatch (out of scope but referenced) | **HIGH** |
| `route-to-review` (POST) | **MEDIUM** — creates HITL queue item attributable to employer; wrong-tenant routing possible | **MEDIUM** — moves work to manual review queue | **MEDIUM** — `EMPLOYER_REVIEW_ROUTED_TO_REVIEW` audit row | **MEDIUM** — multiple identical audit rows from retry | **MEDIUM** — fires SEAL capture + boost recompute | **HIGH** |
| `share-packet` (POST) | **HIGH** — issues a 128-bit token unconditionally bound to (entityId, employerId); cross-tenant share-link issuance possible | **MEDIUM** — does not transition canonical state but produces a public-read authorization artifact | **HIGH** — audit row IS the persistent share record; if audit GC'd, share resolution breaks | **MEDIUM** — duplicate tokens accumulate (each valid until expiry) | **HIGH** — every issued token expands the public-read surface for SHARE_TOKEN_TTL_MS | **CRITICAL** |
| `view` (POST — `pilotKpi.ts`) | **LOW** — telemetry only; no persistence (advisory event capture) | **NONE** | **NONE** — no audit row written | **LOW** — duplicate telemetry events; no state change | **LOW** | **LOW** |
| `acceptance-history` (GET) | **MEDIUM** — leaks acceptances across tenants if probed (today: scoped to subject NPI, no actor-tenant filter) | **NONE** — read | **LOW** — no audit on read | **NONE** | **LOW** | **MEDIUM** |
| `status` (GET) | **MEDIUM** — leaks review status; no actor-tenant filter | **NONE** — read | **LOW** — no audit on read; emits learning telemetry | **NONE** | **LOW** | **MEDIUM** |
| `packet` (GET — audit-writing) | **HIGH** — exports full evidence packet; cross-tenant export possible if entityId leaked | **NONE** — read but writes `ARTIFACT_EXPORTED` audit | **HIGH** — every export is a non-repudiation event | **MEDIUM** — duplicate exports inflate audit volume | **HIGH** — bytes leave the perimeter | **CRITICAL** |
| `refresh-requests` (GET — sibling route, NPI-keyed) | **LOW** — explicitly designed for unauthenticated read; "NPI is already public; the response contains no PII beyond count" | **NONE** | **NONE** | **NONE** | **LOW** | **LOW** |

### 8.1 Criticality criteria recap

- **LOW** — telemetry-only or designed-public; no enforcement gap in v1; no enforcement target in W2-PR2B.
- **MEDIUM** — leaks across tenants possible; non-canonical event; W2-PR2B should add ownership but workflow + role gates are nice-to-have.
- **HIGH** — leaks across tenants possible AND state-transition or share-link-issuance; W2-PR2B MUST add ownership + role gates; workflow gates desirable.
- **CRITICAL** — canonical non-repudiation OR cross-tenant exposure of high-blast-radius artifact (acceptance, start-attestation, evidence packet, share token); W2-PR2B MUST add ownership + role gates + workflow gates + atomic audit coupling.

### 8.2 Wave-prioritization implication

The 4 CRITICAL branches (`accept`, `confirm-start`, `share-packet`, `packet`) are the highest priority for W2-PR2B. The 3 HIGH branches (`request-refresh`, `route-to-review`, `acceptance-history`) follow in the same wave. The 2 MEDIUM branches and 2 LOW branches can be deferred to a follow-up if the wave's blast radius needs to be capped.

If the wave is split, the recommended cut is:

- **W2-PR2B-i** (CRITICAL only, 4 branches): `accept`, `confirm-start`, `share-packet`, `packet`
- **W2-PR2B-ii** (HIGH + MEDIUM, 5 branches): `request-refresh`, `route-to-review`, `acceptance-history`, `status`, `view`
- **deferred** (LOW): `refresh-requests` GET (intentionally public)

---

## 9. Recommendations for the W2-PR2B implementation lock

The audit surfaces deltas the lock has not yet absorbed. These recommendations preserve the lock's intent (make ownership enforcement load-bearing for employer-review) while reflecting reality.

| # | Recommendation | Reason |
|---|---|---|
| R1 | **Move enforcement to the backend** OR **add `org_id` propagation from web to backend** before the wave can land | §2.3 — web layer cannot enforce ownership without DB access; backend cannot enforce without `org_id` |
| R2 | **Add `tenantId UUID` to `EmployerAcceptance`, `StartAttestation`, `HITLReviewItem`** via schema migration — OR **redefine ownership in terms of `(actor.org, employerId.org_membership_at_decision_time)`** | §2.1 — no current `tenantId` column on the relevant tables; lock cannot use the lookup it described |
| R3 | **Lift the lock's "no schema migrations" forbid OR explicitly defer ownership enforcement until W2-PR2C** which does the schema migration first | §2.1, §2.2 — without schema, ownership is approximate at best |
| R4 | **Expand the lock's allowed-files list** to include the backend route handler (`apps/api/backend/src/routes/employerActions.ts`), the service functions (`apps/api/backend/src/services/entity/employerReviewActions.ts`), and the `view` handler in `pilotKpi.ts` | §2.4, §2.10 — these are the actual mutation surface |
| R5 | **Introduce per-action role gates as a new behavior** — flagged with founder approval per `SECURITY_INVARIANTS.md` §7.1, separate from ownership work | §7 — the role gradient is not load-bearing today; introducing it AND ownership simultaneously raises wave risk |
| R6 | **Either retire `share-packet`'s audit-as-persistence pattern (introduce a `ShareToken` model)** OR **explicitly accept the "audit IS the record" pattern in the lock** | §2.5, §6.4 — the constitutional doc's atomicity rule is silent on this case |
| R7 | **Add UNIQUE constraints on `EmployerAcceptance(employerId, clinicianNpi, status='ACCEPTED')` partial index AND `StartAttestation(acceptanceId)`** (schema migration) to backstop race-prone idempotency | §2.6, §2.7 |
| R8 | **Enumerate observed deltas O1–O10 in the lock's "Known assumptions to retire" section** (currently absent) | §3 — undocumented assumptions are the substrate of regression |
| R9 | **Reclassify `view` carefully** — its current 202-anonymous behavior may be load-bearing for clients that POST it without auth | §2.10 |
| R10 | **Phase the wave** per §8.2 if blast radius needs to be capped, OR proceed all-at-once with explicit founder acknowledgment of the 9-branch surface | §8 |

These recommendations are surfaced for founder + Codex review BEFORE the implementation PR opens. The lock should be amended (via a separate `w2-pr2b-implementation-lock-v2.md` doc) before code lands.

---

## 10. Closing principle

The audited runtime mutation surface for employer-review is shaped by three realities the planning bundle did not fully capture:

1. **The web route is a thin auth-checking proxy, not a DB writer.**
2. **The backend trusts the web proxy's `x-clerk-user-id` header and has no per-tenant authorization context.**
3. **There is no `EmployerReview` model and no `tenantId` column on the relevant tables.**

The implication is not that ownership enforcement is impossible — it is that ownership enforcement requires either a schema change (forbidden by the current lock), a propagation change (web → backend `org_id` carriage), or a re-scoping of "tenant" to mean "Clerk userId" in v1 with a follow-up to "real org tenancy" in v2.

**The audit is the contract that ensures W2-PR2B's implementation reflects what the system actually does — not what the planning bundle hoped it did.** The lock and scaffolding bundle remain authoritative on the *intent* of the wave. This audit is authoritative on the *substrate* the wave operates on. Both must align before the implementation PR opens.
