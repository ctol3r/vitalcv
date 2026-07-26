# @vitalcv/career-graph

The **Provider Career Graph** contract: node/edge vocabulary, projection rules, the
gap register, and the authorization matrix. No storage, no queries, no rendering.

The graph describes truth the system already holds. It is a projection of canonical
PostgreSQL records — never a second source of truth, and never a node invented for
visual density.

## Files

| File | What it owns |
|---|---|
| `types.ts` | The ontology (25 node types, 28 edge types) + wire shapes |
| `projection.ts` | Rules for what projects **today**, from which model, via which column |
| `gaps.ts` | Every ontology member that **cannot** project, why, and what it would need |
| `authorization.ts` | Per-perspective visibility, scope predicates, and explicit denials |

`contract.test.ts` asserts every node and edge type is *exactly one of* projected or
gapped. A new type cannot be added without deciding which — that is the point.

## Repository determination (G1)

**`packages/graph-core` is not this, and is not the career graph.** It is a one-line
facade — `export * from '../../core/graph'` — with **zero consumers**: no import, no
package.json dependency anywhere.

`core/graph/` (~3.9k LOC) *is* live, but only via deep relative paths from backend
services (e.g. `intelligenceSignalsService.ts`). It is an **intelligence/analytics**
graph: pageRank, betweenness, community detection over provider intelligence. That is
a different concern from a navigable career-evidence network.

- **Retained:** `core/graph` — untouched. Real consumers depend on it.
- **Replaced:** nothing yet. The `graph-core` facade is dead weight; deleting it is
  safe but out of scope here, and its name should not be reused for this contract —
  the adjacency to `core/graph` would mislead.
- **Not reused:** `apps/web/components/career-graph/` is a self-contained canvas engine
  fed by `data.ts` — 14 **fictional** clinicians, hardcoded. It renders on the homepage
  hero, `/evidence-network`, and `/clinician/graph`. Honestly labelled ("Structure here
  is illustrative"), but it is synthetic and cannot become the Career Map by being
  wired up. It needs replacing with a projection of this contract.

There are ten competing `GraphNode` type definitions in the tree, most dead. This
package does not add an eleventh for the same job — it is the first typed contract for
the *career* graph specifically. The only DB-backed graph today is `graph-engine`,
surfacing on `/trust/graph` alone; `services/graph/liveGraphBuilder.ts` (511 LOC,
"builds live trust graphs from real data") is unreachable because
`registerLiveGraphRoutes` is never called in `app.ts`.

## What the contract found

Writing the rules surfaced things worth knowing before any UI is built:

1. **The employer decision is an island.** `EmployerDecisionEvent` FKs only to
   `VcvEntity` and `VcvOrganizationContext`. It references no application, no packet,
   no recognition. So `application → decided_by → decision → produced_recognition →
   recognition` — the centre of the product loop — **cannot be drawn from data**. It is
   currently an inference, not a record.
2. **`Recognition → Acceptance → Start` is real and FK-backed**, and is the strongest
   true subgraph in the product.
3. **Packets freeze copies, not versions.** `ApplicationPacket` seals field *values*
   inline under `packetHash` (tamper-evident, replays without rereading state), but
   `artifactId`/`receiptId` are unversioned, unconstrained strings. So `targets_version`
   is a gap: the packet cannot point at the exact evidence version it presented.
4. **Several central joins are not FKs** — `holds` (claims join on an NPI string),
   `has_identity`, `states_preference`, `consented_to`. Each is marked
   `foreignKeyBacked: false` and must reach the client that way.
5. **The authorization matrix rests on unverified identity.** `CLERK_JWT_VERIFICATION`
   defaults to `off` and is set in no deploy config; `tenantGuard` exempts `/api/graph/`
   from org context. See the header of `authorization.ts` — those are prerequisites, not
   follow-ups.

## Using it

```ts
import { NODE_PROJECTIONS, PERSPECTIVE_RULES } from '@vitalcv/career-graph';
```

A projection service reads `NODE_PROJECTIONS`/`EDGE_PROJECTIONS` to build subgraphs,
and **must** apply the matching `PerspectiveRule.scope` server-side before
serialization. Filtering in the client is not an implementation of this contract.
