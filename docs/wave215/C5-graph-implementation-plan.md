# W215-C5 — Graph Implementation Plan (Career Evidence Graph)

**Wave:** 215 · **Depends on:** [C1](./C1-implementation-analysis.md), [C3](./C3-domain-evidence-package.md)
**Date:** 2026-06-20

How the Career Evidence Graph layers onto existing entities, trust systems, and APIs.

---

## 0. Finding

**The graph engine already exists and serves traffic.** `apps/web/components/graph-system/types.ts` defines a production `GraphNode` (21 node types) / `GraphEdge` (35 edge types) schema; `/api/graph/*` exposes 22+ routes (global/local/mobile/neighbors/search/live/ai-links); `VcvEntityRelationship` persists typed edges. The Career Evidence Graph is a **typed view + ontology reconciliation**, not a new engine.

## 1. What exists vs. the gap

| Layer | State |
|---|---|
| Node/edge schema | `graph-system/types.ts` — rich, production. Includes credential, license, receipt, source, claim, artifact nodes and issued_by / verified_by / accepted_by / attested_by / sourced_from / derived_from edges. |
| Render | `TrustGraphPrimary.tsx`, `LiveTrustGraph.tsx` (force-sim + canvas). |
| API | `/api/graph/{global,local,mobile,:npi,live/:npi,node/:id/neighbors,search,ai-links/*}`. |
| Persisted edges | `VcvEntityRelationship` (LICENSED_BY, WORKS_FOR, EMPLOYED_BY; confidence, tier, validity). |
| Canonical ontology | `docs/architecture/vitalcv-knowledge-trust-graph.json` — 94 nodes / 96 edges / 82 rules, **documentation-grade only, not wired to runtime types.** |
| **Gap** | (a) ontology JSON ≠ runtime `graph-system/types.ts` (two unreconciled taxonomies); (b) EvidenceObjects (C3) are not first-class graph nodes everywhere; (c) no single `GET /graph/:entityId` that returns an **evidence-centric** subgraph. |

## 2. Layering approach (additive view, not a rewrite)

The Career Evidence Graph = a **projection of `EvidenceCollection` (C3) onto the existing graph schema**:

```
EvidenceObject        → GraphNode{ type: mapEvidenceClassToNodeType(class), trustTier, trustBand, layer:'trust' }
EvidenceSource        → GraphNode{ type: 'source' }
EvidenceRelationship  → GraphEdge{ type, confidence, layer:'trust' }
VcvEntity             → GraphNode{ type: 'clinician' | 'organization' }
VcvEntityRelationship → GraphEdge (already)
```

`EvidenceClass → NodeType` is a total map onto the existing 21-type vocabulary (licensure→license, board_cert→credential, exclusion→exclusion, recognition→decision/receipt, …). **No new node types required** for the core; only the mapping function is new.

## 3. Ontology reconciliation (load-bearing, do once)

`knowledge-trust-graph.json` is the canonical 82-rule ontology but is doc-only. Plan:
1. **Do not rewrite** the JSON (CLAUDE.md: add boundaries, never rewrite old ones).
2. Add a **conformance map** `ontologyNodeId → graphSystemNodeType` as data, plus a test asserting every runtime node type has an ontology home. This makes the JSON *checkable* against runtime without coupling render to it.
3. Keep the JSON as the authority for *rules* (e.g., "trust container does not upgrade proof tier"); the runtime graph enforces a subset via existing trust-state guards.

## 4. Trust-system integration (reuse, don't re-derive)

- Node trust attributes (`trustTier`, `trustBand`, `trustScore`, `confidence`) come from `CanonicalSourceCoverage` / `CanonicalTruth` already on the EvidenceObject — **no new scoring**.
- `assertNonGatedIfPositive` continues to guard: a gated EvidenceObject node may not render a positive/decision-grade trust band.
- Edge `confidence`/`weight` reuse existing `VcvEntityRelationship.confidence` and claim match confidence.

## 5. Constraints

1. **Partial stays partial / no tier upgrade** (Trust Graph Rule, "trust container does not upgrade proof tier") — the graph view must not present a node as more verified than its evidence.
2. **Edges are evidence-backed** — every trust edge carries `evidenceRefs` (reuse `GraphEvidenceRef`); no unsourced trust edges.
3. **Provenance ordering preserved** — VERIFIED > USER_ENTERED > INFERRED > UNKNOWN (ontology rule).
4. **AI-suggested links stay suggestions** — existing `ai-links/suggest` + human `apply` boundary unchanged; suggested edges render as `ai_suggested_link`, never auto-promoted.
5. **No PHI in node/edge labels.**

## 6. Implementation slices (for W270 / graph wave)

| Slice | Work | Effort |
|---|---|---|
| G1 | `mapEvidenceClassToNodeType` + `evidenceCollectionToGraph(collection)` (pure) + tests | S–M |
| G2 | Ontology conformance map + test (`every runtime NodeType ∈ ontology`) | S |
| G3 | `GET /graph/:entityId` returning evidence-centric subgraph (compose existing `/api/graph/:npi` + EvidenceCollection) | M |
| G4 | UI: feed `evidenceCollectionToGraph` output into existing `LiveTrustGraph` | S–M |
| G5 | Edge evidence-ref backfill audit (flag any trust edge lacking `evidenceRefs`) | M |

**Reuses:** `graph-system/types.ts`, `/api/graph/*`, `VcvEntityRelationship`, trust-state guards, render components. **Creates:** evidence→graph projector + ontology conformance test + one composed route.

**Deliverable status:** complete. Proceed to C6.
