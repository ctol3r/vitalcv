# W220-C5 — Graph API Contracts

**Wave:** 220 · **Depends on:** [C4](./C4-graph-query-blueprint.md)
**Date:** 2026-06-20

Read-only, versioned (`vitalcv.evidence-graph.v1`), additive. `entityId` = `canonicalId` or NPI. None mutates; none changes an existing route. Family expands `GET /graph/:entityId` from W215-C6.

---

## 1. `GET /graph/:entityId`

The full evidence-centric subgraph (projector output).

```jsonc
{
  "schema": "vitalcv.evidence-graph.v1",
  "subjectKey": "…",
  "nodes": [
    { "id": "clinician_…", "type": "clinician", "label": "Ada Lovelace", "layer": "knowledge" },
    { "id": "license_ca_…", "type": "license", "label": "CA RN License",
      "trustBand": "L2", "metadata": { "decisionGrade": true, "status": "checked" }, "layer": "trust" },
    { "id": "src_state_board", "type": "source", "label": "State Board", "layer": "trust" }
  ],
  "edges": [
    { "id": "e1", "source": "license_ca_…", "target": "src_state_board",
      "type": "verified_by", "confidence": 0.99, "layer": "trust",
      "evidenceRefs": [ { "evidenceId": "receipt_…", "source": "STATE_BOARD", "observedAt": "…" } ] }
  ],
  "stats": { "nodeCount": 12, "edgeCount": 18, "truncated": false }
}
```
Query params (reuse existing `/api/graph` semantics): `?nodeTypes=`, `?edgeTypes=`, `?layer=trust|knowledge|blended`, `?depth=`.

## 2. `GET /graph/:entityId/nodes`

Nodes only — `evidenceNodesFor` (C4). Supports `?class=licensure` and `?status=checked`.

```jsonc
{ "schema": "vitalcv.evidence-graph-nodes.v1", "subjectKey": "…",
  "nodes": [ /* GraphNode[] */ ], "byClass": { "licensure": ["license_ca_…"] }, "truncated": false }
```

## 3. `GET /graph/:entityId/relationships`

Edges only — `trustEdgesFor` + affiliations. `?layer=trust` filters to evidence-backed edges.

```jsonc
{ "schema": "vitalcv.evidence-graph-edges.v1", "subjectKey": "…",
  "edges": [ /* GraphEdge[] with evidenceRefs */ ], "truncated": false }
```

## 4. `GET /graph/:entityId/trust`

The trust view: per-node band + the **monotonic-down propagation** result (C3) — which nodes are tainted by which negative source.

```jsonc
{
  "schema": "vitalcv.evidence-graph-trust.v1",
  "subjectKey": "…",
  "nodes": [ { "id": "license_ca_…", "standaloneBand": "L2", "propagatedBand": "L2", "flagged": false } ],
  "taints": [
    { "sourceId": "src_pecos", "state": "stale",
      "affects": ["enrollment_…"], "effect": "degraded", "reason": "PECOS evidence beyond freshness window" }
  ],
  "invariant": "propagatedBand <= standaloneBand for every node"
}
```
The `invariant` line is asserted in tests, not just documented.

## 5. `GET /graph/:entityId/timeline`

Graph-overlaid timeline — delegates to `CareerTimeline` (W215-C4) and tags each entry with the node(s) it touches.

```jsonc
{ "schema": "vitalcv.evidence-graph-timeline.v1", "subjectKey": "…",
  "entries": [ { "entryKey": "…", "occurredAt": "…", "category": "verification",
                 "title": "State board checked", "nodeIds": ["license_ca_…"], "immutable": true } ] }
```

## 6. Contract summary

| Route | Schema | Logic | Reuse |
|---|---|---|---|
| `GET /graph/:entityId` | `evidence-graph.v1` | projector | `evidenceCollectionToGraph` + `/api/graph/:npi` |
| `…/nodes` | `evidence-graph-nodes.v1` | selector | C4 |
| `…/relationships` | `evidence-graph-edges.v1` | selector | C4 |
| `…/trust` | `evidence-graph-trust.v1` | propagation (monotonic-down) | C3 |
| `…/timeline` | `evidence-graph-timeline.v1` | delegate | W215-C4 |

All five are pure composition over the projector + existing services. Auth mirrors the passport's visibility (public where passport is public). Cache: `no-store` + ETag on `lastCheckedAt`.

**Deliverable status:** complete. → C6.
