# W220-C6 — Graph Readiness Report

**Wave:** 220 · **Synthesizes:** [C1](./C1-graph-readiness-analysis.md)–[C5](./C5-graph-api-contracts.md)
**Date:** 2026-06-20

---

## 0. Six success-criteria answers

1. **Graph nodes** → `evidenceCollectionToGraph` projects `EvidenceObject`/`EvidenceSource`/`VcvEntity` onto the existing `graph-system/types.ts` `NodeType` vocabulary. No new node types; one total mapping function. (C2)
2. **Relationships** → reuse `GraphEdge` + `VcvEntityRelationship` + provenance; edges grouped into Evidence/Trust/Employment/Recognition families; every trust edge carries `evidenceRefs`. (C3)
3. **Trust propagation** → **monotonic-down only**: a node's positive band comes from its own coverage; propagation can taint/degrade dependents of a negative source, never elevate. Enforced by `assertNonGatedIfPositive` + a property test (`propagatedBand ≤ standaloneBand`). (C3)
4. **Graph queries** → pure selectors over the projection (`evidenceNodesFor`, `trustEdgesFor`, `recognitionChainFor`, `mobilityFactorsFor`, `timelineFor`); no query language. (C4)
5. **Evidence Objects → Graph** → the projector + ontology conformance test; read-time, no materialization in W220. (C2/C5)
6. **Preserve recruiter workflows** → entirely additive + read-only; `/packet`, `/api/passport/*`, `/api/employer-review/*`, existing `/api/graph/*` untouched; graph is an alternative read of the same evidence. (C1/C2)

## 1. Impacted packages

| Package | Change | Risk |
|---|---|---|
| `packages/domain-evidence` | + `evidenceCollectionToGraph`, `mapEvidenceClassToNodeType`, graph selectors, propagation (all pure) | Low |
| `apps/web/components/graph-system` | possibly + 1–2 `EdgeType`s (`proven_by`, `supersedes`) — additive type change | Low |
| `apps/web` | + `/graph/:entityId(/nodes,/relationships,/trust,/timeline)` routes; feed projector into existing `LiveTrustGraph` | Low |
| `apps/api/backend` | + per-entity graph aggregator (loads records → EvidenceCollection → projector) | Med (fan-out) |
| `docs/architecture/knowledge-trust-graph.json` | **no rewrite** — add a conformance map only | Low |

## 2. Impacted routes

**New:** `GET /graph/:entityId`, `…/nodes`, `…/relationships`, `…/trust`, `…/timeline` (5).
**Unchanged:** all existing `/api/graph/*` (22+), `/packet`, `/api/passport/*`, `/api/employer-review/*`, `/api/export/packet`.

## 3. Impacted schemas

- **No Prisma migration.** Nodes/edges are projected from existing tables (`VcvEntity`, `VcvEntityRelationship`, `VcvCredential`, `ClaimRecord`, `VerificationArtifact`, receipts, recognition chain).
- **New API contracts:** `evidence-graph.v1`, `evidence-graph-nodes.v1`, `evidence-graph-edges.v1`, `evidence-graph-trust.v1`, `evidence-graph-timeline.v1`.
- **Possible additive type change:** 1–2 `EdgeType` literals (no runtime data change).

## 4. Migration risks

| Risk | Severity | Mitigation |
|---|---|---|
| Trust elevated across edges (doctrine breach) | **High** | monotonic-down algorithm + property test `propagatedBand ≤ standaloneBand`; reuse `assertNonGatedIfPositive` |
| Ontology vs runtime taxonomy drift | Med | conformance test: every runtime `NodeType` ∈ ontology; don't rewrite the JSON |
| Unsourced trust edge ships | Med | test: every `layer:'trust'` edge has ≥1 `evidenceRef` |
| Recruiter surface regression | **High (business)** | additive-only; `/packet` + `career-packet` regression tests stay green |
| Supersession cycles | Low | DAG assertion on `supersededBy` resolution |

## 5. Performance risks

- **Fan-out per entity:** loading the EvidenceCollection reads several indexed tables. Mitigate with indexed per-entity keys (`npi`/`subjectNpi`/`entityId` all indexed), ETag cache on `lastCheckedAt`, and `depth`/`nodeTypes` filters to bound the subgraph.
- **Render:** reuse `LiveTrustGraph` (already canvas + force-sim tuned); cap node/edge counts with explicit `truncated` flags.
- **Propagation:** single downward DAG sweep, O(V+E) per entity — negligible at clinician scale.
- Materialized graph store is **deferred** (gated decision) — only if read latency proves insufficient.

## 6. Test strategy

1. **Unit (pure):** `mapEvidenceClassToNodeType` totality; projector node/edge counts; selectors (C4); propagation.
2. **Invariant/property:** `propagatedBand ≤ standaloneBand`; trust edges have evidenceRefs; gated never positive; supersession DAG.
3. **Conformance:** runtime `NodeType` ⊆ ontology nodes.
4. **Contract:** each route returns its `vitalcv.*.v1` schema + honest `truncated`/empty states.
5. **Regression:** `/packet`, `career-packet`, `employer-proof-packet`, `export-packet-route`, `banned-verified-label` green; `pnpm check:claims`, `pnpm typecheck`, web build.
6. **Codex SAFE** before merge.

## 7. Effort estimates (1 unit ≈ a focused PR w/ tests)

| Item | Effort |
|---|---|
| `evidenceCollectionToGraph` + class→type map + tests | 1.5 |
| Selectors (C4) + tests | 1 |
| Monotonic-down propagation + property tests | 1.5 |
| `GET /graph/:entityId` family (5 routes) + contract tests | 2 |
| Ontology conformance map + test | 0.5 |
| Wire projector → `LiveTrustGraph` UI | 1 |
| Caching/ETag/truncation hardening | 1 |

**Total ≈ 8.5 units.** ~80% reuse; the only doctrine-sensitive work is propagation (1.5 units), fully contained by the monotonic-down rule + property test.

## 8. Safest path Passport → Evidence Graph (recommended order)

1. Land `packages/domain-evidence` (W220 prerequisite from W215-C3) — types + normalizers + `buildEvidenceCollection` + `GET /evidence/:entityId`.
2. Add projector + `GET /graph/:entityId` + `/nodes` + `/relationships` (no propagation yet).
3. Add `/trust` with monotonic-down propagation + property test.
4. Add `/timeline` (delegates to W215-C4 once that lands) or stub honestly until then.
5. Wire UI into existing `LiveTrustGraph`. Recruiter `/packet` untouched throughout.

**Deliverable status:** W220 complete — C1–C6 in `docs/wave220/`.
