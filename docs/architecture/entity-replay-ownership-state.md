# Entity ↔ Replay Ownership State

**PR-γ TASK 1 deliverable.** Names the single authoritative
NPI → Entity → ReplayRun ownership spine that the new discovery
endpoints use. No new product concept; documents the existing
lookup that already binds an ingest run to a canonical entity.

## §1 — Canonical lookup spine

```
NPI (string, 10 digits)
  │
  ▼  prisma.vcvEntity.findFirst({ where: { npi }, orderBy: { createdAt: 'desc' } })
  │
Entity (VcvEntity row)
  ├─ id            uuid    — the field referenced by ReplayRun.entityId
  ├─ canonicalId   text    — sha256(entityType + primaryKey), unique
  ├─ entityType    enum
  └─ npi           text?   — indexed but NOT unique
  │
  ▼  prisma.replayRun.findMany({ where: { entityId: entity.id }, ... })
  │
ReplayRun[] (newest-first)
  ├─ runId         text    — run_v1_<16 hex>, UNIQUE
  ├─ lineageKey    text    — lin_v1_<16 hex>, indexed
  ├─ checkedAt     ts      — bound input to runId
  ├─ artifactChecksums text[] — canonical per-source completion encoding
  └─ payloadDigest text    — full SHA-256 of the canonical run payload
```

## §2 — Why VcvEntity is the canonical owner

| Property | Value |
|---|---|
| Where the orchestrator's ingest stores the entity | `entityRecord.entity` from `resolveEntityFromNpi(npi)` — this resolves to a `VcvEntity` row |
| Where PR-β's writer reads from | `entityRecord.entity.id` (the VcvEntity.id) |
| Where the ReplayRun row stores it | `ReplayRun.entityId` is the VcvEntity.id (a UUID) |
| Index on the lookup | `@@index([npi])` on VcvEntity; `@@index([entityId])` on ReplayRun |
| Uniqueness | VcvEntity.npi is NOT unique (multiple entities can share an NPI in principle). The lookup uses `findFirst` ordered by `createdAt desc` — newest entity wins |

## §3 — Deterministic ownership semantics

For a given NPI at a given moment, the ownership chain is deterministic
within the constraints of the underlying data:

- **NPI → VcvEntity** is "newest-first by createdAt" if multiple rows
  exist. If the database guarantees one VcvEntity per NPI (which the
  ingest path's resolution logic enforces by upsert in
  `resolveEntityFromNpi`), the result is fully unique.
- **VcvEntity → ReplayRun[]** is deterministic by `(checkedAt desc,
  createdAt desc)` — the tiebreaker exists so two rows sharing a
  millisecond `checkedAt` have a stable order.
- **ReplayRun → (lineageKey, runId)** is the content-addressed
  canonical identity from `computeReplayIdentity` — fully deterministic
  given the same inputs.

No other table sits between NPI and ReplayRun. There is no fan-out,
no resolver hop, no soft-ownership ambiguity.

## §4 — Why this design is single-spine

| Question | Answer |
|---|---|
| Could replay runs reference an Entity other than VcvEntity? | No — `ReplayRun.entityId` is a free-form `String` column; nothing prevents a future caller from writing a non-VcvEntity id, but only the orchestrator's PR-β writer populates the table, and that writer always passes `entityRecord.entity.id` (a VcvEntity uuid). |
| Could an NPI map to multiple VcvEntity rows? | In principle yes (the column is nullable, not unique). In practice the ingest path upserts and `findFirst` newest-first picks a deterministic single row. |
| Could a ReplayRun outlive its VcvEntity? | No FK constraint exists between ReplayRun.entityId and VcvEntity.id (intentional — keeps the migration purely additive and prevents cascade complexity). If a VcvEntity is deleted, ReplayRun rows become orphans referencing a now-missing UUID. The discovery endpoints handle this gracefully (entity lookup returns null → empty `runs: []`). |

## §5 — What the discovery endpoints add

- `GET /api/replay/runs/by-npi/:npi` — does the NPI → Entity → ReplayRun walk in one request, returns the newest-first chronology with `sourceSummary` decoded back from the canonical artifact-checksum encoding.
- `GET /api/replay/chain/:npi` — groups the runs by `lineageKey`, classifies each lineage as `stable` / `extended` / `diverged`, and returns the topological summary.

Both endpoints fail gracefully (503 `replay_infrastructure_unavailable`)
when the replay tables are absent, and return `200` with empty arrays
when the NPI has no entity yet.

## §6 — Verdict

The Entity ↔ Replay ownership spine is **single, authoritative, and
deterministic** for the NPI → ReplayRun lookup. No new ownership
concept is introduced by the discovery endpoints; they merely traverse
the existing spine in a single HTTP request instead of requiring SQL
introspection.
