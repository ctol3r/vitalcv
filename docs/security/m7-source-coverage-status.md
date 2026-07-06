# M7 — Source Coverage Expansion — Status

**Date:** 2026-07-06

## Shipped this wave

- **Doctrine fix — removed a latent NPDB claim.** `psvOrchestrator.ts` emitted a
  `PrimarySourceVerification` with `verifier: 'NPDB'` (+ `npdb.hrsa.gov` evidence
  URL) on its mock PSV credential. NPDB is **never** claimed (anti-drift #1).
  Removed the NPDB evidence line; the mock connector stays internal-only for a
  future *gated* integration and must not emit a claim. (Gated off in prod today —
  `runPsvOrchestration` is behind `FEATURE_READINESS_ENGINE=false` — so this was
  latent, not live, but it would have surfaced on flag-flip.) Backend typecheck clean.

## Verified honest (no change needed)

- `trustScoreV1.ts` is explicit: "SAM.gov not checked — only OIG/LEIE verified"
  and "Board cert not checked — ABMS is gated". Sources degrade to honest coverage
  states; no fabricated pass. `REAL_NURSYS_ENABLED`/`FSMB_ENABLED` default off →
  `accessRequired`/`gated`.

## Backlog (external / real adapter builds — not completable in-repo)

| Item | Disposition |
|---|---|
| **M7-1 State-board lanes #2–#5** | Real adapters with recorded fixtures + STALE handling. Multi-day build; current lanes use mock connectors (`STATE-BOARD-MOCK-v1`). |
| **M7-2 Nursys institutional access** | **External** — institutional agreement + E-Notify wiring behind `REAL_NURSYS_ENABLED`. Until live, UI must show `accessRequired`. |
| **M7-3 FSMB** | **External** — same pattern behind `FSMB_ENABLED`. |
| **M7-4 PECOS refresh automation** | Quarterly snapshot auto-ingest + staleness countdown. Build. |
| **M7-5 OIG/LEIE continuous monitoring** | Monthly-delta re-check → revocation-first flow + notification. Build (behind `MONITORING_ENABLED`). |
| **M7-6 Employment-history evidence** | Issuer-signed work-history evidence class. Build. |
| **M7-8 Trust/source registry page GA** | Public per-source coverage/limitations/freshness page auto-generated from `sourceCatalog`. Frontend build; a `mission-ops/sources` API route exists as a starting point. |

## Assessment

The honesty-critical action — killing a latent NPDB over-claim — is shipped. The
rest of M7 is real adapter engineering + institutional agreements (external,
calendar-bound). No non-live source is represented as integrated.
