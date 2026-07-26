# W220-C1 — Graph Readiness Analysis

**Wave:** 220 (Career Evidence Graph) · **Role:** Claude Code
**Builds on:** `docs/wave215/C5-graph-implementation-plan.md`, `C3-domain-evidence-package.md`
**Date:** 2026-06-20

Which graph primitives already exist — the safest path Passport → Evidence Graph.

---

## 0. Finding

**Every graph primitive needed already exists and serves traffic.** The Career Evidence Graph is a *projection + reconciliation*, not a new engine. The only doctrine-sensitive design question is **trust propagation**, resolved in C2/C3 as *monotonic-down* (evidence can taint, never elevate).

## 1. Primitive inventory

| Primitive | Exists? | Where |
|---|---|---|
| Node schema | ✅ rich | `apps/web/components/graph-system/types.ts` — `GraphNode`, 21 node types (clinician, organization, credential, license, receipt, source, claim, artifact, decision, exclusion, enrollment, …), `GraphLayer` = knowledge\|trust\|blended, trust attrs (`trustTier`, `trustBand`, `trustScore`, `confidence`) |
| Edge schema | ✅ rich | same file — `GraphEdge`, 35 `EdgeType`s incl. issued_by, verified_by, accepted_by, attested_by, trained_at, works_at, sourced_from, derived_from, supersedes-equivalent; `GraphEvidenceRef[]` |
| Persisted edges | ✅ | Prisma `VcvEntityRelationship` (LICENSED_BY, WORKS_FOR, EMPLOYED_BY; `confidence`, `tier`, `validFrom/validUntil`) |
| Node identity | ✅ | `VcvEntity.canonicalId = sha256(entityType+primaryKey)` — deterministic, stable graph key |
| Graph API | ✅ 22+ routes | `/api/graph/{global,local,mobile,:npi,live/:npi}`, `/node/:id/neighbors`, `/search`, `/ai-links/{suggest,apply}` |
| Render | ✅ | `components/graph/TrustGraphPrimary.tsx` (force-sim), `LiveTrustGraph.tsx` (canvas) |
| Trust scoring | ✅ | `packages/trust-state` — `CanonicalTruth`, `CanonicalSourceCoverage`, `deriveReadinessState`, `assertNonGatedIfPositive` |
| Evidence objects | ⏳ specced | `packages/domain-evidence` (W215-C3) — `EvidenceObject`/`EvidenceCollection`, not yet built |
| Canonical ontology | ✅ doc-grade | `docs/architecture/vitalcv-knowledge-trust-graph.json` — 94 nodes / 96 edges / 82 rules (not wired to runtime) |

## 2. Passport / Readiness / Trust-state as graph inputs

- **Passport** (`PassportData`) → a per-entity **composite node** + its evidence subgraph (identity/authority/training/standing/readiness already decompose into nodes). `career-packet.ts` proves the decomposition is clean.
- **Readiness engine** → a **computed node** (`deriveReadinessState` over coverage) — derived, not stored; recomputed on read.
- **Trust state** → node `trustBand`/`trustScore` come straight from `CanonicalTruth`/coverage; **no new scoring needed**.
- **Entity model** → `VcvEntity` nodes + `VcvEntityRelationship` edges already form the backbone graph.

## 3. The three gaps (all small)

1. **EvidenceObjects aren't first-class graph nodes yet** — needs the `evidenceCollectionToGraph` projector (C2).
2. **Two unreconciled taxonomies** — runtime `graph-system/types.ts` vs canonical `knowledge-trust-graph.json`. Needs a conformance map + test (C2 §4), not a rewrite.
3. **No evidence-centric `GET /graph/:entityId` family** — existing `/api/graph/:npi` is entity/relationship-centric, not evidence-centric (C5 API).

## 4. Constraints carried in (doctrine)

1. **No tier upgrade across edges** — Trust Graph rule "trust container does not upgrade proof tier." Trust propagation is **monotonic-down only** (C3).
2. **Decision-grade = `checked` only**; gated nodes never render positive (`assertNonGatedIfPositive`).
3. **Every trust edge is evidence-backed** (`evidenceRefs`); no unsourced trust edges.
4. **AI-suggested edges stay suggestions** (existing suggest/apply boundary).
5. **Recruiter surfaces unchanged** — `/packet`, `/api/passport/*`, `/api/employer-review/*` untouched (success criterion #6).
6. **No PHI in labels; passes `check:claims`; no bare `Verified`.**

**Deliverable status:** complete. → C2.
