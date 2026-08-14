# 90-day clinician hire-to-start execution plan

**Date:** 2026-08-14 · **Status:** Founder-approved execution contract · Derived
from [`vitalcv-category-strategy.md`](./vitalcv-category-strategy.md),
[`vitalcv-strategy-operating-brief.md`](./vitalcv-strategy-operating-brief.md),
and [`beachhead-decision.md`](./beachhead-decision.md).

## Position and boundary

- **Clinicians:** a reusable professional profile for finding opportunities,
  applying, and moving without starting over.
- **Employers:** **VitalCV is the Clinician Hire-to-Start Platform.** From
  opportunity to confirmed first day.
- **Buyer:** provider recruitment leadership at health systems.
- **Initial market:** employed physicians and advanced practice providers.
- **System role:** an orchestration layer around a clinician-controlled profile.
  The ATS remains the recruiting record. Credentialing platforms and
  institutions retain credentialing, enrollment, privileging, monitoring, and
  compliance authority.
- **Primary outcome:** an authorized employer confirms the clinician's actual
  first day. First-billable is optional secondary data, never the universal
  success event.
- **Commercial direction:** after the pilot, an annual platform fee plus an
  idempotent fee per confirmed start.

VitalCV may distribute and match opportunities, but does not compete on listing
inventory alone. It integrates with credentialing, enrollment, privileging,
monitoring, CVO, ATS, HR, and workforce systems rather than replacing them. The
product owns the joined case, next action, blocker owner, milestone history, and
outcome clock between application and actual start.

Public employer hero copy must not name competitors. Procurement materials may
name them only to state interoperability, ownership boundaries, and
non-replacement. Do not claim faster starts, savings, credentialing completion,
or live integration support without production workflow evidence.

## Canonical lifecycle

1. A clinician privately views or matches to an opportunity.
2. The clinician submits an application with an exact, clinician-approved,
   immutable packet.
3. An authorized employer opens and reviews that packet.
4. The employer requests clarification, accepts the packet as a head start, or
   does not proceed.
5. Head-start acceptance opens the existing `StartMission`.
6. Remaining requirements are assigned to the clinician, employer, external
   system, institution, or source.
7. The employer records start-ready only after every required item is resolved.
8. An authorized employer records the actual first day.
9. VitalCV records the outcome and profile reuse without implying credentialing
   approval or institutional clearance.

## Days 1–15 — install the contract

- Amend the canonical strategy, operating brief, beachhead decision, and this
  plan with the dual-audience category, broader pilot, buyer, confirmed-start
  event, and complementary incumbent posture.
- Add copy and contract tests that preserve the exact employer category,
  VitalCV's non-credentialing boundary, and final institutional authority.
- Refresh the current-state audit from current `main` and deployed production;
  retain dated historical counts only as history, never as current truth.
- Freeze the lifecycle above as the only product path. Do not add a fourth
  decision, activation, or start engine.

## Days 16–45 — make one canonical transaction

- Route every employer terminal decision through one canonical application
  decision command.
- Make head-start acceptance one database transaction containing:
  - application transition;
  - verified actor and owning organization;
  - exact sealed packet version and hash;
  - `EmployerAcceptance`;
  - closure of clarification requests;
  - audit event;
  - durable Decision Capsule/outbox request;
  - `StartActivation`;
  - only the remaining `ActivationRequirement` rows.
- Fail closed on missing, legacy, cross-application, revoked, or hash-invalid
  packets. Never fabricate a historic packet for a legacy application.
- Consolidate actual-start recording so application start lifecycle,
  `StartAttestation`, and audit are atomic. Keep old endpoints only as
  compatibility adapters to the canonical command and mark them deprecated.
- Extend the employer application detail into the working hire-to-start case:
  exact submission, decisions, intended start, requirements, blocker owner,
  next action, start-ready state, and confirmed start.
- Keep the clinician application view synchronized to the same requirement and
  milestone ledger without exposing employer-private notes.

## Days 46–65 — connect existing systems

Add a generic contract before any vendor-specific adapter:

- `ApplicationExternalReference`: durable application-to-external-object mapping
  scoped to organization and source system.
- `IntegrationInboxEvent`: immutable organization-scoped receipt keyed by
  external event ID, with payload hash, processing state, and replay protection.
- Reuse the transactional outbox and employer webhook configuration for outbound
  delivery.

Expose:

- `GET /api/applications/:applicationId/hire-to-start` for the authorized joined
  read model.
- Existing decision and start routes as adapters to canonical services.
- `POST /api/integrations/hire-to-start/events` for signed, idempotent inbound
  status events.
- Outbound events for application submitted, packet delivered, decision
  recorded, requirement changed, start-ready, and start confirmed.

The joined read model includes application and opportunity versions; packet
binding and limitations; employer decision; stage; intended and actual start;
requirements with owner, status, deadline, source-system reference, and
limitation; primary next action; milestone timestamps; and external-system sync
freshness.

An external credentialing status may update a requirement or report
waiting/review. It cannot create source-backed evidence without an attributable
artifact. Unknown, stale, failed, and unavailable states remain visible. Begin
with authenticated generic role import and signed events; select a
vendor-specific connector only after a signed design partner identifies its
production stack.

## Days 66–90 — pilot and prove

- Recruit 5–10 health-system design partners; launch with the first 2–3 that can
  supply real physician or APP cases and signed data/integration scope.
- Limit each partner to no more than two service lines.
- Use real opportunities. Use synthetic identities for uncontrolled or
  pre-production tests; never use real clinician data there.
- Keep the pilot free under signed scope. Do not enable start-triggered billing
  until a commercial agreement defines entitlement, price, dispute handling,
  cancellation, and duplicate-start behavior.
- Produce a procurement packet that names what VitalCV, the ATS, the
  credentialing platform, and the institution each own; the exact data
  exchanged; security and authorization boundaries; implemented versus planned
  capabilities; and pilot measurement methodology.

## Measurement and commercial acceptance

Primary metric:

> **Employer-confirmed clinician starts enabled by a VitalCV profile.**

Measure these clocks independently:

- opportunity/application to confirmed first day;
- head-start acceptance to confirmed first day.

Supporting measures are time to employer first review, clarification cycles,
required items reused versus re-entered or rechecked, open blockers by owner,
intended-start slippage, start-ready to actual-start duration, cancellations and
reasons, incomplete integrations, and missing terminal events.

Do not publish a speed or savings claim before at least 12 complete, valid start
spans exist. Report excluded incomplete cases. Never calculate days saved without
a defensible comparison cohort or baseline.

After the pilot, one unique authorized `StartAttestation` may create at most one
billable event, and only for an organization with active signed commercial
entitlement.

## Acceptance gates

- Real-PostgreSQL tests prove accept → requirements → start-ready → confirmed
  start.
- Negative tests cover cross-tenant access, spoofed roles/organizations, packet
  tampering, wrong versions, revoked membership, duplicate and out-of-order
  events, premature start-ready, duplicate starts, and anti-enumeration.
- Integration tests prove signatures, idempotency, replay rejection, outbox
  retry, external-reference uniqueness, and honest outage degradation.
- End-to-end tests exercise the complete clinician and employer lifecycle.
- Production acceptance requires green required checks, Railway `/api/version`
  matching the deployed SHA, private `no-store` on authenticated surfaces, and
  the changed desktop and mobile flow exercised.

## Current implementation baseline (verified 2026-08-14)

At `main` commit `c95e01b7a38e458008bf6022caceeef82d7f9463`:

- immutable packet writing and authorized packet reading exist;
- packet-bound employer acceptance exists on one employer path;
- `StartActivation`, requirements, start-ready, and start events exist;
- a shared `StartAttestation` writer exists for two compatibility routes;
- billing is intentionally absent from the start path;
- employer decision, activation, and start paths are not yet one transaction;
- the application-scoped joined hire-to-start read model does not exist;
- generic application external references and integration inbox receipts do not
  exist;
- existing ATS adapter code is not evidence of a mounted production integration.

This is a source baseline, not a deployment claim. Production acceptance remains
subject to the gates above.
