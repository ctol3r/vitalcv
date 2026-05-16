# Final Replay Continuity Hardening

## What Exists

Replay continuity is already encoded in the repo through:

- Deterministic replay inspection: `apps/web/lib/replay/getReplayInspection.ts`
- Replay route: `apps/web/app/api/replay/[runId]/route.ts`
- Receipt continuity route: `apps/web/app/api/receipt/[lineageKey]/route.ts`
- Verifier replay page: `apps/web/app/verify/receipt/[receiptId]/page.tsx`
- Chronology display: `apps/web/components/verifier/ReplayChronologyPanel.tsx`

## Deterministic Fields

The following fields are the load-bearing continuity anchors:

- `checkedAt`
- `runId`
- `lineageKey`
- `ownership`
- `tier` values `T1`, `T2`, `T3`, `T4`
- `receiptId`
- `priorRunId`

## Hardening Status

| Item | Status | Notes |
|---|---|---|
| Deterministic replay ids | PASS | `deriveRunId()` is stable for a given receipt id. |
| Deterministic receipt ids | PASS | `receiptId` and `lineageKey` are surfaced as explicit identifiers. |
| Replay persistence durability | PASS | Current surfaces use explicit continuity data and no silent fallback chain. |
| Chronology persistence durability | PASS | Chronology is rendered from deterministic fields, not from ad hoc UI state. |
| Replay recovery semantics | PASS | Missing continuity becomes a visible gap or `anonymous_preview`, not a fake positive. |
| Degraded replay recovery | PASS | The replay page and register surface degradation plainly. |
| Continuity reconciliation | PASS | `priorRunId` and `lineageKey` are the reconciliation primitives. |
| Replay chain validation | PASS | Gaps are rendered, not hidden. |
| Replay integrity assertions | PASS | The route surface is no-store and inspectable. |

## Remaining Boundary

This sweep did not mount a live runtime, so end-to-end persistence under restart remains source-verified rather than live-verified.

## Verdict

**Replay continuity hardening: PASS at source level**

The continuity model is deterministic, replayable, and auditable. Live persistence proof remains the last runtime check.
