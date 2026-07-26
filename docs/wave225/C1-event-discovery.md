# W225-C1 — Event Discovery

**Wave:** 225 (Professional Memory System) · **Role:** Claude Code
**Date:** 2026-06-21
**Inputs analyzed:** EvidenceObject/Collection (W220), GraphProjection (W221), TrustProjection + TrustHistory (W222), Mobility signals (W230).

What event-capable data already exists — the raw material for Professional Memory. **No new capture is required**; the timeline is a projection (built in C2/C3).

---

## 0. Finding

Every layer already emits time-stamped, source-backed signals. A "career over time" is a **deterministic merge of existing timestamps**, not a new event store. (The richer backend event sources — `AuditEvent`, `WatchtowerEvent`, `EntityChangeEvent`, recognition tables — were inventoried in W215-C4 and remain the authoritative recorded history; the W225 projection is the *evidence-derived* view that runs purely on the data already in the passport.)

## 1. Event-capable fields per layer

| Layer | Time field(s) | Event-shaped signal |
|---|---|---|
| `EvidenceObject` | `checkedAt`, `observedAt`, `expiresAt` | a verification occurred / evidence will expire |
| `EvidenceObject` | `lifecycle` (`active/superseded/revoked/expired`) | a state transition |
| `EvidenceObject` | `status` | decision-grade vs owed at a point in time |
| `GraphNode` (evidence) | carries the above + `trustScore`, `evidenceSource`, `evidenceClass` | a node's contribution at a moment |
| `TrustHistory` (W222) | `entries[].occurredAt` | reinforcement / decay events (already timeline-shaped) |
| `TrustHistory` | `trend`, `netDelta` | growth/decay trajectory |
| Mobility (W230) | licensure `checkedAt` + jurisdiction | a mobility-expanding event |

## 2. Event categories already derivable

| Category | Derived from |
|---|---|
| Identity verification | `identity` evidence `checkedAt` |
| Credential verified / decayed | licensure/board_cert/registration status + lifecycle |
| Screening / enrollment | exclusion / enrollment evidence |
| Recognition / acceptance / start | recognition/acceptance/start evidence classes |
| Trust reinforcement / decay | `TrustHistory.entries` |
| Mobility expansion / reduction | licensure status transitions |

## 3. What the projection must add (built in C2/C3)

1. A unified `CareerEvent` shape carrying **trust impact + mobility impact + recognition impact** in one record (the brief's C2 fields).
2. Deterministic ordering + dedupe.
3. A `reputation` rollup (standing) and a `recognition` subset.

All three are pure derivations over the existing fields — implemented in `packages/domain-evidence/src/timeline/timeline.ts`.

## 4. What is NOT an event source here

- No new write path; the projection never records anything.
- The authoritative recorded history (audit/watchtower) is **not** replaced — this view is honest about being derived from current evidence timestamps (Trust Graph Rule 35: absence of a recorded event ≠ absence of the fact).

**Deliverable status:** complete. C2/C3 implemented; C4/C5/C6 follow.
