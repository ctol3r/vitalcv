# W220-C2 — Node Architecture Plan

**Wave:** 220 · **Depends on:** [C1](./C1-graph-readiness-analysis.md)
**Date:** 2026-06-20

Map current objects → graph nodes, using the existing `graph-system/types.ts` `NodeType` vocabulary (21 types). **No new node types required** for the core.

---

## 1. Object → node map

| Current object | Graph node | NodeType (existing) | Node kind |
|---|---|---|---|
| `VcvEntity` (person) | Clinician node | `clinician` | **Composite / anchor** |
| `VcvEntity` (org) | Employer/Institution node | `organization` / `institution` | Entity |
| `PassportData` | (not a node) — the *subgraph root view* of a clinician | — | Composite view |
| `EvidenceObject{class: licensure}` | License node | `license` | **Evidence** |
| `EvidenceObject{class: board_cert}` | Credential node | `credential` | Evidence |
| `EvidenceObject{class: identity}` | Identity claim node | `claim` | Evidence |
| `EvidenceObject{class: exclusion}` | Exclusion node | `exclusion` | Evidence |
| `EvidenceObject{class: enrollment}` | Enrollment node | `enrollment` | Evidence |
| `VerificationReceiptRecord`/`PsvReceipt` | Receipt node | `receipt` | **Trust/proof** |
| `EvidenceSource` (NPPES/OIG/STATE_BOARD) | Source node | `source` | Trust/proof |
| `VerificationArtifact` | Artifact node | `artifact` | Evidence backing |
| Readiness (`deriveReadinessState`) | Readiness node | `decision` | **Computed** |
| `Recognition`/`Acceptance`/`Start` | Recognition / decision nodes | `decision` | Employment evidence |

This satisfies the brief's examples: **Passport → Composite Node, License → Evidence Node, Verification → Trust Node, Readiness → Computed Node.**

## 2. Node kinds (semantics, not new types)

- **Composite/anchor** — the clinician `VcvEntity`; the subgraph centers here. `canonicalId` = node id.
- **Evidence node** — one per `EvidenceObject`. Carries `status`, `decisionGrade`, `observedAt/checkedAt/expiresAt`, `provenance`. **Never rendered above its own coverage.**
- **Trust/proof node** — sources + receipts; the cryptographic backing.
- **Computed node** — readiness; **derived on read** (not stored), recomputed from coverage so it can never be stale relative to its inputs.

## 3. The projector (the only new code)

`packages/domain-evidence` (or graph adapter) exposes a **pure**:

```ts
function evidenceCollectionToGraph(c: EvidenceCollection): { nodes: GraphNode[]; edges: GraphEdge[] }
```

Rules:
- `node.id`: reuse `evidenceId` / `canonicalId` / `sourceId` (stable, no new id scheme).
- `node.type = mapEvidenceClassToNodeType(class)` — total map onto the 21 existing types.
- `node.trustTier/trustBand/trustScore/confidence` copied **from the EvidenceObject's coverage/truth** — no re-derivation.
- `node.layer = 'trust'` for evidence/source/receipt; `'knowledge'` for entity/affiliation.
- `node.metadata.decisionGrade = (status === 'checked')` — never widened.

## 4. Computed node honesty

The readiness `decision` node:
- recomputed via `deriveReadinessState(coverage)` at projection time (pure);
- band derived via `deriveTrustBandFromReadiness`;
- **carries the partial/blocked state visibly** — a PARTIAL readiness node renders PARTIAL, never DECISION_GRADE (mirrors `/packet` honesty).

## 5. Node-level invariants (tested)

1. `mapEvidenceClassToNodeType` is **total** (every `EvidenceClass` → a valid `NodeType`); unit-tested exhaustively.
2. A gated/notDecisionGrade EvidenceObject → node with non-positive band; `assertNonGatedIfPositive` holds.
3. No node invents trust it doesn't have in its source EvidenceObject.
4. Projector is pure (no `Date.now()` except echoing record timestamps).

## 6. What is NOT a node

- `PassportData` and `CareerPacketModel` stay **views**, not nodes — they are the recruiter projections that must not change (criterion #6). The graph is an *alternative* read of the same evidence, never a replacement.

**Deliverable status:** complete. → C3.
