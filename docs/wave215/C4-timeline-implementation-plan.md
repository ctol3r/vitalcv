# W215-C4 — Timeline Implementation Plan (Professional Memory)

**Wave:** 215 · **Depends on:** [C1](./C1-implementation-analysis.md)
**Date:** 2026-06-20

How "Professional Memory" / Career Timeline is represented using **existing** entities, events, and audit structures — no new event store.

---

## 0. Finding

Professional Memory **already exists as event-sourced data**, fragmented across four ordered, append-only sources. A Career Timeline is a **deterministic projection that merges and sorts** these by subject + time. No new write path.

## 1. Source events (all already persisted/ordered)

| Source | Type | Time key | Carries |
|---|---|---|---|
| `packages/audit` | `AuditEvent` / `AuditTimelineEntry` | `occurred_at` | RECOGNITION, ACCEPTANCE, START, PSV_RECEIPT, VERIFICATION_*, TRUST_STATE_CHECK/DECAY; NCQA tags; hashAnchor |
| Prisma | `IngestEvent` | `(ingestRunId, sequence)` | append-only ingest, dedupeKey, payload |
| Prisma | `EntityChangeEvent` | `observedAt` | new/updated/deleted/revoked claim, previous/current value, severity |
| `core/watchtower/eventStore.ts` | `WatchtowerEvent` / `WatchtowerClaimDelta` | `occurredAt` / `detectedAt` | CHECK_COMPLETED, CLAIM_CHANGE_DETECTED, ALERT_EMITTED; before/after values; replay-safe hash |
| `core/storylines/storylineTimeline.ts` | `StorylineTimeline` | `occurredAt` | origin/update/quiet/escalated/resolved; content-hash eventKey; decay |
| `core/investigation` | `TrustTimelinePoint[]` | `recordedAt` | score, delta, trigger, band |
| Prisma | `Recognition`/`Acceptance`/`Start` | `recognizedAt`/`acceptedAt`/`attestedAt` | the canonical career milestones |

## 2. The projection: `CareerTimeline`

A pure merge in `packages/domain-evidence` (or a sibling `domain-timeline` module) — **read model only**:

```ts
type CareerTimelineCategory =
  | 'identity' | 'verification' | 'recognition' | 'acceptance' | 'start'
  | 'credential_change' | 'trust_change' | 'alert';

interface CareerTimelineEntry {
  entryKey: string;            // stable content hash (reuse watchtower/storyline eventKey pattern)
  subjectKey: string;          // VcvEntity.canonicalId / NPI
  category: CareerTimelineCategory;
  occurredAt: string;          // canonical sort key (ISO)
  title: string;
  detail: string;
  evidenceRefs: string[];      // evidenceId / receiptId / artifactId
  sourceEventType: string;     // origin event type (provenance)
  immutable: boolean;          // true for audit/recognition-derived entries
}

interface CareerTimeline {
  subjectKey: string;
  entries: CareerTimelineEntry[];   // sorted by occurredAt, then entryKey
  firstAt: string | null;
  lastAt: string | null;
}
```

### Build algorithm (deterministic)
1. Pull events for `subjectKey` from each source (audit, change-events, watchtower, storyline, recognition/acceptance/start).
2. Map each to `CareerTimelineEntry` via per-source adapters (pure).
3. **Dedupe by `entryKey`** (content hash — reuse `makeEventKey()` / `computeWatchtowerHash()` patterns already in repo).
4. **Sort by `occurredAt`, tiebreak `entryKey`** (stable, replay-safe).
5. Return — no writes.

## 3. Why projection, not a new store

- Audit and ingest logs are **immutable + hash-anchored**; a second timeline store would risk divergence and dual-write bugs.
- The merge is cheap and deterministic; it can be computed on read or cached behind an ETag keyed by `lastAt`.
- Honors **"absence of a recorded revocation is not a guarantee"** (Trust Graph Rule 35) — the timeline reflects recorded events only and says so.

## 4. Constraints

1. **Immutable entries stay immutable** — audit/recognition entries render with provenance; never edited.
2. **No PHI** in titles/details.
3. **Honest gaps** — if a source has no events, the category renders empty, not fabricated.
4. **Replay-safe ordering** — deterministic given the same event set (no `Date.now()` in the merge).
5. **Decision-grade not implied by presence** — a timeline entry is a record of a check, not proof of current truth.

## 5. Implementation slices (for W250 Evidence Timeline)

| Slice | Work | Effort |
|---|---|---|
| T1 | `CareerTimelineEntry`/`CareerTimeline` types + per-source adapters (pure) | S |
| T2 | `buildCareerTimeline(events)` merge/dedupe/sort + unit tests (ordering, dedupe, empty) | S–M |
| T3 | Server aggregator that loads events per subject and calls the merge | M |
| T4 | `GET /timeline/:entityId` read API (C6) | S |
| T5 | UI: reuse `AnimatedTimeline` / `LiveStateLog` primitives to render `CareerTimeline` | M |

**Reuses:** `packages/audit`, `core/watchtower`, `core/storylines`, recognition tables, `AnimatedTimeline`/`LiveStateLog` components. **Creates:** one pure merge module + one read route.

**Deliverable status:** complete. Proceed to C5.
