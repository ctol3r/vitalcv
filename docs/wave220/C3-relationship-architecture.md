# W220-C3 — Relationship Architecture

**Wave:** 220 · **Depends on:** [C2](./C2-node-architecture-plan.md)
**Date:** 2026-06-20

How relationships are represented — and how **trust propagation** stays doctrine-safe.

---

## 1. Relationship families → existing `EdgeType`

| Family (brief) | Concrete edges | EdgeType (existing) | Source of truth |
|---|---|---|---|
| **EvidenceRelationship** | evidence ← source, evidence ← artifact, claim ← receipt | `verified_by`, `sourced_from`, `derived_from`, `proven_by`* | EvidenceObject.provenance, `Claim.sourceCheckId`, `VerificationReceiptRecord.claimRecordId` |
| **TrustRelationship** | node depends-on source freshness; supersession | `depends_on`, `supersedes`* | `CanonicalSourceCoverage`, `*.supersededBy*` |
| **EmploymentRelationship** | clinician ↔ employer/facility | `works_at`, `affiliated_with` | `VcvEntityRelationship` (WORKS_FOR, EMPLOYED_BY) |
| **RecognitionRelationship** | recognition → acceptance → start | `accepted_by`, `attested_by`, `issued_by` | Prisma `Recognition`/`Acceptance`/`Start` chain |
| Training/affiliation | clinician → program/institution | `trained_at`, `affiliated_with` | `VcvEntityRelationship`, training records |

\* `proven_by`/`supersedes` may need to be added to the `EdgeType` union if not present verbatim — additive, pure type change, no migration.

## 2. Edge shape (reuse `GraphEdge`)

Every Career Evidence Graph edge reuses the existing `GraphEdge`:
- `source`/`target`: node ids from C2.
- `type`: from the table above.
- `confidence`/`weight`: reuse `VcvEntityRelationship.confidence` / claim match confidence.
- **`evidenceRefs: GraphEvidenceRef[]` is mandatory for trust edges** — no unsourced trust edge ships.
- `firstSeenAt`/`lastSeenAt`: from record timestamps (temporal edges).
- `layer`: `'trust'` for evidence/proof edges, `'knowledge'` for affiliations.

## 3. Trust propagation — **monotonic-down only** (the key doctrine decision)

The brief asks "how do we implement trust propagation." Doctrine forbids tier upgrades across containers/edges (Trust Graph rule). Therefore:

> **Propagation may only taint or constrain a node, never elevate it.**

Concretely:
- A node's **positive** trust band comes **solely from its own EvidenceObject coverage** (a `checked` license). A neighbor's high trust **cannot raise** a node.
- Propagation flows **downward/negatively**: if a `source` node is `unavailable`/`revoked`/`stale`, every evidence node `sourced_from` it is **flagged** (e.g., `riskDelta`, a `depends_on` warning edge), and any computed node depending on it degrades (PARTIAL/BLOCKED).
- This matches the runtime guard `assertNonGatedIfPositive` and Rule 35 ("absence of recorded revocation is not a guarantee"): we degrade on recorded negatives, we never assume positives.

### Propagation algorithm (pure, read-time)
1. Compute each evidence node's own band from its coverage (no neighbors).
2. For each `source`/`receipt` node in a negative state, walk `sourced_from`/`proven_by`/`depends_on` edges and **lower** dependents (cap their band, set `flagged`, attach reason).
3. Recompute computed (readiness) nodes from the (possibly lowered) coverage.
4. Never run an "raise" pass. Terminates in one downward sweep (DAG; supersession edges are acyclic).

**Result:** trust propagation is implementable, useful (revocation taints dependents), and provably cannot manufacture trust.

## 4. Relationship invariants (tested)

1. Every `layer:'trust'` edge has ≥1 `evidenceRef` (test: scan projector output).
2. Propagation is monotonic-down: a property test asserts no node's band increases after propagation vs. its standalone band.
3. Supersession edges form a DAG (no cycles); `supersededBy` resolves forward only.
4. AI-suggested edges keep `type: 'ai_suggested_link'` until human `apply` (existing boundary).

## 5. Persistence stance

- **Read-time projection** for W220 — edges derived from existing records (`VcvEntityRelationship` + provenance), no new edge table.
- Materialized graph edges are a **deferred** decision (perf optimization), gated like `defer_until_contract_aligned`.

**Deliverable status:** complete. → C4.
