# ADR — Head-start acceptance is not credentialing completion

**Status:** Accepted (ACT-1.0) · **Date:** 2026-07-18 · **Baseline:** `origin/main` @ `55cbcd9f2`
**Companion:** [ACT-1 current-state map](../activation/ACT-1-current-state-map.md)

## Context

VitalCV's public promise is *"Find the opportunity. Prove your career once. Start faster."* The front half of that loop is real: a clinician applies with a **sealed, consented `ApplicationPacket`** (sha256 seal, frozen opportunity version, consent receipt — `applicationService.ts:317`). The back half — an employer accepting that proof, the remaining role-specific work closing, and a measurable qualified start — is not yet an application-scoped, replayable loop. Three acceptance/start keyspaces exist but none references the application (see the current-state map).

Building the middle forces a definitional decision, because the single most dangerous thing this feature could do is imply that VitalCV *completed credentialing*. It cannot, and must never claim to.

## Decision

### 1. Acceptance is a scoped head start, never credentialing completion

`head_start_accepted` means exactly: **"this defined, sealed evidence may be reused as a head start for this application, role, organization, and policy version."** It does **not** mean credentialed, cleared, privileged, verified-everywhere, or eligible to begin work. The employer/institution retains every final decision.

Enforcement:
- The word `Verified`, and phrases like "credentialed", "cleared", "instant credentialing", stay banned in activation UI copy (`check-public-claims`, CLAUDE.md truth contract).
- The existing `ApplicationStatus` values `ACCEPTED` / `APPROVED` are **not** repurposed to mean "credentialed" or "start-ready". A new, separate activation phase carries head-start/requirement/start state (see §3).
- Acceptance continues to fail closed when the passport is `BLOCKED` — the live 422 `acceptance_blocked` gate (`employerActions.ts:353`) is preserved, not bypassed.

### 2. Qualified start is an explicit, authorized, event-sourced fact

A clinician is `start_ready` only when: all **required** activation requirements are `met | waived | not_applicable`, no open required manual-review/blocker remains, **and** an authorized employer actor explicitly records the decision. `started` is a separate recorded event. Neither is ever *inferred* from a readiness score, a packet export, an `ACCEPTED` status, or an employer page view. Start events are correctable via a durable audit trail, never silently overwritten.

### 3. The delta is additive and application-scoped

Rather than fork a fourth model, the activation spine hangs off the FKs that already exist (`Application→Opportunity`, `ApplicationPacket→Application`):

- **Link, don't duplicate:** trace an `EmployerAcceptance` to the exact `applicationId` + `packetHash` it accepted (additive nullable columns / thin join — existing entityId/NPI writers unaffected).
- **`ActivationRequirement`** (new table, FK `applicationId`): the per-application requirement ledger that does not exist today. Instantiated only *after* a decision; marks already-accepted evidence so it is never re-requested. Necessity `required|preferred`; status `not_started|requested|submitted|under_review|met|waived|not_applicable|blocked|expired`; owner `clinician|employer|both|system`.
- **Start-ready/started** keyed on `applicationId` via new audit types (`START_READY`, `START_RECORDED`, `START_CANCELLED`) reconciled with — not forking — the DID-keyed `Start` chain.

Every consequential write reuses the canonical primitives: `writeEmployerReviewAuditEvent` (audit-before-success, joins the mutation `tx`), `decideEmployerActionRbac` + `assertVerifierOwnsOpportunity` (authorization), and a `parseBooleanEnvVar`/tri-state env flag to gate the pilot write path. New tables ship real `CREATE` migrations (the CI drift guard requires it).

## Invariants preserved

- **Unknown is not adverse.** `unknown | unavailable | access_required | needs_review` create a visible review/request state — never a block attributed to the clinician. Only `ADVERSE` blocks (`trust-contract` doctrine).
- **Evidence is not a claim.** Every accepted item keeps source, timestamp, freshness, limitations, and the frozen packet it came from.
- **Replayable.** Historical acceptance stays valid after the role/template/profile changes later — the packet seal and frozen opportunity version guarantee it.
- **Tenant-scoped.** Every read/write authorizes Application→Opportunity→Organization ownership; Organization B never sees Organization A's application.
- **No automated adverse action.** Decline/close uses a policy-safe reason taxonomy with required human review; no AI/auto-reject.

## Consequences

- **Positive:** one application-scoped, replayable spine unifies three disjoint keyspaces; the employer decision surface and activation console become real without a rewrite; time-to-start becomes computable from durable events.
- **Cost:** additive migrations (one new table + nullable columns), and a reconciliation between the application-keyed and DID-keyed acceptance/start lineages that must be done carefully (documented, not forced).
- **Explicitly out of scope:** becoming a CVO / privileging / payer-enrollment / payroll system; backfilling any `head_start_accepted`/`started` state without a real historic event (absence stays unknown).

## Alternatives rejected

- **Overload `ApplicationStatus.APPROVED` to mean start-ready** — rejected: conflates "employer accepted proof" with "credentialed & cleared to work", the exact false-completion the truth contract forbids.
- **Fork a new standalone activation data model** — rejected: creates a fourth disjoint keyspace; the current-state map shows fragmentation is already the core problem.
- **Infer start from readiness/export** — rejected: a qualified start is an authorized human decision, not a derived score.
