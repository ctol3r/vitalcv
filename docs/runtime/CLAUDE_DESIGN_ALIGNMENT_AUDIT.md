# Claude Design Alignment Audit

Required contract:

`OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID`

## Alignment Check

| Surface | Alignment status | Evidence |
|---|---|---|
| Lineage Header | PASS | `apps/web/app/verify/receipt/[receiptId]/page.tsx` renders receipt id, run id, checked time, issuer, lineage key, and signing key in a fixed reading order. |
| Replay Memory | PASS | `apps/web/components/verifier/ReplayChronologyPanel.tsx` and `apps/web/lib/replay/getReplayInspection.ts` keep replay history explicit and chain-linked. |
| Verifier Reading Mode | PASS | `apps/web/app/verify/page.tsx` and `apps/web/app/verify/receipt/[receiptId]/page.tsx` use monospaced identifiers and deterministic chronology labels. |
| Failure Taxonomy | PASS | `apps/web/app/verify/receipt/[receiptId]/page.tsx` renders `issuer_outage`, `vitalcv_outage`, `anonymous_preview`, `stale_data`, and `unknown` as named states. |
| Trust State Register | PASS | `apps/web/components/trust/TrustRegisterRow.tsx` hard-codes the six-slot order and uses `NullSlot` for missing values. |
| Degraded-state semantics | PASS | `apps/web/components/trust/TrustStateRegister.tsx` and the replay inspection page render degradation explicitly instead of collapsing to fake green. |
| Chronology readability | PASS | `apps/web/components/chronology/CanonicalChronologyView.tsx` and `apps/web/components/ops/ChronologyIntegrityTelemetry.tsx` enforce the canonical reading order. |
| Institutional scanability | PASS | Labels, slot order, and trust tiers remain consistent across trust, replay, verify, and status surfaces. |
| Verifier readability | PASS | `/verify`, `/verify/receipt/[receiptId]`, and `/trust/graph` expose the same institutional order without requiring a mode switch. |
| Replay readability | PASS | Replay surfaces use `runId`, `priorRunId`, and `lineageKey` instead of ambiguous prose. |

## Canonical Slot Order

The fixed six-slot order is now represented across the following surfaces:

- `TrustRegisterRow`
- `CanonicalChronologyView`
- `ChronologyIntegrityTelemetry`
- `LineageContinuityDiagram`
- `ReplayChronologyPanel`
- `trust/schema` page
- `trust/graph` page copy

## Terminology Drift Check

- `checkedAt` is used consistently for capture time.
- `runId` is used consistently for chronology identity.
- `lineageKey` is used consistently for lane + provider identity.
- `replay` is used consistently for the prior-link field.
- `ownership` is used consistently for actor/system/unbound state.

## Verdict

**PASS**

The runtime now reads like institutional infrastructure rather than product theater.
