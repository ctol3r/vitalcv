# W220-C4 — Graph Query Blueprint

**Wave:** 220 · **Depends on:** [C2](./C2-node-architecture-plan.md), [C3](./C3-relationship-architecture.md)
**Date:** 2026-06-20

Future graph queries — expressed as **pure selectors over the projected `{nodes, edges}`**, so they work identically on a read-time projection now and a materialized store later.

---

## 0. Query model

All queries are functions `(graph, subjectKey, params) → result`. No new query language; no Cypher/Gremlin dependency. Selectors live next to the projector in `packages/domain-evidence` (pure, testable). The backend routes (C5) are thin wrappers.

## 1. The five canonical queries (from the brief)

| Query | Selector | Returns |
|---|---|---|
| **Show all evidence for clinician** | `evidenceNodesFor(subjectKey)` | all `EvidenceObject` nodes anchored to the clinician, grouped `byClass`, with status/freshness |
| **Show trust relationships** | `trustEdgesFor(subjectKey)` | `layer:'trust'` edges (`verified_by`, `sourced_from`, `proven_by`, `depends_on`) + their evidenceRefs |
| **Show professional timeline** | `timelineFor(subjectKey)` | delegates to `CareerTimeline` (W215-C4) — time-sorted entries; the graph view overlays them on recognition/credential nodes |
| **Show recognition history** | `recognitionChainFor(subjectKey)` | the Recognition→Acceptance→Start node chain with `accepted_by`/`attested_by` edges |
| **Show mobility readiness factors** | `mobilityFactorsFor(subjectKey)` | licensure nodes by state + compact eligibility + which evidence is reusable vs. gated per target state |

## 2. Supporting traversals (reuse existing engine where possible)

- **Neighbors** → existing `/api/graph/node/:id/neighbors`; selector `neighbors(graph, nodeId, depth)`.
- **Subgraph** → `subgraphFor(subjectKey, { nodeTypes?, edgeTypes?, layer? })` — filter the projection; mirrors existing `/api/graph/:npi` filter params (`nodeTypes`, `edgeTypes`, `trustTiers`, `graphMode`).
- **Why-is-this-trusted** → `provenancePathFor(evidenceId)` — walks `proven_by`/`sourced_from` back to source + receipt (explains a node's band).
- **What-breaks-if-source-fails** → `dependentsOf(sourceId)` — the monotonic-down propagation set (C3).

## 3. Query honesty rules

1. Evidence queries return **status verbatim** (checked/gated/stale/…); never collapse to "verified".
2. Mobility/readiness factors mark gated/stale evidence as **not reusable** for a target state, not "available".
3. Truncation is explicit — any capped result sets a `truncated: true` + count (no silent caps).
4. Empty is honest — "no recognition events recorded" ≠ "not recognized."

## 4. Performance shape

- All selectors operate on an already-loaded per-entity projection (bounded: one clinician's evidence is tens, not millions of nodes).
- The fan-out cost is **loading** the projection (indexed per-entity table reads), not the selectors (in-memory, O(n)/O(n log n)).
- Cache the projection behind an ETag keyed on `lastCheckedAt`; selectors run on the cached object.

## 5. Test strategy for queries

- Golden-fixture: a synthetic `EvidenceCollection` → assert each selector's output (counts, grouping, status fidelity).
- Property: `trustEdgesFor` output ⊆ edges with evidenceRefs; `mobilityFactorsFor` never marks a gated source reusable.
- Determinism: same input → same ordering (stable sort by id/occurredAt).

**Deliverable status:** complete. → C5.
