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

## ACT-7.4 — the reconciliation decision (deferred, needs sign-off)

This branch does **not** touch `confirm-start`. Reconciling the two start paths is a trust-contract decision:

- **Option 1 — Bridge (recommended).** When `confirm-start` runs and its `EmployerAcceptance` carries an `applicationId`, also call `recordStart()` so the application's `START_RECORDED` lifecycle stays consistent with the attestation. `StartAttestation` remains the employer-facing non-repudiation artifact. Additive; does not disturb the live path. **Depends on ACT-7.2** (populating `applicationId` on the acceptance — `ReviewClient` currently posts only `{ acceptanceScope: 'pilot' }`, so the link is unreachable from the UI).
- **Option 2 — Replace.** Route `confirm-start` entirely through `startEventService` and retire `StartAttestation`. More disruptive; `START_ATTESTED` is described in-code as a canonical non-repudiation event.
- **Option 3 — Keep separate.** Document them as two intentional concepts (attestation vs lifecycle). Least work; leaves the ambiguity BASE-0 flagged.

**Recommendation:** ACT-7.2 (wire `applicationId` through the accept payload) → then ACT-7.4 Option 1 (bridge). Do not implement ACT-7.4 until the option is chosen.

## Test

`routes/__tests__/activation.test.ts` — DB-free (mocks prisma + the services + the org-role guard). Covers read authz (applicant / org-member / stranger-403 / missing-404 / non-uuid-404), instantiate validation + org pass-through, resolve status validation + `wrong_tenant`→403, the `not_start_ready` blocking response, and start-date validation. The service business logic (transitions, audit-before-success, readiness gating) is already covered by the existing `services/activation/__tests__`.
