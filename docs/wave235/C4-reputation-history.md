# W235-C4 — Reputation History

**Wave:** 235 · **Depends on:** [C3](./C3-dimension-model.md)
**Date:** 2026-06-21

How reputation evolves through time — **Growth, Decay, Recovery, Milestones** — derived deterministically from `CareerEvent`s + `TrustHistory` (W225). No new time series; a projection of existing timestamps.

---

## 0. Model

```ts
type ReputationEventType = 'growth' | 'decay' | 'recovery' | 'milestone';

interface ReputationHistoryEntry {
  occurredAt: string | null;
  type: ReputationEventType;
  dimension: ReputationDimensionId | null;
  detail: string;
  evidenceId: string | null;
  /** signed; bounded by the underlying CareerEvent.trustImpact. */
  scoreDelta: number;
}

interface ReputationHistory {
  entries: ReputationHistoryEntry[];   // sorted asc by occurredAt, nulls last
  growth: number;       // count of net-positive periods / reinforcements
  decay: number;        // count of decay events
  recovery: number;     // count of detected recoveries
  milestones: number;   // count of milestone events
  trend: 'growing' | 'decaying' | 'stable';   // reuse TrustHistory.trend
}
```

## 1. Deterministic derivation rules

| Type | Rule (pure) |
|---|---|
| **Growth** | a `CareerEvent` with `trustImpact > 0` in a dimension → growth entry (`+trustImpact`). Mirrors `TrustHistory` reinforcement. |
| **Decay** | a `CareerEvent` with `trustImpact < 0` (stale/expired/revoked) → decay entry (`−`). |
| **Recovery** | within a dimension, a decay event followed (strictly later by `occurredAt`) by a growth event for the **same source/class** → recovery entry at the growth timestamp. Pure two-pass scan over sorted events. |
| **Milestone** | first decision-grade evidence in a dimension; first recognition event; a `standing` threshold crossing (`provisional→emerging→established`). All computed by replaying the sorted events. |

## 2. Recovery detection (the one non-trivial pattern)

```
for each dimension:
  sort its events by occurredAt
  track lastDecayAt per source/class
  on a growth event whose source/class had a prior decay (lastDecayAt < occurredAt):
    emit recovery(dimension, occurredAt, evidenceId)
```
Deterministic, O(n log n), no state outside the event list. A re-verified-after-expiry license is the canonical recovery.

## 3. Milestones (deterministic, replayable)

- **First verification** in a dimension → "AuthorityReputation established its first source-backed credential."
- **First recognition** (signed canonical event) → "First professional recognition recorded."
- **Standing crossing** → emitted when the running decision-grade evidence count crosses a threshold that flips `standing`.

All milestones are functions of the ordered event set — same input, same milestones (replay-safe).

## 4. Honesty constraints

1. Reputation history is **derived from current evidence timestamps**, not a recorded reputation log — stated explicitly (Trust Graph Rule 35).
2. `scoreDelta` is bounded by the underlying `CareerEvent.trustImpact` ([−1, 1]); no event inflates.
3. Recovery requires a *real* later reinforcement — never inferred from absence.
4. Deterministic ordering and counts (replay-safe; no `Date.now()`).

## 5. Connection to mobility (success-criterion #4)

A reputation **recovery** or **growth** in `authority`/`mobility`-adjacent classes (a re-verified or newly added license) is simultaneously a **mobility-expansion** `CareerEvent` (W225 already sets `mobilityImpact: 'expands'`). So reputation history and mobility readiness move together by construction — the same event carries both signals. This is how reputation connects to mobility without a separate model.

## 6. Success-criteria answer

- **How do we represent reputation through time?** A deterministic projection of `CareerEvent`s into growth/decay/recovery/milestone entries — replay-safe, evidence-bounded, traceable.

**Deliverable status:** complete. → C5.
