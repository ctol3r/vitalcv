# ACT-7 — activation ledger + start-state HTTP surface

**Status:** ACT-7.3 implemented (this branch). ACT-7.2 and ACT-7.4 are follow-ups; ACT-7.4 needs a founder/architect decision (below).
**Baseline:** `origin/main` @ 2026-07-20. **Verified against code**, not the plan text — the plan's descriptions of this area were confirmed by reading `origin/main`.

## Problem (verified)

The ACT-1.3 / ACT-1.4 service layers were built and unit-tested but **never mounted**: nothing under `apps/api/backend/src/routes` or `apps/web` imported `services/activation`. So a clinician's requirement ledger ("remaining work to a qualified start") and the start-ready / started lifecycle could not be read or driven by any request. The public hero now promises "start faster"; that promise had no HTTP surface behind it.

Separately, there is a **live but different** start path: `POST /api/employer-review/:entityId/confirm-start` (`employerActions.ts`) writes a `StartAttestation` + `START_ATTESTED` audit event, gated on an `ACCEPTED` `EmployerAcceptance`. It is **entity/employer-keyed** and does **not** go through `startEventService`, so it emits no `START_READY/RECORDED/CANCELLED` event. Two unconnected start concepts exist in the tree (BASE-0 §6).

## ACT-7.3 — what this branch does

Mounts `services/activation` as an **application-scoped** HTTP surface in `routes/activation.ts`, registered in `app.ts`:

| Method | Route | Service | Authz |
| --- | --- | --- | --- |
| GET | `/api/applications/:appId/activation` | `getApplicationActivation` | applicant or org member |
| POST | `/api/applications/:appId/activation/instantiate` | `instantiateActivationRequirements` | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |
| PATCH | `/api/applications/:appId/activation/requirements/:requirementId` | `resolveActivationRequirement` | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |
| GET | `/api/applications/:appId/start-state` | `getApplicationStartState` | applicant or org member |
| POST | `/api/applications/:appId/start-ready` | `markStartReady` | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |
| POST | `/api/applications/:appId/start` | `recordStart` | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |
| POST | `/api/applications/:appId/start/cancel` | `cancelStart` | `requireOrgRole(VERIFIER_MUTATION_ROLES)` |

**Design choices honoured:**
- **Tenant** is resolved from `application → opportunity → organizationId` and passed to the services, which independently reject a cross-tenant requirement (`wrong_tenant` → 403). Defense in depth, not per-callsite discipline.
- **Audit-before-success** stays inside the services (they already emit the AuditEvent before returning). The routes add no second audit path and never return 2xx on a service failure.
- **start-ready is gated**: `markStartReady` refuses (409 `not_start_ready`) while any REQUIRED requirement is open and returns the exact `blocking` list — "not ready" always points at an actionable requirement.
- **Org-role is a header-trust boundary** until G1 (verified identity) is at enforce — the same boundary every other verifier mutation route already accepts. When `VERIFIER_RBAC_MODE`/G1 flips to enforce, these routes inherit it with no code change.
- **No migration.** `ActivationRequirement`, `StartActivation`, and the `START_*` audit types already exist on `main`.

## ACT-7.4 — the reconciliation decision (Option 1 CHOSEN 2026-07-20; sequenced behind ACT-7.2)

This branch does **not** touch `confirm-start`. Reconciling the two start paths is a trust-contract decision. The options considered:

- **Option 1 — Bridge (CHOSEN).** When `confirm-start` runs and its `EmployerAcceptance` carries an `applicationId`, also drive the application's `START_RECORDED` lifecycle so it stays consistent with the attestation. `StartAttestation` remains the employer-facing non-repudiation artifact. Additive; does not disturb the live path.
- **Option 2 — Replace.** Route `confirm-start` entirely through `startEventService` and retire `StartAttestation`. Rejected: more disruptive; `START_ATTESTED` is a canonical non-repudiation event in-code.
- **Option 3 — Keep separate.** Rejected: leaves the "two unconnected start concepts" ambiguity BASE-0 flagged.

**Two hard constraints discovered while grounding the implementation (do not skip):**

1. **`recordStart` only fires from `start_ready`** (`canRecordStart` in `startState.ts`). A naive `confirm-start → recordStart()` returns `invalid_state` whenever the application was never marked start-ready. The bridge must therefore either (a) require the application be `start_ready` before an attested start is accepted (preferred — keeps the readiness gate meaningful), or (b) mark-ready-then-record only when the requirement ledger's `readiness.startReady` is true. It must never force a start past open required requirements.

2. **`ReviewClient` has no `applicationId`.** It is keyed on `passport.entityId` and reached via an entity/packet-share link; the application context lives in the separate `/employer/decision/[applicationId]` surface. The backend accept route *already* accepts + verifies `applicationId` + `packetHash` (`employerActions.ts` ~397–481) — so **ACT-7.2 is a web/surface-linkage task, not a field-add**: decide how an entity-keyed review obtains its application (pass it into `ReviewClient` from an application-aware mount, or reconcile the two employer surfaces). Until an acceptance actually carries an `applicationId`, the Option-1 bridge has nothing to key on.

**Sequence:** ACT-7.2 (establish the review→application linkage so acceptances carry `applicationId`) → ACT-7.4 (bridge, honoring constraint 1). Neither is in this PR.

## Test

`routes/__tests__/activation.test.ts` — DB-free (mocks prisma + the services + the org-role guard). Covers read authz (applicant / org-member / stranger-403 / missing-404 / non-uuid-404), instantiate validation + org pass-through, resolve status validation + `wrong_tenant`→403, the `not_start_ready` blocking response, and start-date validation. The service business logic (transitions, audit-before-success, readiness gating) is already covered by the existing `services/activation/__tests__`.
