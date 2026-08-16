# ADR 0007: One employer decision service

- **Status:** Accepted (2026-08-15)
- **Date:** 2026-08-15
- **Context basis:** `origin/main` at `a8db9734c`; door B routes `apps/api/backend/src/routes/employerActions.ts`, door B writer `apps/api/backend/src/services/entity/employerReviewActions.ts`, door A spine `runEmployerWorkflowAction` (PR #1378, `services/opportunities/employerWorkflowService.ts`), wedge lane `apps/api/backend/src/routes/wedge.ts`.
- **Deciders:** security/backend lane; wedge retirement pending founder confirmation.

## Context

An employer decision (accept, refresh request, route-to-review, start attestation) could be
recorded through several doors with diverging semantics:

- **Door A** — the application-keyed workflow (`runEmployerWorkflowAction`, PR #1378), which
  writes `EmployerAcceptance.employerId` as an **organization id**.
- **Door B** — the entity-keyed review routes (`/api/employer-review/...`), which until this ADR
  wrote `employerId` as the **Clerk user id** of the acting reviewer, authenticated by the
  browser-forgeable `x-clerk-user-id` header.
- **Wedge** — `routes/wedge.ts` under `apiKeyAuth`, with zero live callers.
- A fourth, unmounted writer (`routes/employer-action.ts`, wave-122) still contained a live
  `employerAcceptance.create` with no audit event and no duplicate guard.

The same column meaning two different identifiers broke door A's "already accepted" reads
against door B's rows, and split the duplicate-acceptance guarantee.

## Decision

1. **The spine is door A.** `runEmployerWorkflowAction` (PR #1378) is the canonical employer
   decision path. Door B remains as an **adapter**: entity-keyed review actions that, where an
   application exists, require explicit application selection (`applicationId` + `packetHash`,
   ACT-1.2) and converge on the same row semantics.
2. **`EmployerAcceptance.employerId` means ORGANIZATION id.** `acceptedBy` carries the acting
   Clerk user id. Door B resolves the reviewer's `User.organizationId` server-side
   (`resolveReviewerAcceptanceIdentity`); reviewers with no organization binding keep the legacy
   clerk-id value, marked `employerIdSemantics: 'legacy_clerk_user'` in row metadata so rows
   written under each semantic stay distinguishable. No backfill: the column meaning converges
   by writer.
3. **Every lookup keyed on `employerId` checks both ids** (organization id + Clerk user id)
   until legacy rows age out — duplicate guard, confirm-start resolution, queue display.
4. **Mutations authenticate with the verified Clerk session** (`requireVerifiedClerkUserId`),
   never the raw `x-clerk-user-id` header.
5. **The writer set is machine-checked.** `src/__tests__/acceptanceWriterInventory.test.ts`
   asserts the only non-test modules containing `employerAcceptance.create` /
   `startAttestation.create` are the allowlisted writers (`employerReviewActions.ts`;
   `startWriter.ts`). PR #1378 adds `employerWorkflowService.ts` to the acceptance list under
   this ADR. **Extending an allowlist requires a new ADR or an amendment here.** The unmounted
   wave-122 writer is deleted.
6. **The wedge lane is scheduled for retirement, pending founder confirmation.** No new callers
   of `routes/wedge.ts` are permitted; its machine-keyed start path stays only until the founder
   confirms retirement or names a real machine integration that needs it.

## Consequences

- Door A's "already accepted" reads and door B's writes agree on what `employerId` names.
- With org semantics, a second reviewer in the **same organization** now 409s on a duplicate
  accept — previously each reviewer could accept the same clinician once. This is the intended
  meaning of "the organization already accepted".
- Legacy rows are identifiable by metadata marker, not guessed at by id shape.
- A resurrected or new acceptance/attestation writer fails CI until an ADR names it.

## Amendment — start-writer succession (2026-08-15, supersedes-#1384 reconstruction)

Point 5's StartAttestation allowlist changes as follows.

`services/activation/applicationStartCommandService.ts` is the **one authoritative
start command**. Start-ready and employer-confirmed actual-first-day flow only
through it: it advances `StartActivation`, creates exactly one `StartAttestation`
for the case, writes the `START_ATTESTED` and `START_RECORDED` audit events, and
enqueues the outbound `HIRE_TO_START_*` intent in one PostgreSQL transaction. A
failure at any step leaves no half-state. `POST /api/applications/:appId/start`
runs it directly; the machine lane (`POST /api/hiring/start`) adapts onto it via
`confirmStartByAcceptance` and fails closed for acceptances with no application
binding, no clinician NPI, or no employer organization.

`services/hiring/startWriter.ts` **remains allowlisted for exactly one caller**:
the entity-scoped `POST /api/employer-review/:entityId/confirm-start` path in
`routes/employerActions.ts`, which was out of scope for this succession.
Migrating confirm-start onto `confirmStartByAcceptance` (as PR #1384 drafted) is
the recorded follow-up that removes `startWriter.ts` from the allowlist; until
then no new caller may use it.

Deferred deliberately, not forgotten: #1384's `StartAttestation`
application/organization/confirmedBy columns and unique index are a Prisma
schema change (founder-approval tier). The exactly-once guarantee is carried by
the command's conditional `StartActivation` state advance inside the
transaction; the binding is durable in the attestation metadata and both audit
rows.
