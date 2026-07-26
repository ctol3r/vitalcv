# W225-C4 — Memory API Contracts

**Wave:** 225 · **Depends on:** C2/C3 (built: `projectTimeline`)
**Date:** 2026-06-21

Read-only, versioned (`vitalcv.timeline.*.v1`) contracts. The primary route is **built**; the four sub-views are filters over the same `TimelineProjection` payload.

---

## 0. Built

`GET /api/timeline/[entityId]` → `vitalcv.timeline.v1` (implemented at `apps/web/app/api/timeline/[entityId]/route.ts`). Returns the full `TimelineProjection`: `events`, `trustHistory`, `recognition`, `reputation`, `firstAt`, `lastAt`. Read-only, `Cache-Control: no-store`, composes passport runtime → evidence → graph → trust → timeline.

```jsonc
{
  "schema": "vitalcv.timeline.v1",
  "subjectKey": "…",
  "firstAt": "2026-03-01T00:00:00.000Z",
  "lastAt": "2026-03-23T12:00:00.000Z",
  "events": [
    { "eventId": "cred:lic-ca@2026-03-02T…", "occurredAt": "2026-03-02T…", "type": "licensure",
      "label": "California Medical Board", "evidenceId": "cred:lic-ca", "evidenceSource": "STATE_BOARD",
      "trustImpact": 1, "trustDimension": "authority", "mobilityImpact": "expands", "recognitionImpact": "none" }
  ],
  "trustHistory": { "entries": [ … ], "reinforcementCount": 3, "decayCount": 1, "netDelta": 2.6, "trend": "growing" },
  "recognition": [ … ],
  "reputation": { "overallTrust": 0.6, "decisionGradeEvidence": 3, "totalEvidence": 4,
                  "reinforcementCount": 3, "decayCount": 1, "trend": "growing", "standing": "emerging" }
}
```

## 1. Sub-views (designed; filters over the primary payload)

Each is a thin route that calls `projectTimeline` and returns one slice. Building them is optional (the primary route already returns all of it), but the contracts are fixed:

| Route | Schema | Returns |
|---|---|---|
| `GET /api/timeline/:entityId/events` | `vitalcv.timeline-events.v1` | `events[]` only; supports `?type=licensure&since=&limit=` |
| `GET /api/timeline/:entityId/trust-history` | `vitalcv.timeline-trust-history.v1` | `trustHistory` (entries + trend) |
| `GET /api/timeline/:entityId/recognition` | `vitalcv.timeline-recognition.v1` | `recognition[]` (recognition/acceptance/start events) |
| `GET /api/timeline/:entityId/reputation` | `vitalcv.timeline-reputation.v1` | `reputation` summary only |

## 2. Honesty rules (enforced by the projection, surfaced by the API)

1. Events are derived from current evidence timestamps and labeled as such — not a substitute for the audit log.
2. `reputation.standing` is `unknown` when `decisionGradeEvidence === 0` (no fabricated reputation).
3. `trustImpact` is bounded ([−1, 1]); no event inflates trust.
4. Empty timelines render honestly (`events: []`, `firstAt: null`), never a fabricated history.
5. No bare `Verified`; passes `pnpm check:claims`.

## 3. Success-criteria answers

- **How do we derive timelines?** Compose passport → evidence → graph → trust → `projectTimeline`; the route is a thin wrapper (built).
- The five sub-questions (career-over-time, recognition, reputation, trust↔mobility) are answered by the `events`/`recognition`/`reputation` slices of one projection.

**Deliverable status:** complete (primary built, sub-views designed). → C5.
