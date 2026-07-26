# W228-C1 — Stack Inventory + System Dependency Map

**Date:** 2026-06-21

---

## 1. Inventory (measured)

`packages/domain-evidence/src` — 1,768 LOC total (incl. tests). Single external dep: `@vitalcv/trust-state`.

| Module | Exports | Tests | Depends on (internal) |
|---|---|---|---|
| `types.ts` | EvidenceObject, EvidenceClass, EvidenceStatus, EvidenceSource, EvidenceProvenance, EvidenceRelationship(+Type), EvidenceLifecycle, EvidenceValue, EvidenceCollection | — (pure types) | — |
| `collection.ts` | buildEvidenceCollection, isDecisionGradeStatus, summarizeEvidenceCoverage, EVIDENCE_CLASSES, EVIDENCE_STATUSES | 4 | types |
| `projectors/graph.ts` | projectEvidenceToGraph, statusTrustScore, GraphNode, GraphRelationship(+Type), GraphProjection, GRAPH_RELATIONSHIP_TYPES | 8 | types, collection |
| `trust/propagate.ts` | propagateTrust, TRUST_DIMENSIONS, TrustProjection, DimensionTrust, TrustHistory(+Entry/Type), TrustDimension | 8 | types, projectors/graph |
| `timeline/timeline.ts` | projectTimeline, CAREER_EVENT_TYPES, CareerEvent, TimelineProjection, ReputationSummary, Mobility/RecognitionImpact | 8 | types, projectors/graph, trust/propagate |
| `index.ts` | barrel | — | all |

**Package totals: 4 test files, 28 tests, all passing.**

Web layer:

| Module | Tests | Depends on |
|---|---|---|
| `lib/evidence/passport-to-evidence.ts` (adapter) | 6 | `@vitalcv/domain-evidence`, `@/lib/trust/passport-contract`, `@/lib/trust/source-coverage` |
| `app/api/evidence/[entityId]/route.ts` | 0 direct | adapter, passport-runtime |
| `app/api/graph/[entityId]/route.ts` | 0 direct | adapter, projector |
| `app/api/graph/[entityId]/trust/route.ts` | 0 direct | adapter, projector, trust |
| `app/api/timeline/[entityId]/route.ts` | 0 direct | adapter, projector, trust, timeline |
| `app/dev/graph/[entityId]/*` (dev tool) | 0 (UI) | graph + trust APIs |
| web integration tests (`evidence-{collection,graph,trust,timeline}`) | 20 | exercise adapter→projectors end-to-end |

**Web stack + regression: 9 test files, 44 tests, all passing** (20 stack + 24 recruiter regression: career-packet 13+2, employer-proof-packet 2, export-packet-route 6, banned-verified-label 1).

## 2. System Dependency Map (verified — no cycles)

```mermaid
flowchart TD
  TS[@vitalcv/trust-state\n(external, ships dist)] --> TYPES[types.ts]
  TS --> COLL[collection.ts]
  TYPES --> COLL
  TYPES --> GRAPH[projectors/graph.ts]
  COLL --> GRAPH
  TYPES --> TRUST[trust/propagate.ts]
  GRAPH --> TRUST
  TYPES --> TL[timeline/timeline.ts]
  GRAPH --> TL
  TRUST --> TL

  subgraph web [apps/web]
    PASS[passport runtime] --> ADAPT[passport-to-evidence.ts]
    ADAPT --> RC[/api/evidence/:id/]
    ADAPT --> RG[/api/graph/:id/]
    ADAPT --> RT[/api/graph/:id/trust/]
    ADAPT --> RTL[/api/timeline/:id/]
  end

  COLL -.consumed by.-> ADAPT
  GRAPH -.-> RG
  TRUST -.-> RT
  TL -.-> RTL
```

**Runtime data flow (single linear pipeline):**
`passport → passportToEvidenceCollection → EvidenceCollection → projectEvidenceToGraph → GraphProjection → propagateTrust → TrustProjection → projectTimeline → TimelineProjection`. Each route taps one stage of this pipeline.

## 3. Layering (strict, acyclic)

`types → collection → graph → trust → timeline`. Each layer depends only on lower layers. Verified by import scan: no module imports a higher or sibling layer; no module imports anything app-side. The only external dependency is `@vitalcv/trust-state`, and only for the canonical status vocabulary.
