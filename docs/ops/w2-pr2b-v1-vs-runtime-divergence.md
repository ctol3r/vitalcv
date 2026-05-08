# W2-PR2B — Lock v1 vs. Runtime Divergence

**Wave:** Wave 2, PR 2B — divergence map · **Date:** 2026-05-08 · **Status:** divergence catalogue only; **NO product code, NO runtime modification, NO merge** · **Authority:** companion to `w2-pr2b-implementation-lock-v2.md`, `w2-pr2b-runtime-topology-reconciliation.md`, `w2-pr2b-runtime-mutation-audit.md`

This doc is a side-by-side audit of Lock v1's claims vs. observed runtime reality. Each row is a specific divergence — what v1 said the wave would do or assumed, vs. what the runtime actually supports — with a verdict and a pointer to where Lock v2 reconciles it.

It exists so that reviewers of Lock v2, founder included, can confirm that every v1 commitment was either preserved, reformulated, or explicitly deferred — and that no v1 commitment was silently weakened.

---

## 1. Divergence catalogue (sorted by criticality)

| # | Aspect | Lock v1 said | Runtime is | Divergence | Verdict | Reconciled at |
|---|---|---|---|---|---|---|
| D1 | Primary ownership comparison | "Compare `EmployerReview.tenantId === JWT.org_id`; cross-tenant returns 404" | No `EmployerReview` model exists; no `tenantId` column on any model | **Comparison cannot be performed** | **Defer** — per-org enforcement deferred to future-migration wave | Lock v2 §1, §5.1 (forbid fake derivation); future-migration §2 |
| D2 | Persistence scope | "Per-org tenant scope" | Per-actor (Clerk userId) scope | **v1 assumed wrong scope axis** | **Reframe** — wave is mutation legitimacy hardening, not ownership authorization | Lock v2 §1, §2; reconciliation §2 |
| D3 | Web-layer helper signature | "`requireOwnedEmployerReview` does Prisma lookup at the web layer" | Web layer has no Prisma access; `[action]/route.ts` is a thin auth-checking proxy | **Helper cannot do DB lookup** | **Reformulate** — helper renamed to `employerReviewLegitimacyGate`, scope is role gate + readonly denial + correlation ID stamping; no DB | Lock v2 §3, reconciliation §3 |
| D4 | Web→backend authorization signal | "JWT-derived `org_id` propagated to backend" | Only `x-clerk-user-id` is propagated today; no `org_id` carriage | **v1 assumed propagation that doesn't exist** | **Partially add** — wave forwards `x-vitalcv-team-role` (NEW) and `x-correlation-id` (NEW); does NOT forward `x-vitalcv-org-id` (deferred) | Lock v2 §3, §10; future-migration §3 |
| D5 | Backend authorization model | "Backend independently verifies JWT, extracts `org_id`, compares to `resource.tenantId`" | Backend trusts `x-clerk-user-id` header; no JWT verification; no `org_id` to extract; no `tenantId` to compare | **v1 assumed backend was JWT-aware** | **Defer** backend JWT verification; codify topology assumption (web proxy is the frontier) | Lock v2 §10; future-migration §3 |
| D6 | Atomicity coverage | "Every mutation atomic with audit in `prisma.$transaction`" | 4 of 5 mutations already atomic; `share-packet` audit standalone; `packet` audit standalone | **Partial — 80% already correct** | **Tighten** — wrap `share-packet` + `packet` audit writes in single-row `prisma.$transaction` for rollback-consistency | Lock v2 §6, §8 |
| D7 | Cross-tenant 404 wire | "Cross-tenant resource access returns 404 (not 403)" | No cross-tenant comparison occurs; 404 is emitted today only on entity-not-found, not tenant-mismatch | **Cannot be enforced** | **Defer** — same as D1 | Future-migration §4 |
| D8 | Helper consumed by exactly 2 web routes | Per Lock v1 §1 row count | Web routes do not need a DB-touching helper; the legitimacy gate is consumed by 2 web routes (preserved) but does different things | **Structurally preserved; semantically reformulated** | **Reformulate** | Lock v2 §3 |
| D9 | Helper signature returns `{ ok, requestingTenantId, actorId, resource }` | Per `w2-pr2-mutation-semantics.md` §5 | No `resource` to return (no DB lookup); no `requestingTenantId` (no org concept) | **Signature is wrong** | **Replace** with `{ ok, actorId, teamRole, correlationId } | { ok: false, response }` | Lock v2 §3 (helper description) |
| D10 | Mutation row tenantId column populated | "EmployerAcceptance.tenantId = requestingTenantId" | No `tenantId` column on EmployerAcceptance | **Column does not exist** | **Defer** | Future-migration §2 |
| D11 | Audit row `tenantId` populated from JWT-derived `requestingTenantId` | Per Lock v1 §5 | `AuditEvent.organizationId String?` is nullable; current code does not populate it on these mutations | **Field exists but unused; org concept deferred** | **Leave NULL** in v1; populate in future-migration | Lock v2 §8; future-migration §2 |
| D12 | Audit row `actorId` populated from JWT `userId` | Per Lock v1 §5 | `AuditEvent` does not have `actorId` as a top-level column; actor is recorded inside `metadata.employerId` | **Column does not exist; metadata pattern is in use** | **Reformulate** — record `actorId` (= clerk userId) in `metadata.actorId` (and preserve existing `metadata.employerId`) | Lock v2 §8 |
| D13 | "Resource missing in DB → 404 + denied audit" | Per `MUTATION_GATE_SEQUENCE.md` §6, audit-coupling §8 | Today entity-not-found returns 404 BUT does NOT write an audit row | **v1 specified a behavior the runtime does not have** | **Add** — denial-path audit row on entity-not-found per Lock v2 §8 | Lock v2 §8, §9 |
| D14 | Workflow gate "review.state ∈ {recognized, ready_for_acceptance}" | Per `w2-pr2b-mutation-flow.md` §5 | No `reviewState` enum field on any model; state is implicit | **Predicate doesn't exist** | **Reformulate** — workflow predicates are reformulated against observed reality (passport-blocked, prior-acceptance-existence, etc.) per workflow-transition-map §6 | Lock v2 §6 (allowed mutation types preserves existing predicates); workflow-transition-map §6 |
| D15 | Confirm-start "prior `EmployerAcceptance.tenantId === requestingTenantId`" | Per Lock v1 §3 | Confirm-start scopes by `(employerId, clinicianNpi)` — per-actor, not per-tenant; cross-actor ownership cannot be checked | **v1 assumed cross-tenant predicate; runtime is per-actor** | **Reformulate** — confirm-start preserves existing `(employerId, clinicianNpi)` scope; deprecates the `acceptanceId`-omitted fallback (race risk) | Lock v2 §6 (`confirm-start` row) |
| D16 | Idempotency anchor on `accept` | "UNIQUE(`entityId`) on EmployerAcceptance" | No UNIQUE constraint exists; current duplicate-check is query-then-create (TOCTOU) | **v1 specified a constraint that doesn't exist** | **Replace anchor** — `correlationId` UNIQUE per `(actorId, 24h)` is the new replay anchor (no schema change); flag adding a partial UNIQUE in future-migration | Lock v2 §6, §7.4; future-migration §6 |
| D17 | Idempotency anchor on `confirm-start` | "UNIQUE(`acceptanceId`) on StartAttestation" | Schema has `@@index([acceptanceId])` but NOT `@@unique` | **v1 specified a constraint that doesn't exist** | **Same as D16** — correlationId is the runtime-feasible anchor | Lock v2 §6, §7.4 |
| D18 | "Workflow gate refusal → 422 with `{ "error": "<gate_name>" }`" | Per `MUTATION_GATE_SEQUENCE.md` §3.5 | Today the `accept` handler returns 422 with `error: 'acceptance_blocked'` (a real gate refusal); other actions don't have this gate today | **Partially present** | **Preserve existing behavior** for accept; do NOT introduce new workflow gates on the other actions in this wave | Lock v2 §6 |
| D19 | "Test cases: 5 actions × 4 ownership scenarios = 20" | Per Lock v1 §7.1 | Cross-tenant scenarios (3 of the 4) cannot be tested without org enforcement | **Test plan over-promises** | **Reduce to 5 actions × 1 (readonly denial) + 5 actions × 1 (permitted permit) = 10**; replace cross-tenant cases with replay-resistance + forbidden-input-discard + header-injection cases | Lock v2 §7 |
| D20 | "Total cases: 31" (Lock v1 §7) / "34 implemented" (mutation-flow §) | n/a | Reformulated test plan totals 28 | **Reduced** test surface | **Acknowledge** — 28 cases for v2 reflects scope reduction; future-migration adds the cross-tenant cases | Lock v2 §7 |
| D21 | Header-injection defense tests check `x-verifier-org` | Per Lock v1 §7.3 | Header `x-verifier-org` is not consulted today by any handler | **Test target doesn't exist** | **Replace with `x-vitalcv-team-role` injection** (the new header v2 introduces); test asserts the helper validates from JWT not from forwarded header | Lock v2 §7.6 |
| D22 | "Founder approval required because cross-tenant exposure" | Per Lock v1 §11 | No cross-tenant exposure in v1 because no per-org compare | **Reframed** | **Founder approval still required** but for different reasons: first-of-kind audit-coupling enforcement on HIGH_RISK domain, deprecation of confirm-start fallback, new headers introduced | Lock v2 §11 |
| D23 | "Codex audit checks for `EmployerReview.tenantId` lookups" | Per Lock v1 §10 | No such lookups can exist | **Audit prompt over-specified** | **Codex prompt updated** to verify (a) no fake org derivation, (b) atomic mutation+audit, (c) defense-in-depth role gate, (d) replay resistance | Lock v2 §14 |
| D24 | Allowed files = 2 web routes + 1 helper + 1 test (4 files) | Per Lock v1 §1 | Persistence is on the backend; web layer is a proxy | **File list incomplete** | **Expand** to include `apps/api/backend/src/routes/employerActions.ts` and `apps/api/backend/src/services/entity/employerReviewActions.ts` (5 product files + 1 test) | Lock v2 §3 |
| D25 | Forbidden files explicitly include `apps/api/backend/prisma/schema.prisma` | Per Lock v1 §2 | Schema unchanged is correct (no migration in v1) | **Preserved** | **Preserved** | Lock v2 §4 |
| D26 | "Cross-row tenant equality on prior acceptance" (`confirm-start`'s prior acceptance check) | Per `w2-pr2b-ownership-derivation.md` §4.2 | Today's check is `acceptance.employerId === requireClerkUserId(req)` — a per-actor check, not cross-tenant | **Per-actor check exists; cross-tenant check doesn't** | **Preserve existing per-actor check;** flag adding cross-tenant in future-migration | Lock v2 §6; future-migration §4 |
| D27 | "share-packet creates ApplyShare row + audit row in tx" | Per `w2-pr2b-audit-coupling.md` §4.5 | Today share-packet writes `auditEvent.create` standalone — no `ApplyShare` row | **`ApplyShare` mutation doesn't exist; audit IS the persistence** | **Wrap audit-only in single-row tx** (rollback consistency); flag introducing `ApplyShare` row in future-migration if a separate model is desired | Lock v2 §6 |
| D28 | "Audit-row `metadata.tokenRef`" | Per `w2-pr2b-audit-coupling.md` §3.9 | Today share-packet stores `shareTokenHash` in audit metadata — already the right shape | **Already present** | **Preserve** | Lock v2 §8 |
| D29 | "Read-action audit posture deferred" | Per `w2-pr2b-audit-coupling.md` §7 | Reads do not write audit rows today (except `packet` which is audit-emitting) | **Aligned** | **Preserve** — reads other than `packet` write no audit | Lock v2 §6 (read actions row) |
| D30 | "Operational consequence: rate-limiting at Layer 1 is OUT OF SCOPE" | Per `w2-pr2b-audit-coupling.md` §10 | No rate-limiting today | **Aligned** | **Preserve** — rate-limiting deferred | Lock v2 §10 (operational invariants) |

---

## 2. Aggregate verdict

| Verdict class | Count | Implication |
|---|---|---|
| **Defer** to future-migration wave | D1, D5, D7, D10, D17 (partial), D26 — 6 items | These require schema migration, JWT verification on backend, and `org_id` propagation. They are real, important, and DO NOT land in v2 |
| **Reformulate** to v2-feasible shape | D2, D3, D8, D9, D12, D14, D15, D16, D19, D21, D22, D23, D24 — 13 items | The intent of v1 is preserved; the mechanism is updated to match runtime |
| **Add** behavior absent today | D6, D13, D27 — 3 items | These ARE new behaviors that v2 introduces (transactional audit on share-packet/packet; denied-audit on entity-not-found) |
| **Preserve** existing behavior unchanged | D11, D18, D25, D28, D29, D30 — 6 items | v1's claim was already aligned; v2 explicitly preserves |
| **Reduce** scope from v1 | D4 (partial — adds 2 of 3 headers; defers org_id), D19, D20 — 2–3 items | Test surface and forwarded headers reduced from v1 |

The aggregate distribution: **6 deferred, 13 reformulated, 3 added, 6 preserved, 2–3 reduced.** Of these:

- **No v1 commitment is silently dropped.** Each item is either preserved, reformulated, added, or explicitly deferred with a follow-up wave assignment.
- **The reductions are honest.** Where v1 promised cross-tenant 404 (a property the runtime cannot enforce), v2 explicitly says so and points to the migration wave.
- **The additions are conservative.** v2 only adds 3 new behaviors, all of which are achievable in actor-scoped runtime and improve mutation hygiene.

---

## 3. Where v1 was useful

Lock v1 was not wrong as a *vision document*. It correctly identified the problems (cross-tenant exposure, replay risk, audit-coupling gaps) and the right shape of the fix (per-action role gates, atomic mutation+audit, idempotency keys). What it got wrong was the *runtime substrate* — it assumed a model and topology that the codebase doesn't have.

Lock v2 inherits v1's vision (per-action role gates, atomic mutation+audit, idempotency keys) and replaces the substrate with the observed reality. The wave that ships per v2 makes real progress on real problems; v1's deferred items become the future-migration wave's mission.

---

## 4. Reviewer's checklist for Lock v2

A reviewer (Codex SAFE, founder, supervisor) confirming Lock v2 verifies:

- [ ] Each of the 6 critical runtime findings (F1–F6) is reflected in v2 — see `w2-pr2b-runtime-topology-reconciliation.md`.
- [ ] Each of the 30 divergences (D1–D30) is reconciled with one of: defer / reformulate / add / preserve / reduce — see this doc §1.
- [ ] No v1 commitment is silently dropped — see this doc §2.
- [ ] The wave classification is honestly named "Mutation Legitimacy Hardening" — see Lock v2 §1.
- [ ] The forbidden-pattern list (Lock v2 §5) explicitly forbids fake org derivation and unsupported heuristics.
- [ ] The future-migration wave (`w2-pr2b-future-org-ownership-migration.md`) is referenced as the home for the deferred items.
- [ ] The 28-case regression suite covers what v2 enforces (legitimacy, replay, atomicity, readonly denial, forbidden-input discard, header injection) and does NOT test cross-tenant 404.

When all 7 checks pass, Lock v2 is mergeable; the implementation PR can open.

---

## 5. Closing principle

A divergence catalogue is the artifact of a wave that learned from its substrate. v1 was authored before the audit; v2 is authored after. The wave's value increases when it ships what the runtime supports rather than what the planning bundle imagined.

**No v1 promise is dropped without a successor home. No v2 commitment is made beyond what the runtime can carry.** The catalogue above is the bridge between the two; reviewers use it to confirm that the wave is honest in both directions.
