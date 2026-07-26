# ADR: Activation — head-start acceptance and qualified start

- **Status:** Proposed (ACT-1.0)
- **Date:** 2026-07-18
- **Context basis:** `origin/main` @ `85dbc181d`; see `docs/activation/ACT-1-current-state-map.md` for the file-level trace.
- **Deciders:** ACT-1 lane (employer activation). Requires product/policy sign-off before ACT-1.2 write paths ship.

## Context

VitalCV has a real "front half" of the hiring loop: a clinician applies with a consented, sealed, replayable `ApplicationPacket` (`schema.prisma:1796`) carrying a frozen opportunity version. The "second half" — an employer accepting reusable proof and both sides closing the remaining path to a qualified start — is fragmented across **three unreconciled paths**:

1. `runEmployerWorkflowAction` accept → flips `Application.status` to `ACCEPTED` with the note *"Approved and moved to credentialing"*, **no acceptance record, no packet link, no audit** (`employerWorkflowService.ts:526`).
2. `recordEmployerReviewAcceptance` → writes an `EmployerAcceptance` + audit, but `artifactId` is null, so the acceptance is not linked to the packet it accepted (`employerReviewActions.ts:839`).
3. `omegaOrchestrator` → the only live writer of the `start_activations` sidecar (`omegaOrchestrator.ts:129`).

The canonical event-sourced `Recognition → Acceptance → Start` models exist but are **dormant** (no live callers). The `ApplicationStatus` enum already contains `ACCEPTED`, `APPROVED`, `CREDENTIALING`, and `STARTED` — tempting shortcuts that would conflate distinct meanings.

The strategic and legal stakes are high: **VitalCV must never imply that accepting a reusable proof pack means a clinician is credentialed, privileged, cleared, or eligible to begin work.** No vendor can make an employer's credentialing, privileging, payer enrollment, or onboarding requirements vanish (`ANTIGRAVITY.md`; Godmode product law #4). Overloading `APPROVED` to mean "credentialed" or "start-ready" would be a truth-contract and compliance failure.

## Decision

**1. `head_start_accepted` is a first-class, additive activation state — semantically distinct from `APPROVED`/`CREDENTIALING`/`STARTED`.**

It means exactly: *"this defined, scoped evidence from this sealed packet may be reused as a head start for this role/organization under this policy version."* It does **not** mean credentialed, cleared, privileged, or eligible to begin work. The activation phase lives in the additive `start_activations` sidecar (already present, constraint-guarded), never by repurposing a legacy `ApplicationStatus`.

**2. One audited, packet-linked accept action** replaces the status-flip (path ①) and the null-link (path ②):
- Accepts only defined packet claims/scope for `{application, role, organization, policyVersion}`.
- Writes **audit-before-success** with the canonical payload: `actorId, organizationId, applicationId, opportunityId, packetManifestHash, packetVersion, opportunityVersion, policyVersion, acceptedScope, priorState, nextState`.
- Links the acceptance to the sealed `ApplicationPacket` (populate `EmployerAcceptance.artifactId`, or adopt the dormant `Acceptance.psvReportId`) so it is replayable after the profile/role/template later change.
- Fails closed on packet-integrity failure, revoked/withdrawn share, or wrong tenant.

**3. Requirements are the only thing acceptance creates** — an additive, application-linked requirement record (reusing `OpportunityRequirement` vocabulary where live), instantiated *after* the accept decision, marking already-accepted evidence so the clinician never re-enters it. One canonical requirement record drives both the clinician and employer views.

**4. Qualified start is an explicit, event-recorded decision** — never inferred from a readiness score, packet export, `APPROVED` status, or a page view. The predicate: all required requirements `met/waived/not_applicable`, no open required blocker, and an authorized employer records `start_ready`, then `started`. Corrections supersede with a durable trail; they never overwrite.

**5. Activation phase state model** (additive to `start_activations.activation_state`, extend `chk_activation_state`):

```
under_review → head_start_accepted → requirements_in_progress → start_ready → started
             ↘ waiting_on_clinician / manual_review          ↘ withdrawn / cancelled → closed
```

Each state is honest about what it does **not** decide. `unknown`, `unavailable`, `gated`, and `needs_review` are never adverse results and never a block "caused by the clinician."

## Consequences

- **Additive only.** New columns/tables; historic applications/packets preserved; read services tolerate rows created before activation fields existed. Backfill nothing into `head_start_accepted`/`start_ready`/`started` without a real historic event — absence stays `unknown`.
- **Convergence, not a fourth model.** Paths ①②③ reconcile onto one accept + the existing `start_activations` sidecar. `Recognition/Acceptance/Start` are either wired or explicitly deprecated in favor of `EmployerAcceptance` + sidecar — decided in ACT-1.2, not forked.
- **Antigravity.** No generic "activation dashboard." Surfaces appear when a reviewer or clinician is actually blocked, and return them to their work otherwise.
- **No automated adverse action.** Accept/decline/route-to-review are human-owned; AI may summarize and sequence, never decide. Decline uses a policy-safe reason taxonomy.
- **Gated rollout.** New write paths ship behind a pilot feature flag; deploy order: read model/authz → audited accept → requirement lifecycle → start events → metrics.
- **Copy contract.** No surface may render `Verified`/`Approved`/`Cleared` as shorthand for completed credentialing; `head_start_accepted` renders in clinician-facing language as "accepted as a head start," with the remaining requirements explicit. Guarded by `check:claims` + copy-compliance CI.

## Alternatives rejected

- **Overload `ApplicationStatus.APPROVED`/`CREDENTIALING`** to mean head-start or start-ready — rejected: conflates employer proof-acceptance with institutional credentialing completion (truth-contract + compliance violation).
- **Wire the dormant `Recognition/Acceptance/Start` spine as the primary path now** — deferred: it has no live callers and no packet linkage; reconciling it is an ACT-1.2 decision, not an ACT-1.0 commitment. The already-live `start_activations` sidecar is the lower-risk additive substrate.
- **A standalone activation dashboard** — rejected under the Antigravity Contract.
