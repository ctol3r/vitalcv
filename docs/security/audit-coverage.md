# M1-2 — Mutating-Route Audit Coverage

**Date:** 2026-07-06
**Doctrine:** Anti-drift rule #2 — *"Every mutating action writes an AuditEvent
before 2xx — no exceptions, ever."*

## Current state (measured, not assumed)

- **157** route files under `apps/api/backend/src/routes/`.
- **~260** mutating handler registrations (`app/router.post|put|patch|delete`).
- **64** route files contain a **durable-audit** signal (`prisma.auditEvent.create`
  or the `auditIssuance/auditRevocation/auditDecision/auditPresentation` wrappers).
- **93** route files with mutating handlers have **no durable-audit signal**.

### Important nuances (why the raw 92 overstates the true gap)

1. **Two audit systems exist.** `appendAuditEvent` (`services/audit/auditLedger.ts`)
   is an **in-memory** ledger; the durable row is `prisma.auditEvent.create`. The
   gate counts only durable writes. Some routes call the in-memory ledger only.
2. **Many POST routes are queries, not mutations** — e.g. `/api/ask`, `/api/search`,
   `/api/command/parse`, `/api/*/simulate`, analytics reads that POST a filter
   body. These do not mutate persistent state and do not require an audit row.
   Each needs per-route classification before it counts as a true gap.
3. **Reference correction:** the initial exploration flagged `employerActions.ts`
   as unaudited — it is **not**. It writes `prisma.auditEvent.create` directly in a
   transaction before 2xx (see its header contract). The grep missed it because it
   uses the direct Prisma call, not the helper. `employerActions.ts` is the
   reference pattern for correct auditing.
4. **Service-delegated audit** (`activation.ts`, ACT-7.3). On the baseline, but its
   mutations **are** audited — they delegate to `services/activation/*`, whose
   `writeActivationAudit` / `writeStartEvent` call `prisma.auditEvent.create` before
   success. The static gate sees no *inline* durable write, so the file sits on the
   baseline; it is **not** a genuine gap. Adding a second inline audit in the route
   would double-write. Same shape as nuance 3, but the durable write is one call
   deeper (in the service the route invokes).

## Confirmed genuine gaps (state mutations that SHOULD audit)

| Route file | Example route | Priority | Notes |
|---|---|---|---|
| `clinician.ts` | `POST /api/clinician/activate` | **P0** | Profile activation — canonical-path-adjacent identity mutation, no audit. |
| `workspace.ts` | `POST /api/workspaces/switch` | **P0** | Workspace/persona context switch; M6-1 explicitly wants an audit event on switch. |
| `coordination.ts` | `POST /api/coordination/revoke` | **P0** | Revocation path — revocation-first doctrine demands an audit row. |
| `apply.ts` / `applications.ts` | application submit/update | **P1** | Clinician application state mutations. |
| `identityLayer.ts` / `identityBinding.ts` | identity bind | **P1** | Identity graph mutations. |
| `subscriptions.ts` | billing mutations | **P1** | (Note: memory flags subscriptions billing as partly dead code — verify live first.) |
| `graph.ts` (7), `intelligence.ts` (10), `sdJwt.ts` (9) | various | **P2** | Large surfaces; many handlers may be query/compute, not persistent mutation — classify per route. |

## Enforcement (the unregressable mechanism — shipped)

- **`scripts/check-audit-coverage.ts`** freezes the current 92-file baseline
  (`apps/api/backend/audit-coverage-baseline.json`). CI fails if a **new** mutating
  route file lands with no durable-audit signal and isn't reviewed into the
  baseline. The baseline can only **shrink** — the gate reports files that now
  audit so they get trimmed.
- Wired in `.github/workflows/audit-coverage-gate.yml`.

This does not yet prove 100% coverage (the P0 acceptance) — it **stops the bleed**
and makes remediation measurable. Full coverage = drive the baseline to the set of
genuine query-POSTs (documented non-mutating), with every real mutation audited.

## Remediation backlog (drive baseline → 0 genuine gaps)

1. **P0 (this list):** `clinician.ts`, `workspace.ts`, `coordination.ts` — add
   `prisma.auditEvent.create` before 2xx following the `employerActions.ts` pattern.
2. **P1:** apply/applications, identity layer.
3. **P2:** classify every remaining baseline file as `mutation` (add audit) or
   `query` (document + keep in an explicit query-allowlist), until the baseline
   holds only documented query-POSTs.
4. **Stretch:** middleware that asserts an audit row was written for any
   handler tagged `mutating`, converting the static gate into a runtime guarantee.
