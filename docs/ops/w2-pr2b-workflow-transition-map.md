# W2-PR2B — Workflow Transition Map

**Wave:** Wave 2, PR 2B — runtime audit, workflow transition map · **Date:** 2026-05-08 · **Status:** audit only; **NO product code, NO runtime modification, NO merge** · **Scope:** the implicit workflow state machine implied by the persistence shape of `/api/employer-review/**` mutations · **Authority:** companion to `w2-pr2b-runtime-mutation-audit.md`, `w2-pr2b-mutation-branch-map.md`, and `MASTER_PROMPT.md` §3 (canonical 5-step path)

This doc maps the workflow state transitions induced by each mutation branch — explicit AND implicit. It is the corrective for `w2-pr2-mutation-semantics.md` §4 and `w2-pr2b-mutation-flow.md` §5, both of which described `reviewState ∈ {recognized, ready_for_acceptance, accepted, ...}` predicates that **do not exist** as enforced state on any Prisma model today.

The audit's central finding here: **there is no `reviewState` field on any model.** The "review state" is a derivable function of which rows exist, not a persisted enum. This changes how W2-PR2B must reformulate workflow gates.

---

## 1. The canonical 5-step path (per `MASTER_PROMPT.md` §3)

The platform doctrine names a canonical sequence:

```
Recognition → Acceptance → Start → (steps 4 + 5 — out of W2-PR2B scope)
```

Each step has an associated mutation event that constitutes "the actor crossed this gate." Today's persistence shape:

| Step | Persisted as | Source of truth |
|---|---|---|
| **Recognition** | `vcvEntity` row exists with non-null NPI; `passport.decisionPosture` is buildable | `apps/api/backend/src/services/passport/buildPassport.ts` (read shape only — no explicit "recognition mutation" exists) |
| **Acceptance** | `EmployerAcceptance` row exists with `status='ACCEPTED'` for `(employerId, clinicianNpi)` | `apps/api/backend/src/services/entity/employerReviewActions.ts:738` (`recordEmployerReviewAcceptance`) |
| **Start** | `StartAttestation` row exists referencing the acceptance | `apps/api/backend/src/routes/employerActions.ts:863` (`confirm-start` inline tx) |

All other "workflow states" (recognized, ready_for_acceptance, ready_for_start, accepted, archived, etc.) referenced in the planning bundle are **conceptual descriptors**, not enforced enums. The state machine is implicit and derivable.

---

## 2. State derivation from observed rows

For a given `(entityId, employerId, clinicianNpi)` tuple, "the state" is computed:

```
let recognized        = (vcvEntity exists with non-null NPI) AND (passport buildable)
let blocked           = recognized AND (passport.decisionPosture.status === 'BLOCKED')
let ready_for_accept  = recognized AND NOT blocked
let accepted          = exists EmployerAcceptance(employerId, clinicianNpi, status='ACCEPTED')
let ready_for_start   = accepted AND NOT exists StartAttestation(acceptanceId = the_acceptance)
let started           = accepted AND exists StartAttestation(acceptanceId = the_acceptance)
let routed_for_review = exists outbox event of type EMPLOYER_REVIEW_ROUTED_TO_REVIEW for entity (within window)
                        OR exists HITLReviewItem for entity (if model present)
let refresh_pending   = exists EMPLOYER_REVIEW_REFRESH_REQUESTED audit row in last 30 days for clinicianNpi
let shared            = exists EMPLOYER_PACKET_SHARED audit row for entityId (token may be expired)
```

These derivations are NOT atomic with each other. A read that observes `accepted=true` may observe `started=false` even though a concurrent `confirm-start` is mid-transaction.

---

## 3. Per-branch state effects

### 3.1 `accept`

| Aspect | Behavior |
|---|---|
| **Pre-state required** | `recognized AND NOT blocked` (passport.decisionPosture !== 'BLOCKED'); `NOT accepted` for this `(employerId, clinicianNpi)` pair |
| **Pre-state checked at runtime?** | YES — passport check at line 191; duplicate check at line 175 |
| **Persisted change** | INSERT `EmployerAcceptance(status='ACCEPTED')` |
| **State effect** | `accepted` flips false → true for `(employerId, clinicianNpi)` |
| **Side state effect** | `ready_for_start` becomes true (no StartAttestation yet) |
| **Race window** | Between line 175 (read) and line 738 (insert in tx) — concurrent accept can insert a second ACCEPTED row |
| **Reverse / archive** | None — `EmployerAcceptance` has no archive/expire mutation in this surface |

**Workflow rule the lock SHOULD encode:** "Permit only if the actor's pre-state is `(recognized AND NOT blocked AND NOT accepted)` for the (actor, subject) pair. Reject otherwise with 409 if `already_accepted`, 422 if `blocked`, 404 if `NOT recognized`."

### 3.2 `confirm-start`

| Aspect | Behavior |
|---|---|
| **Pre-state required** | `accepted` for the (employerId, clinicianNpi) pair (per the `findFirst` at line 829) |
| **Pre-state checked at runtime?** | YES — acceptance lookup; throws 409 if missing (line 841) |
| **Persisted change** | INSERT `StartAttestation(acceptanceId)` + paired AuditEvent |
| **State effect** | `started` flips false → true for the acceptance |
| **Race window** | Body `acceptanceId` not specified → "most recent ACCEPTED" lookup at line 833; concurrent confirm-start can find the same row |
| **Reverse / archive** | None |

**Workflow rule the lock SHOULD encode:** "Permit only if the actor's pre-state is `accepted` for the (actor, subject) pair AND `NOT started` for the chosen acceptance. Reject otherwise with 409 if `no_prior_acceptance`."

The "wrong_review_state" path described in the planning bundle (rejecting based on `reviewState ∈ {accepted, ready_for_start}`) does NOT exist; the runtime predicate is "does an ACCEPTED EmployerAcceptance row exist for this (employer, clinician) pair." There's no enum to check.

### 3.3 `request-refresh`

| Aspect | Behavior |
|---|---|
| **Pre-state required** | NONE today — every refresh request succeeds |
| **Pre-state checked at runtime?** | NO |
| **Persisted change** | INSERT outbox event + paired AuditEvent (audit-only persistence; no separate mutation row) |
| **State effect** | `refresh_pending` flips false → true for clinicianNpi (within 30-day window) |
| **Race window** | None on this branch (audit-only insertion is straightforward) |
| **Reverse / archive** | Implicit — pending state expires after 30 days because the GET predicate uses a rolling window |

**Workflow rule the lock SHOULD encode:** "Permit if `(recognized OR previously-recognized)` AND no open refresh in last N hours (idempotency anchor). Reject 409 with `duplicate_refresh_request` if open." This requires a new predicate: "open refresh in last N hours" is the count from the GET endpoint at line 943.

### 3.4 `route-to-review`

| Aspect | Behavior |
|---|---|
| **Pre-state required** | NONE today |
| **Pre-state checked at runtime?** | NO |
| **Persisted change** | (Optional) INSERT `HITLReviewItem(status='PENDING')` + INSERT outbox event + INSERT AuditEvent |
| **State effect** | `routed_for_review` flips false → true |
| **Race window** | HITL try/catch silently degrades; race between the optional HITL insert and the outbox/audit inserts is contained within tx |
| **Reverse / archive** | None — HITL items mutate only via the HITL queue's own (out-of-scope) flow |

**Workflow rule the lock SHOULD encode:** "Permit if `recognized`. Reject if `archived`. Reject if `already routed for review` in last N hours (idempotency anchor — the 'no duplicate routing' predicate is not enforced today; introducing it is a behavior change)."

### 3.5 `share-packet`

| Aspect | Behavior |
|---|---|
| **Pre-state required** | `recognized` (subject lookup must succeed at line 668) |
| **Pre-state checked at runtime?** | Partial — subject existence checked, but no archive/active state |
| **Persisted change** | INSERT AuditEvent (no separate mutation row); audit IS the share record |
| **State effect** | `shared` becomes true; share-token bound to `(entityId, clinicianNpi)`, valid for `SHARE_TOKEN_TTL_MS` |
| **Race window** | None on the persistence path (single audit insert) |
| **Reverse / archive** | None — share tokens expire on their own; no revocation mutation exists |

**Workflow rule the lock SHOULD encode:** "Permit if `recognized` AND `NOT archived`. Each share-packet creates a new token (no idempotency); old tokens remain valid until expiry."

### 3.6 `view` (B6)

| Aspect | Behavior |
|---|---|
| **Pre-state required** | NONE — anonymous |
| **Persisted change** | NONE |
| **State effect** | NONE on canonical state; emits an advisory event that informs pilot KPIs |

### 3.7 `packet` (B7 — audit-emitting GET)

| Aspect | Behavior |
|---|---|
| **Pre-state required** | `recognized` (passport must build; vcvEntity must have NPI) |
| **Persisted change** | INSERT AuditEvent (`ARTIFACT_EXPORTED`) |
| **State effect** | None on canonical state; produces an export receipt |

---

## 4. The canonical-path constraint

The doctrine asserts (per `MASTER_PROMPT.md` §3): a clinician cannot Start without prior Acceptance, and cannot be Accepted without prior Recognition. The runtime enforces this via `confirm-start`'s acceptance lookup (B2) and `accept`'s passport-blocked check (B1, indirect — passport implies recognition).

**Per-actor scope:** the canonical path is enforced PER (employerId, clinicianNpi) pair, NOT PER (org, clinician). This means:

- Two users in the same org each have to independently accept and confirm-start the same clinician.
- A user in Org A and a user in Org B can both accept and confirm-start the same clinician, producing parallel Acceptance and StartAttestation chains.
- An archive/withdrawal mutation does not exist; once Accepted, a `(employerId, clinicianNpi)` pair stays accepted until either the schema changes or a future wave introduces a withdrawal mutation.

Per-actor scope is the v1 reality. If W2-PR2B introduces per-org ownership, the scope rules become:

- The canonical path is enforced PER (org, clinician) pair (the new identity).
- Cross-actor within the same org sees each other's acceptances.
- Cross-org no longer sees each other's acceptances.

This is a **semantic shift**, not just a hardening. It must be planned for explicitly.

---

## 5. Workflow predicates that do NOT exist today

The planning bundle and lock referenced the following predicates as if enforced. The audit confirms none of them is:

| Predicate | Status | Recommended runtime substitute |
|---|---|---|
| `reviewState ∈ {recognized, ready_for_acceptance}` | NO STATE FIELD | Substitute: `passport.decisionPosture.status !== 'BLOCKED'` |
| `reviewState ∈ {accepted, ready_for_start}` | NO STATE FIELD | Substitute: "EmployerAcceptance row exists for this (actor, clinician) pair" |
| `reviewState !== 'archived'` | NO STATE FIELD; nothing is ever archived | Substitute: presume always `not archived` until an archive mutation exists |
| `reviewState ∈ allowed-routable-states` per `employmentGuards.ts` | THE FILE EXISTS BUT THE CHECK IS INTRA-DOMAIN, NOT HANDLER-LEVEL | Substitute: "subject is recognized AND no recent routing within idempotency window" |
| `clinician.crs ≥ 80` | TRUE — the closest existing predicate | But the runtime check is `passport.decisionPosture.status !== 'BLOCKED'`, not a CRS≥80 numeric gate |
| `prior EmployerAcceptance.tenantId === requestingTenantId` | NO `tenantId` COLUMN | Substitute: `acceptance.employerId === requireClerkUserId(req)` (per-actor scope) — which is what `confirm-start` already does |
| `no open RefreshRequest within 24h` | NO CHECK TODAY | Substitute: count of `EMPLOYER_REVIEW_REFRESH_REQUESTED` audit rows for clinicianNpi in last N hours; require 0 |

---

## 6. Workflow rule reformulation (recommended for the W2-PR2B lock v2)

Given the audit's findings, the lock should reformulate workflow rules to operate on the OBSERVED predicates rather than fictional ones. Recommended formulation:

| Action | Recommended runtime predicate |
|---|---|
| `accept` | `vcvEntity exists` AND `passport.decisionPosture.status !== 'BLOCKED'` AND `NOT exists EmployerAcceptance(employerId, clinicianNpi, status='ACCEPTED')` |
| `confirm-start` | `exists EmployerAcceptance(employerId, clinicianNpi, status='ACCEPTED')` AND `NOT exists StartAttestation(acceptanceId = it)` |
| `request-refresh` | `vcvEntity exists` AND `count(EMPLOYER_REVIEW_REFRESH_REQUESTED in last 24h for clinicianNpi) === 0` (idempotency anchor — NEW behavior) |
| `route-to-review` | `vcvEntity exists` AND `count(EMPLOYER_REVIEW_ROUTED_TO_REVIEW in last 24h for entityId) === 0` (idempotency anchor — NEW behavior) |
| `share-packet` | `vcvEntity exists` (no idempotency anchor — token always fresh) |

The "NEW behavior" annotations are the predicates that, if introduced, change runtime behavior. The wave brief explicitly forbids this audit from modifying runtime; these are RECOMMENDATIONS for the lock v2, not mandates.

---

## 7. Cross-branch transition matrix

The state-derivation function from §2 implies these cross-branch transitions:

| If state is | Then the branch can be | Behaviorally |
|---|---|---|
| `NOT recognized` | none of the mutating branches succeed | 404 from subject lookup |
| `recognized AND blocked` | only `share-packet` (today) | `accept` → 422 acceptance_blocked; others succeed (no gate) |
| `recognized AND NOT blocked AND NOT accepted` | `accept` (will succeed); `request-refresh` (will succeed); `route-to-review` (will succeed); `share-packet` (will succeed); `view` (always succeeds) | this is the "ready_for_acceptance" approximation |
| `accepted AND NOT started` | `confirm-start` (will succeed); `share-packet` (will succeed); `request-refresh` (will succeed); `route-to-review` (will succeed) | this is the "ready_for_start" approximation |
| `accepted AND started` | all branches still succeed (no terminal-state guard) | this is "the canonical path completed for this (actor, clinician)" |

**The matrix shows the WAVE'S potential behavior change**: if the lock introduces a "no operation after canonical-path completion" predicate, that's a NEW behavior. Today the runtime is permissive — once started, you can still re-route, request a refresh, share a packet. None of these are nonsensical.

---

## 8. Observability of state in the audit log

The audit log is the only durable representation of state transitions. For a (entityId, clinicianNpi) pair, querying audit rows by `referenceId IN (entityId, acceptanceId)` reveals:

```
audit row (chronological):
  EMPLOYER_REVIEW_ACCEPTED      → state went NOT-accepted → accepted
  EMPLOYER_REVIEW_REFRESH_REQUESTED (×N)
  EMPLOYER_REVIEW_ROUTED_TO_REVIEW (×N)
  EMPLOYER_PACKET_SHARED        (×N)
  ARTIFACT_EXPORTED             (×N)
  START_ATTESTED                → state went accepted → started
```

There is NO archive event, NO withdrawal event, NO state-rollback event. The state machine is monotonic in the forward direction.

This monotonicity is a v1 simplification. A future wave introducing withdrawal/archive must:

1. Add a state-transitioning audit event type.
2. Update the state-derivation function to consider the latest event.
3. Add idempotency keys so duplicate transitions don't corrupt state.

W2-PR2B does NOT need to address this — it's deferred per `AUTHORIZATION_BASELINE_V1.md` §5.

---

## 9. Closing principle

The workflow transition map for the employer-review surface is:

- **Implicit** (states are derivable, not enumerated).
- **Per-actor scoped** (the canonical path is per (employerId, clinicianNpi), not per (org, clinician)).
- **Monotonic forward** (no archive, no withdrawal, no rollback).
- **Loosely gated** (most mutations have no pre-state predicate today; `accept` and `confirm-start` are the exceptions).

W2-PR2B's responsibility, when it introduces ownership enforcement, is NOT to introduce a new state machine. It is to:

1. Tighten the per-action runtime predicates per §6's recommendations (with founder approval — these are NEW behaviors).
2. Reformulate the lock's workflow rules in terms of observed predicates, not fictional `reviewState` enums.
3. Acknowledge the per-actor → per-org scope shift is a *semantic change*, not a hardening.

**The transition map is the v1 reality. The lock + scaffolding bundle's v2 vision must reconcile to it before code lands.**
